"use strict";
// node --test bin/ab-route.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), os = require("os"), path = require("path");
const { spawnSync } = require("child_process");
const { runChild, cooldownMin, mainSnapshot } = require("./ab-route.js");

const SILENT_MS = 900000, STARTUP_MS = 180000, HARD_MS = 60000;
const HEADER = "▶ antigravity ← task t1\n  workspace: W  (sandbox workspace-write, transport cli)\n  status file Claude reads:  S\n";
const wait = ms => new Promise(r => setTimeout(r, ms));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "ab-route-test-"));

// Spawn a fake agy (node child) under a test-controlled clock; `state.t` is the fake now, `state.res` the result once settled.
function fakeAgy(script) {
  const dir = tmp(), log = path.join(dir, "run.log"), state = { t: 0, res: null };
  const p = runChild(process.execPath, ["-e", script], dir, log, SILENT_MS, STARTUP_MS, HARD_MS, { clock: () => state.t, tickMs: 10 });
  p.then(r => { state.res = r; });
  return { state, log, p };
}
async function untilLogHas(log, s) {
  for (let i = 0; i < 500 && !(fs.existsSync(log) && fs.readFileSync(log, "utf8").includes(s)); i++) await wait(10);
}

test("silent live agy is not killed before agySilentMs, and is killed after it", async () => {
  const { state, log, p } = fakeAgy(`process.stdout.write(${JSON.stringify(HEADER)}); setTimeout(() => {}, 30000)`);
  await untilLogHas(log, "status file");
  for (const t of [241000, 331000, 600000, SILENT_MS - 1000]) { // the old 240 s stall and 180 s startup kills
    state.t = t; await wait(150);
    assert.strictEqual(state.res, null, `killed at fake ${t / 1000}s`);
  }
  state.t = SILENT_MS + 1000;
  const r = await p;
  assert.strictEqual(r.why, "stall");
  assert.strictEqual(r.code, null);
});

test("queued state within the startup limit is not killed; past it is a startup-stall", async () => {
  const { state, p } = fakeAgy("setTimeout(() => {}, 30000)"); // no output at all: agent-bridge never got going
  await wait(300);
  state.t = STARTUP_MS - 10000; await wait(150);
  assert.strictEqual(state.res, null, "killed inside the startup limit");
  state.t = STARTUP_MS + 1000;
  const r = await p;
  assert.strictEqual(r.why, "startup-stall");
});

test("agy that exits with only agent-bridge framing is a startup-stall; real output is not", async () => {
  const a = await fakeAgy(`process.stdout.write(${JSON.stringify(HEADER + "── antigravity finished (exit 0) ──\n")})`).p;
  assert.strictEqual(a.why, "startup-stall");
  const b = await fakeAgy(`process.stdout.write(${JSON.stringify(HEADER + "[DONE] wrote it\n")})`).p;
  assert.strictEqual(b.why, null);
  assert.strictEqual(b.code, 0);
});

test("stall cooldown: first tolerated, second in a row trips, capped at 30 min", () => {
  const k = "antigravity:Gemini 4 Hydrogen (High)";
  assert.strictEqual(cooldownMin(k, { outcome: "startup-stall" }, null), 0);
  assert.strictEqual(cooldownMin(k, { outcome: "stall" }, "ok"), 0);
  assert.strictEqual(cooldownMin(k, { outcome: "startup-stall" }, "startup-stall"), 30);
  assert.strictEqual(cooldownMin(k, { outcome: "stall" }, "startup-stall"), 30);
  assert.strictEqual(cooldownMin(k, { outcome: "stall", resetMin: 600 }, "stall"), 30);
  assert.strictEqual(cooldownMin(k, { outcome: "quota" }, null), 300); // quota keeps its own cooldown
});

test("isolation snapshot ignores .claude/worktrees but sees a stray file", () => {
  const repo = tmp(), g = (...a) => spawnSync("git", a, { cwd: repo, encoding: "utf8" });
  g("init", "-q"); fs.writeFileSync(path.join(repo, "a.txt"), "a\n");
  g("add", "a.txt"); g("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init");
  const before = mainSnapshot(repo);
  fs.mkdirSync(path.join(repo, ".claude", "worktrees", "agent-x"), { recursive: true });
  fs.writeFileSync(path.join(repo, ".claude", "worktrees", "agent-x", "f.txt"), "x\n");
  assert.strictEqual(mainSnapshot(repo), before);
  fs.writeFileSync(path.join(repo, "stray.txt"), "s\n");
  assert.notStrictEqual(mainSnapshot(repo), before);
});
