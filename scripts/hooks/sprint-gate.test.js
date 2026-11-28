// Tests for sprint-gate.js: phase window (floor, ceiling, skip), Discover log gate, Opus 5.5 high start check.
// Each test runs the real hook as a child process against a temp project. Run: node --test scripts/hooks/
"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), os = require("os"), path = require("path");
const { spawnSync } = require("child_process");

const GATE = path.join(__dirname, "sprint-gate.js");
const CFG = {
  phases: { 1: { budgetMin: 30 }, 4: { budgetMin: 45 } },
  orchestrator: { model: "claude-opus-5-5", effort: "high" },
  gates: { phaseFloorLeadMin: 5, maxFloorStopBlocks: 3, discoverMinUserQuestions: 15, minUserQuestionsPerPhase: 15, discoverMinChallengeRounds: 5 },
};
const ago = min => new Date(Date.now() - min * 60000).toISOString();

function project(state) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sprint-gate-"));
  fs.mkdirSync(path.join(root, "home"));
  fs.writeFileSync(path.join(root, "sprint.config.json"), JSON.stringify(CFG));
  if (state) fs.writeFileSync(path.join(root, ".sprint-state.json"), JSON.stringify({ active: true, skillsLoaded: [], questionsByPhase: { 1: 15, 2: 15, 3: 15, 4: 15, 5: 15, 6: 15 }, ...state }));
  return root;
}
function run(root, { args = [], input, env = {} } = {}) {
  const e = { ...process.env, USERPROFILE: path.join(root, "home"), HOME: path.join(root, "home"), CLAUDE_PROJECT_DIR: root,
    SPRINT_REPORTS_DIR: path.join(root, "reports"), ...env };
  delete e.CLAUDE_CODE_EFFORT_LEVEL; Object.assign(e, env);
  const r = spawnSync(process.execPath, [GATE, ...args], { cwd: root, env: e, input: input ? JSON.stringify(input) : "", encoding: "utf8" });
  return { code: r.status, out: r.stdout + r.stderr };
}
const state = root => JSON.parse(fs.readFileSync(path.join(root, ".sprint-state.json"), "utf8"));
const write = (root, f, v) => { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), typeof v === "string" ? v : JSON.stringify(v)); };
const showcase = (root, name) => write(root, `.sprint/showcase-${name}.json`, { url: "http://localhost:5173", timestamp: new Date().toISOString() });
function transcript(root, model) {
  write(root, "t.jsonl", [{ type: "user", message: {} }, { type: "assistant", message: { model } }].map(x => JSON.stringify(x)).join("\n"));
  return path.join(root, "t.jsonl");
}

test("advance is refused before the floor and allowed after it", () => {
  const early = project({ phase: 4, phaseStartedAt: ago(10) });
  const r = run(early, { args: ["advance"] });
  assert.strictEqual(r.code, 1); assert.match(r.out, /Phase 4 floor: 30 min left/);
  assert.strictEqual(state(early).phase, 4);

  const late = project({ phase: 4, phaseStartedAt: ago(41) }); showcase(late, "polish");
  assert.strictEqual(run(late, { args: ["advance"] }).code, 0);
  const s = state(late);
  assert.strictEqual(s.phase, 5); assert.ok(Date.now() - Date.parse(s.phaseStartedAt) < 60000, "new phase clock starts now");
});

test("Stop is blocked under the floor, at most maxFloorStopBlocks times", () => {
  const root = project({ phase: 4, phaseStartedAt: ago(5) });
  for (let i = 0; i < 3; i++) {
    const r = run(root, { input: { hook_event_name: "Stop" } });
    assert.strictEqual(r.code, 2); assert.match(r.out, /Next validation round/);
  }
  assert.strictEqual(run(root, { input: { hook_event_name: "Stop" } }).code, 0);
  const after = project({ phase: 4, phaseStartedAt: ago(42) });
  assert.strictEqual(run(after, { input: { hook_event_name: "Stop" } }).code, 0);
});

test("only the user's 'skip floor' lifts the floor", () => {
  const root = project({ phase: 4, phaseStartedAt: ago(2) }); showcase(root, "polish");
  const r = run(root, { input: { hook_event_name: "UserPromptSubmit", prompt: "skip floor" } });
  assert.match(r.out, /floor lifted/);
  assert.strictEqual(run(root, { args: ["advance"] }).code, 0);
});

