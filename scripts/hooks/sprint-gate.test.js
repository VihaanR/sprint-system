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
const designOk = (root, p) => {
  write(root, `.sprint/impeccable-critique-p${p}.md`, "# Critique\nClean.");
  write(root, `.sprint/screens-p${p}/desktop.png`, "png");
  write(root, `.sprint/screens-p${p}/mobile-375.png`, "png");
};
function transcript(root, model) {
  write(root, "t.jsonl", [{ type: "user", message: {} }, { type: "assistant", message: { model } }].map(x => JSON.stringify(x)).join("\n"));
  return path.join(root, "t.jsonl");
}

test("advance is refused before the floor and allowed after it", () => {
  const early = project({ phase: 4, phaseStartedAt: ago(10) });
  const r = run(early, { args: ["advance"] });
  assert.strictEqual(r.code, 1); assert.match(r.out, /Phase 4 floor: 30 min left/);
  assert.strictEqual(state(early).phase, 4);

  const late = project({ phase: 4, phaseStartedAt: ago(41) }); showcase(late, "polish"); designOk(late, 4);
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
  const root = project({ phase: 4, phaseStartedAt: ago(2) }); showcase(root, "polish"); designOk(root, 4);
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
  write(root, "src/app.tsx", "x"); showcase(root, "polish"); designOk(root, 4);
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
  const root = project({ phase: 4, phaseStartedAt: ago(41), questionsByPhase: { 3: 15 } }); showcase(root, "polish"); designOk(root, 4);
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
  showcase(root, "frontend"); designOk(root, 3);
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
  const root = project({ phase: 4, phaseStartedAt: ago(41) }); showcase(root, "polish"); designOk(root, 4);
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

test("design exit gate (Phase 4): refuses on all 5 checks and passes once all 5 are fixed", () => {
  const root = project({ phase: 4, phaseStartedAt: ago(41) });
  showcase(root, "polish");
  const starter = path.join(root, "starter");
  write(starter, "frontend/public/favicon.svg", "<svg>starter</svg>");
  write(root, ".sprint/screens-p4/desktop.png", "png");
  write(root, "frontend/src/index.css", 'body { font-family: "Fraunces", serif; }');
  write(root, "frontend/index.html", "<html><head><title>Vite + React</title></head></html>");
  write(root, "frontend/public/favicon.svg", "<svg>starter</svg>");

  const env = { SPRINT_STARTER_DIR: starter };
  const bad = run(root, { args: ["advance"], env });
  assert.strictEqual(bad.code, 1);
  const lines = bad.out.trim().split("\n").filter(l => l.startsWith("- "));
  assert.strictEqual(lines.length, 5);
  assert.match(bad.out, /impeccable-critique-p4\.md/);
  assert.match(bad.out, /screens-p4\/ missing 375px/);
  assert.match(bad.out, /fonts not loaded.*: Fraunces/);
  assert.match(bad.out, /<title>.*Vite \+ React/);
  assert.match(bad.out, /favicon\.svg is still the starter default/);
  assert.strictEqual(state(root).phase, 4);

  write(root, ".sprint/impeccable-critique-p4.md", "# Critique\nSpacing and contrast checked.");
  write(root, ".sprint/screens-p4/mobile-375.png", "png");
  write(root, "frontend/src/index.css", '@import "@fontsource/fraunces";\nbody { font-family: "Fraunces", serif; }');
  write(root, "frontend/index.html", "<html><head><title>Watershed Pulse</title></head></html>");
  write(root, "frontend/public/favicon.svg", "<svg>custom</svg>");

  const ok = run(root, { args: ["advance"], env });
  assert.strictEqual(ok.code, 0);
  assert.strictEqual(state(root).phase, 5);
});

test("design exit gate (Phase 3 + font variants): accepts @font-face, @fontsource-variable, OS fonts, var(), ignores node_modules", () => {
  const root = project({ phase: 3, phaseStartedAt: ago(71) });
  showcase(root, "frontend");
  write(root, ".sprint/phase3-proof.json", { screenshot: "shot.png", axeViolations: 0 });
  write(root, "shot.png", "x");
  write(root, "frontend/src/node_modules/pkg/bad.css", 'x { font-family: "UnloadedFromPkg"; }');
  write(root, "frontend/src/main.tsx", 'import "@fontsource-variable/inter-tight";\n');
  write(root, "frontend/src/styles/app.css", [
    '@font-face { font-family: "JetBrains Mono"; src: url("/jb.woff2"); }',
    'body { font-family: "Inter Tight", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif; }',
    'code { font-family: "JetBrains Mono", Menlo, Consolas, Monaco, var(--mono), ui-monospace, monospace; }',
  ].join("\n"));

  const refused = run(root, { args: ["advance"] });
  assert.strictEqual(refused.code, 1);
  assert.match(refused.out, /impeccable-critique-p3\.md/);
  assert.match(refused.out, /screens-p3\/ missing desktop and 375px/);
  assert.doesNotMatch(refused.out, /fonts not loaded/);

  designOk(root, 3);
  assert.strictEqual(run(root, { args: ["advance"] }).code, 0);
  assert.strictEqual(state(root).phase, 4);
});

test("design exit gate: fonts named in CSS custom properties (--font-*) must load too; size/weight tokens are ignored", () => {
  const root = project({ phase: 4, phaseStartedAt: ago(41) }); showcase(root, "polish"); designOk(root, 4);
  write(root, "frontend/src/index.css", ':root { --font-ui: "Inter", system-ui, sans-serif; --font-mono: "JetBrains Mono", monospace; --font-size: 14px; --font-weight-bold: 700; }\nbody { font: 14px/1.45 var(--font-ui); }');
  const r = run(root, { args: ["advance"] });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /fonts not loaded.*: Inter, JetBrains Mono$/m);
  write(root, "frontend/src/main.tsx", 'import "@fontsource/inter";\nimport "@fontsource/jetbrains-mono";\n');
  assert.strictEqual(run(root, { args: ["advance"] }).code, 0);
});

test("Phase 4 floor Stop starts with /impeccable critique and never yields golden hand-check", () => {
  const root = project({ phase: 4, phaseStartedAt: ago(5) });
  write(root, "sprint.config.json", { ...CFG, gates: { ...CFG.gates, maxFloorStopBlocks: 10 } });
  const outs = Array.from({ length: 10 }, () => {
    const r = run(root, { input: { hook_event_name: "Stop" } });
    assert.strictEqual(r.code, 2);
    assert.doesNotMatch(r.out, /golden/i);
    return r.out;
  });
  assert.match(outs[0], /\/impeccable critique.*\.sprint\/screens-p4\//);
  assert.match(outs[1], /compare the build against DESIGN\.md/);
});

test("Phase 1 and 2 floor Stops can yield golden hand-check and never yield impeccable critique", () => {
  for (const phase of [1, 2]) {
    const root = project({ phase, phaseStartedAt: ago(5) });
    write(root, "sprint.config.json", { ...CFG, phases: { ...CFG.phases, 2: { budgetMin: 60 } }, gates: { ...CFG.gates, maxFloorStopBlocks: 10 } });
    const outs = Array.from({ length: 10 }, () => {
      const r = run(root, { input: { hook_event_name: "Stop" } });
      assert.strictEqual(r.code, 2);
      assert.doesNotMatch(r.out, /impeccable critique/i);
      return r.out;
    });
    assert.ok(outs.some(o => /check one golden expected output/.test(o)), `Phase ${phase} should yield golden hand-check`);
  }
});

test("AskUserQuestion counts only non-empty answers in tool_response.answers and accumulates", () => {
  const root = project({ phase: 2, phaseStartedAt: ago(10), lastActivityAt: new Date().toISOString(), questionsByPhase: {} });
  const qInput = [
    { question: "Auth mode?", header: "Auth", options: [], multiSelect: false },
    { question: "DB engine?", header: "DB", options: [], multiSelect: false },
    { question: "Theme?", header: "UI", options: [], multiSelect: false },
  ];
  const ev1 = {
    hook_event_name: "PostToolUse",
    tool_name: "AskUserQuestion",
    tool_input: { questions: qInput },
    tool_response: { questions: qInput, answers: { "Auth mode?": "JWT", "DB engine?": "", "Theme?": "Dark" } },
  };
  assert.strictEqual(run(root, { input: ev1 }).code, 0);
  assert.strictEqual(state(root).questionsByPhase[2], 2);

  const ev2 = {
    hook_event_name: "PostToolUse",
    tool_name: "AskUserQuestion",
    tool_input: { questions: [{ question: "Deploy target?", header: "Ops", options: [], multiSelect: false }] },
    tool_response: { questions: [{ question: "Deploy target?" }], answers: { "Deploy target?": "Vercel" } },
  };
  assert.strictEqual(run(root, { input: ev2 }).code, 0);
  assert.strictEqual(state(root).questionsByPhase[2], 3);
});

test("preEdit blocks main checkout when live route worktree exists, but allows .claude/worktrees/", (t) => {
  const root = project({ phase: 2, phaseStartedAt: ago(10), lastActivityAt: new Date().toISOString(), skillsLoaded: ["phase-backend"] });
  for (const f of ["SPRINT.md", "PRODUCT.md", "DESIGN.md"]) write(root, f, "x");
  write(root, "fixtures/golden.json", "{}");
  write(root, "src/a.js", "export const a = 1;\n");
  write(root, ".claude/worktrees/agent-1/notes.txt", "notes\n");
  write(root, ".claude/worktrees/agent-1/src/a.js", "export const b = 2;\n");

  const git = (args, cwd = root) => {
    const r = spawnSync("git", args, { cwd, encoding: "utf8" });
    assert.strictEqual(r.status, 0, `git ${args.join(" ")} failed: ${r.stderr}`);
  };
  git(["init"]);
  git(["config", "user.email", "test@example.com"]);
  git(["config", "user.name", "Test"]);
  git(["add", "."]);
  git(["commit", "-m", "init"]);

  const wtDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "sprint-wt-")), "route-x");
  t.after(() => fs.rmSync(path.dirname(wtDir), { recursive: true, force: true }));
  git(["worktree", "add", "-b", "route/x", wtDir]);

  const blocked = run(root, { input: { hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: path.join(root, "src/a.js") } } });
  assert.strictEqual(blocked.code, 2);
  assert.match(blocked.out, /Router worktree/);

  const agentNotes = run(root, { input: { hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: path.join(root, ".claude/worktrees/agent-1/notes.txt") } } });
  assert.strictEqual(agentNotes.code, 0);

  write(root, ".sprint-state.json", { active: true, phase: 2, phaseStartedAt: ago(10), lastActivityAt: new Date().toISOString(), skillsLoaded: [], questionsByPhase: { 2: 15 } });
  const skillBlocked = run(root, { input: { hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: path.join(root, ".claude/worktrees/agent-1/src/a.js") } } });
  assert.strictEqual(skillBlocked.code, 2);
  assert.match(skillBlocked.out, /Skill\(phase-backend\)/);
});

