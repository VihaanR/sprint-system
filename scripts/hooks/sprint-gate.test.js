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
  gates: { phaseFloorLeadMin: 5, maxFloorStopBlocks: 3, discoverMinUserQuestions: 15, discoverMinChallengeRounds: 5 },
};
const ago = min => new Date(Date.now() - min * 60000).toISOString();

function project(state) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sprint-gate-"));
  fs.mkdirSync(path.join(root, "home"));
  fs.writeFileSync(path.join(root, "sprint.config.json"), JSON.stringify(CFG));
  if (state) fs.writeFileSync(path.join(root, ".sprint-state.json"), JSON.stringify({ active: true, skillsLoaded: [], ...state }));
  return root;
}
function run(root, { args = [], input, env = {} } = {}) {
  const e = { ...process.env, USERPROFILE: path.join(root, "home"), HOME: path.join(root, "home"), CLAUDE_PROJECT_DIR: root, ...env };
  delete e.CLAUDE_CODE_EFFORT_LEVEL; Object.assign(e, env);
  const r = spawnSync(process.execPath, [GATE, ...args], { cwd: root, env: e, input: input ? JSON.stringify(input) : "", encoding: "utf8" });
  return { code: r.status, out: r.stdout + r.stderr };
}
const state = root => JSON.parse(fs.readFileSync(path.join(root, ".sprint-state.json"), "utf8"));
const write = (root, f, v) => { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), typeof v === "string" ? v : JSON.stringify(v)); };
function transcript(root, model) {
  write(root, "t.jsonl", [{ type: "user", message: {} }, { type: "assistant", message: { model } }].map(x => JSON.stringify(x)).join("\n"));
  return path.join(root, "t.jsonl");
}

test("advance is refused before the floor and allowed after it", () => {
  const early = project({ phase: 4, phaseStartedAt: ago(10) });
  const r = run(early, { args: ["advance"] });
  assert.strictEqual(r.code, 1); assert.match(r.out, /Phase 4 floor: 30 min left/);
  assert.strictEqual(state(early).phase, 4);

  const late = project({ phase: 4, phaseStartedAt: ago(41) });
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
  const root = project({ phase: 4, phaseStartedAt: ago(2) });
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