test("ceiling: one OVER BUDGET notice per phase", () => {
  const root = project({ phase: 4, phaseStartedAt: ago(50) });
  const ev = { hook_event_name: "PostToolUse", tool_name: "Read", tool_input: {} };
  assert.match(run(root, { input: ev }).out, /OVER BUDGET.*Phase 4/);
  assert.doesNotMatch(run(root, { input: ev }).out, /OVER BUDGET/);
});

test("Discover gate needs 15 answered questions and 5 challenge rounds", () => {
  const root = project({ phase: 1, phaseStartedAt: ago(26) });
  for (const f of ["SPRINT.md", "PRODUCT.md", "DESIGN.md"]) write(root, f, "x");
  write(root, "fixtures/golden.json", "{}");
  write(root, ".sprint/preflight.json", { routerSmoke: { exitCode: 0 }, services: [] });
  write(root, ".sprint/user-asks.json", []);
  const q = n => Array.from({ length: n }, (_, i) => ({ q: `q${i}`, answer: `a${i}` }));
  const rounds = n => Array.from({ length: n }, () => ({ claim: "c", attack: "a", verdict: "kept" }));

  write(root, ".sprint/discover-log.json", { userQuestions: [...q(14), { q: "unanswered", answer: "" }], challengeRounds: rounds(4) });
  const r = run(root, { args: ["advance"] });
  assert.strictEqual(r.code, 1); assert.match(r.out, /14\/15 answered/); assert.match(r.out, /4\/5 self-challenge/);

  write(root, ".sprint/discover-log.json", { userQuestions: q(15), challengeRounds: rounds(5) });
  assert.strictEqual(run(root, { args: ["advance"] }).code, 0);
  assert.strictEqual(state(root).phase, 2);
});

test("sprint start needs Opus 5.5 high and pins it in settings.local.json", () => {
  const root = project();
  write(root, ".claude/settings.local.json", { permissions: { allow: ["Bash(ls)"] } });
  const start = t => ({ hook_event_name: "UserPromptSubmit", prompt: "start a sprint for x", transcript_path: t });

  const sonnet = run(root, { input: start(transcript(root, "claude-sonnet-5-5")) });
  assert.strictEqual(sonnet.code, 2); assert.match(sonnet.out, /model is claude-sonnet-5-5/);
  assert.ok(!fs.existsSync(path.join(root, ".sprint-state.json")), "no sprint started");
  const pinned = JSON.parse(fs.readFileSync(path.join(root, ".claude/settings.local.json"), "utf8"));
  assert.deepStrictEqual(pinned, { permissions: { allow: ["Bash(ls)"] }, model: "claude-opus-5-5", effortLevel: "high" });

  const medium = run(root, { input: start(transcript(root, "claude-opus-5-5")), env: { CLAUDE_CODE_EFFORT_LEVEL: "medium" } });
  assert.strictEqual(medium.code, 2); assert.match(medium.out, /effort is medium/);

  const ok = run(root, { input: start(transcript(root, "claude-opus-5-5")) });
  assert.strictEqual(ok.code, 0); assert.match(ok.out, /window 25-30 min/);
  const s = state(root); assert.strictEqual(s.phase, 1); assert.ok(s.phaseStartedAt);
});

test("router guard blocks direct executor runs with no sprint active, and allows the router and AB_DIRECT", () => {
  const root = project();
  const pre = command => run(root, { input: { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command } } });
  const blocked = pre('agy -p "build it"');
  assert.strictEqual(blocked.code, 2); assert.match(blocked.out, /use the router/);
  assert.strictEqual(pre("opencode run fix").code, 2);
  assert.strictEqual(pre('AB_DIRECT=1 agy -p "say ok"').code, 0);
  assert.strictEqual(pre("node ~/.claude/bin/ab-route.js --status").code, 0);
  assert.strictEqual(pre("ls").code, 0);
});

test("wtf prompts are logged as the user's own, frustrated ones as auto, neutral ones not at all", () => {
  const root = project({ phase: 2, startedAt: ago(20), phaseStartedAt: ago(5) });
  const say = prompt => run(root, { input: { hook_event_name: "UserPromptSubmit", prompt, transcript_path: path.join(root, "t.jsonl") } });
  say("wtf the build takes forever"); say("why does the import fail"); say("looks good, continue");
  const g = state(root).gripes;
  assert.deepStrictEqual(g.map(x => [x.kind, x.phase, x.text]), [["wtf", 2, "wtf the build takes forever"], ["auto", 2, "why does the import fail"]]);
  assert.deepStrictEqual(state(root).transcripts, [path.join(root, "t.jsonl")]);
});