test("pauseClock skips pause while inFlight tool is younger than cap, clears on PostToolUse, and records pause when idle or stale", () => {
  const busy = project({
    phase: 2,
    startedAt: ago(30),
    phaseStartedAt: ago(30),
    lastActivityAt: ago(22),
    inFlight: { "tool-1": ago(22) },
  });
  assert.strictEqual(run(busy, { input: { hook_event_name: "PostToolUse", tool_name: "Bash", tool_use_id: "tool-1", tool_input: { command: "npm test" } } }).code, 0);
  const bs = state(busy);
  assert.strictEqual((bs.pauses || []).length, 0);
  assert.deepStrictEqual(bs.inFlight, {});

  const idle = project({ phase: 2, startedAt: ago(30), phaseStartedAt: ago(30), lastActivityAt: ago(22) });
  assert.strictEqual(run(idle, { input: { hook_event_name: "PostToolUse", tool_name: "Read", tool_input: {} } }).code, 0);
  const is = state(idle);
  assert.strictEqual(is.pauses.length, 1);
  assert.strictEqual(is.pauses[0].phase, 2);

  const pre = project({ phase: 2, startedAt: ago(50), phaseStartedAt: ago(50), lastActivityAt: ago(22), inFlight: { "dead-1": ago(40) } });
  assert.strictEqual(run(pre, { input: { hook_event_name: "PreToolUse", tool_name: "Read", tool_use_id: "live-2", tool_input: {} } }).code, 0);
  const ps = state(pre);
  assert.strictEqual(ps.pauses.length, 1);
  assert.strictEqual(ps.inFlight["dead-1"], undefined);
  assert.ok(ps.inFlight["live-2"]);
  assert.strictEqual(run(pre, { input: { hook_event_name: "PostToolUseFailure", tool_name: "Read", tool_use_id: "live-2", error: "boom" } }).code, 0);
  assert.deepStrictEqual(state(pre).inFlight, {});
});