test("end sprint closes the sprint and writes SPRINT-REPORT.md with quotes, interrupts and phase times", () => {
  const root = project({ phase: 2, startedAt: ago(40), phaseStartedAt: ago(10),
    phaseLog: [{ phase: 1, startedAt: ago(40), endedAt: ago(10) }],
    gripes: [{ ts: ago(8), phase: 2, kind: "wtf", text: "wtf agy stalled again" }] });
  write(root, "t.jsonl", [
    { type: "user", timestamp: ago(30), message: { content: [{ type: "text", text: "[Request interrupted by user]" }] } },
    { type: "user", timestamp: ago(5), message: { content: "[Request interrupted by user for tool use]" } },
  ].map(x => JSON.stringify(x)).join("\n"));
  const r = run(root, { input: { hook_event_name: "UserPromptSubmit", prompt: "end sprint", transcript_path: path.join(root, "t.jsonl") } });
  assert.strictEqual(r.code, 0); assert.match(r.out, /Sprint ended at Phase 2\/6/);
  assert.strictEqual(state(root).active, false);
  const md = fs.readFileSync(path.join(root, "SPRINT-REPORT.md"), "utf8");
  assert.match(md, /status: \*\*ended early by you\*\*/);
  assert.match(md, /\[P2 backend, \d\d:\d\d\] wtf agy stalled again/);
  assert.match(md, /Interrupts \(Esc\): 2/); assert.match(md, /- P1 discover: 1/); assert.match(md, /- P2 backend: 1/);
  assert.match(md, /\| P1 discover \| 30 \| 30 \|/);
  assert.strictEqual(fs.readdirSync(path.join(root, "reports")).length, 1);
});

test("advance writes the report and counts blocks from this sprint as friction", () => {
  const root = project({ phase: 4, startedAt: ago(60), phaseStartedAt: ago(60) });
  write(root, "src/app.tsx", "x"); showcase(root, "polish");
  run(root, { input: { hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: path.join(root, "src/app.tsx") } } });
  assert.strictEqual(run(root, { args: ["advance"] }).code, 0);
  const md = fs.readFileSync(path.join(root, "SPRINT-REPORT.md"), "utf8");
  assert.match(md, /status: \*\*in progress\*\*/);
  assert.match(md, /\| P4 polish \| 60 \| 45 \| \*\*over\*\* \|/);
  assert.match(md, /\| 4 \| block \| \[BLOCKED\] Phase 4\/6 \(polish\): call Skill\(phase-polish\) before editing code\. \| 1 \|/);
});

const ask = (root, n) => run(root, { input: { hook_event_name: "PostToolUse", tool_name: "AskUserQuestion", tool_input: { questions: Array.from({ length: n }, (_, i) => ({ question: `q${i}` })) } } });

test("per-phase question gate: 14 answered questions refuse advance, 15 allow it, in any phase", () => {
  // Phase 4 (floor and showcase already satisfied) isolates the question count.
  const root = project({ phase: 4, phaseStartedAt: ago(41), questionsByPhase: { 3: 15 } }); showcase(root, "polish");
  for (const n of [4, 4, 4, 2]) assert.strictEqual(ask(root, n).code, 0); // 14, counted into the current phase only
  assert.deepStrictEqual(state(root).questionsByPhase, { 3: 15, 4: 14 });
  const refused = run(root, { args: ["advance"] });
  assert.strictEqual(refused.code, 1); assert.match(refused.out, /Phase 4 user questions: 14.15/);
  assert.strictEqual(state(root).phase, 4);

  ask(root, 1);
  assert.strictEqual(state(root).questionsByPhase[4], 15);
  assert.strictEqual(run(root, { args: ["advance"] }).code, 0);
  assert.strictEqual(state(root).phase, 5);
  assert.match(run(root, { args: ["advance"] }).out, /Phase 5 user questions: 0.15/); // the 15 do not carry over
});

test("showcase gate (phases 3, 4): needs url + timestamp from this phase; stale or missing is refused", () => {
  const root = project({ phase: 3, phaseStartedAt: ago(71) });
  write(root, ".sprint/phase3-proof.json", { screenshot: "shot.png", axeViolations: 0 }); write(root, "shot.png", "x");
  assert.match(run(root, { args: ["advance"] }).out, /showcase-frontend.json/);
  write(root, ".sprint/showcase-frontend.json", { url: "http://localhost:5173", timestamp: ago(80) });
  assert.match(run(root, { args: ["advance"] }).out, /showcase-frontend.json/);
  showcase(root, "frontend");
  assert.strictEqual(run(root, { args: ["advance"] }).code, 0);
});

function phase1Ready() {
  const root = project({ phase: 1, phaseStartedAt: ago(26) });
  for (const f of ["SPRINT.md", "PRODUCT.md", "DESIGN.md"]) write(root, f, "x");
  write(root, "fixtures/golden.json", "{}");
  const userQuestions = Array.from({ length: 15 }, (_, i) => ({ q: `q${i}`, answer: `a${i}` }));
  const challengeRounds = Array.from({ length: 5 }, () => ({ claim: "c", attack: "a", verdict: "kept" }));
  write(root, ".sprint/discover-log.json", { userQuestions, challengeRounds });
  write(root, ".sprint/user-asks.json", []);
  return root;
}

test("Phase 1 advance is refused when preflight.json is missing", () => {
  const root = phase1Ready();
  const r = run(root, { args: ["advance"] });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /preflight\.json/);
  assert.strictEqual(state(root).phase, 1);
});

test("Phase 1 advance is refused on cut service without userConfirmed or nonzero routerSmoke without waiver", () => {
  const root = phase1Ready();
  write(root, ".sprint/preflight.json", {
    routerSmoke: { exitCode: 2 },
    services: [{ name: "OpenAI key", status: "cut", userConfirmed: false }, { name: "X", status: "pending" }],
  });
  const r = run(root, { args: ["advance"] });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /routerSmoke: exit 2 and no user waiver/);
  assert.match(r.out, /'OpenAI key' is cut without userConfirmed true/);
  assert.match(r.out, /'X' status must be ok or cut/);
  assert.strictEqual(state(root).phase, 1);
});

test("Phase 1 advance is allowed with valid preflight.json (exitCode 0 or waiver, ok or confirmed cut services)", () => {
  const root = phase1Ready();
  write(root, ".sprint/preflight.json", {
    routerSmoke: { exitCode: 0 },
    services: [{ name: "Earth Engine login", status: "ok", userConfirmed: false }, { name: "OpenAI key", status: "cut", userConfirmed: true }],
  });
  assert.strictEqual(run(root, { args: ["advance"] }).code, 0);
  assert.strictEqual(state(root).phase, 2);

  const waived = phase1Ready();
  write(waived, ".sprint/preflight.json", { routerSmoke: { exitCode: 2, waivedByUser: true, reason: "offline" }, services: [] });
  assert.strictEqual(run(waived, { args: ["advance"] }).code, 0);
  assert.strictEqual(state(waived).phase, 2);
});

test("user-asks ledger: unconfirmed cut blocks any phase, confirmed cut allows it, open asks print on refusal, success, and report", () => {
  const root = project({ phase: 4, phaseStartedAt: ago(41) }); showcase(root, "polish");
  write(root, ".sprint/user-asks.json", [
    { ask: "3D explainer", phase: 3, status: "cut", userConfirmedCut: false },
    { ask: "InVEST", phase: 2, status: "planned", userConfirmedCut: false },
  ]);
  const refused = run(root, { args: ["advance"] });
  assert.strictEqual(refused.code, 1);
  assert.match(refused.out, /'3D explainer' was cut without the user confirming/);
  assert.match(refused.out, /Open user asks: InVEST \(P2\)/);
  assert.strictEqual(state(root).phase, 4);

  write(root, ".sprint/user-asks.json", [
    { ask: "3D explainer", phase: 3, status: "cut", userConfirmedCut: true },
    { ask: "InVEST", phase: 2, status: "planned", userConfirmedCut: false },
  ]);
  const ok = run(root, { args: ["advance"] });
  assert.strictEqual(ok.code, 0);
  assert.match(ok.out, /Open user asks: InVEST \(P2\)/);
  assert.strictEqual(state(root).phase, 5);
  assert.match(fs.readFileSync(path.join(root, "SPRINT-REPORT.md"), "utf8"), /Open user asks: InVEST \(P2\)/);
});

test("Phase 1 advance is refused when user-asks.json is missing or invalid", () => {
  const root = phase1Ready();
  write(root, ".sprint/preflight.json", { routerSmoke: { exitCode: 0 }, services: [] });
  fs.unlinkSync(path.join(root, ".sprint", "user-asks.json"));
  const missing = run(root, { args: ["advance"] });
  assert.strictEqual(missing.code, 1);
  assert.match(missing.out, /user-asks\.json missing/);
  assert.strictEqual(state(root).phase, 1);

  write(root, ".sprint/user-asks.json", [{ ask: "Bad ask", phase: 1, status: "bogus" }]);
  const badStatus = run(root, { args: ["advance"] });
  assert.strictEqual(badStatus.code, 1);
  assert.match(badStatus.out, /'Bad ask' status must be planned, done, or cut/);
});