test("pauses never shift startedAt/phaseStartedAt; phaseWindow and report subtract phase pauses while showcase checks real start", () => {
  const root = project({
    phase: 4,
    startedAt: ago(50),
    phaseStartedAt: ago(50),
    lastActivityAt: new Date().toISOString(),
    pauses: [{ from: ago(30), to: ago(10), min: 20, phase: 4 }],
  });
  designOk(root, 4);
  write(root, ".sprint/showcase-polish.json", { url: "http://localhost:5173", timestamp: ago(45) });
  const r = run(root, { args: ["advance"] });
  assert.strictEqual(r.code, 1);
  assert.doesNotMatch(r.out, /showcase-polish\.json/);
  assert.match(r.out, /Phase 4 floor: 10 min left/);

  const origStart = ago(40), origPhaseStart = ago(35);
  const pRoot = project({ phase: 2, startedAt: origStart, phaseStartedAt: origPhaseStart, lastActivityAt: ago(20) });
  assert.strictEqual(run(pRoot, { input: { hook_event_name: "PostToolUse", tool_name: "Read", tool_input: {} } }).code, 0);
  const ps = state(pRoot);
  assert.strictEqual(ps.startedAt, origStart);
  assert.strictEqual(ps.phaseStartedAt, origPhaseStart);
  assert.strictEqual(ps.pauses.length, 1);
  assert.strictEqual(ps.pauses[0].phase, 2);

  assert.strictEqual(run(pRoot, { input: { hook_event_name: "UserPromptSubmit", prompt: "end sprint" } }).code, 0);
  const md = fs.readFileSync(path.join(pRoot, "SPRINT-REPORT.md"), "utf8");
  assert.match(md, /\| P2 backend \| 15 \| - \|/);
});

test("saveState writes valid JSON with no .tmp left; pauseClock skips write within 60s when nothing changed and updates after 60s", () => {
  const recentTs = new Date(Date.now() - 10000).toISOString();
  const root = project({ phase: 4, startedAt: ago(10), phaseStartedAt: ago(10), lastActivityAt: recentTs });
  const stateFile = path.join(root, ".sprint-state.json");
  const before = fs.readFileSync(stateFile, "utf8");

  assert.strictEqual(run(root, { input: { hook_event_name: "PostToolUse", tool_name: "Read", tool_input: {} } }).code, 0);
  assert.strictEqual(fs.readFileSync(stateFile, "utf8"), before);
  assert.strictEqual(fs.readdirSync(root).filter(f => f.endsWith(".tmp")).length, 0);

  const staleTs = ago(2);
  write(root, ".sprint-state.json", { active: true, phase: 4, startedAt: ago(10), phaseStartedAt: ago(10), lastActivityAt: staleTs, skillsLoaded: [], questionsByPhase: { 4: 15 } });
  assert.strictEqual(run(root, { input: { hook_event_name: "PostToolUse", tool_name: "Read", tool_input: {} } }).code, 0);
  const updated = state(root);
  assert.ok(Date.parse(updated.lastActivityAt) > Date.parse(staleTs));
  assert.strictEqual(fs.readdirSync(root).filter(f => f.endsWith(".tmp")).length, 0);
});
