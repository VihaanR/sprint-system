"use strict";
// node --test bin/ab-route.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), os = require("os"), path = require("path");
const { spawnSync } = require("child_process");
const { runChild, cooldownMin, mainSnapshot, newestConvMtime, guardrails, skipReason, sessionName } = require("./ab-route.js");

const IDLE_MS = 300000, SILENT_MS = 900000, STARTUP_MS = 180000, HARD_MS = 60000;
const HEADER = "▶ antigravity ← task t1\n  workspace: W  (sandbox workspace-write, transport cli)\n  status file Claude reads:  S\n";
const wait = ms => new Promise(r => setTimeout(r, ms));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "ab-route-test-"));

// Spawn a fake agy (node child) under a test-controlled clock; `state.t` is the fake now, `state.mtime` the conv folder mtime.
function fakeAgy(script, opts = {}) {
  const dir = tmp(), log = path.join(dir, "run.log"), state = { t: 0, mtime: 0, res: null };
  const p = runChild(process.execPath, ["-e", script], dir, log, IDLE_MS, STARTUP_MS, HARD_MS, {
    clock: () => state.t, tickMs: 10, convMtime: () => state.mtime, maxSilentMs: SILENT_MS, ...opts,
  });
  p.then(r => { state.res = r; });
  return { state, log, p };
}
async function untilLogHas(log, s) {
  for (let i = 0; i < 500 && !(fs.existsSync(log) && fs.readFileSync(log, "utf8").includes(s)); i++) await wait(10);
}

test("silent live agy is not killed before agySilentMs while conv writes arrive, and is killed after it", async () => {
  const { state, log, p } = fakeAgy(`process.stdout.write(${JSON.stringify(HEADER)}); setTimeout(() => {}, 30000)`);
  await untilLogHas(log, "status file");
  for (const t of [241000, 331000, 600000, SILENT_MS - 1000]) { // the old 240 s stall and 180 s startup kills
    state.t = t; state.mtime = t; await wait(150);
    assert.strictEqual(state.res, null, `killed at fake ${t / 1000}s`);
  }
  state.t = SILENT_MS + 1000;
  const r = await p;
  assert.strictEqual(r.why, "stall");
  assert.strictEqual(r.code, null);
});

test("alive agy with folder writes past 5 min is not killed and logs conversation activity", async () => {
  const { state, log, p } = fakeAgy(`process.stdout.write(${JSON.stringify(HEADER)}); setTimeout(() => {}, 30000)`);
  await untilLogHas(log, "status file");
  state.t = 212000; state.mtime = 200000; await wait(150);
  assert.strictEqual(state.res, null);
  assert.match(fs.readFileSync(log, "utf8"), /agy active 12s ago/);
  state.t = IDLE_MS + 100000; state.mtime = IDLE_MS + 95000; await wait(150); // past 5 min (400s)
  assert.strictEqual(state.res, null, "killed past 5 min despite folder writes");
  state.t = IDLE_MS + 100000 + IDLE_MS + 1000; // now idle for > 5 min
  const r = await p;
  assert.strictEqual(r.why, "stall");
});

test("alive agy with no folder writes for 5 min stalls", async () => {
  const { state, log, p } = fakeAgy(`process.stdout.write(${JSON.stringify(HEADER)}); setTimeout(() => {}, 30000)`);
  await untilLogHas(log, "status file");
  state.t = IDLE_MS - 1000; await wait(150);
  assert.strictEqual(state.res, null, "killed before agyIdleMs");
  state.t = IDLE_MS + 1000;
  const r = await p;
  assert.strictEqual(r.why, "stall");
  assert.strictEqual(r.code, null);
});

test("newestConvMtime tracks *.db, *.db-wal, *.db-shm and ignores unrelated files", () => {
  const dir = tmp();
  assert.strictEqual(newestConvMtime(dir), 0);
  const wal = path.join(dir, "c1.db-wal"), txt = path.join(dir, "note.txt");
  fs.writeFileSync(wal, "w"); fs.utimesSync(wal, 100, 100);
  fs.writeFileSync(txt, "t"); fs.utimesSync(txt, 500, 500);
  assert.strictEqual(newestConvMtime(dir), 100000);
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

test("isolation snapshot sees a stray commit in the main checkout", () => {
  const repo = tmp(), g = (...a) => spawnSync("git", a, { cwd: repo, encoding: "utf8" });
  const commit = m => g("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", m);
  g("init", "-q"); fs.writeFileSync(path.join(repo, "a.txt"), "a\n"); g("add", "a.txt"); commit("init");
  const before = mainSnapshot(repo);
  fs.writeFileSync(path.join(repo, "a.txt"), "b\n"); g("add", "a.txt"); commit("stray");
  assert.notStrictEqual(mainSnapshot(repo), before);
});

function initRepo() {
  const repo = tmp(), g = (...a) => spawnSync("git", a, { cwd: repo, encoding: "utf8" });
  g("init", "-q");
  fs.writeFileSync(path.join(repo, "a.txt"), "a\n");
  g("add", "a.txt");
  g("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init");
  const baseSha = g("rev-parse", "HEAD").stdout.trim();
  return { repo, g, baseSha };
}

test("guardrails: committed-only work is detected and labeled committed", () => {
  const { repo, g, baseSha } = initRepo();
  fs.writeFileSync(path.join(repo, "b.txt"), "hello\n");
  g("add", "b.txt");
  g("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "work");
  const flags = [], stat = guardrails(repo, flags, baseSha);
  assert.match(stat, /1 file changed/);
  assert.match(stat, /\(committed\)$/);
  assert.ok(!flags.includes("no-changes"));
});

test("guardrails: staged-only work is detected and labeled staged", () => {
  const { repo, baseSha } = initRepo();
  fs.writeFileSync(path.join(repo, "a.txt"), "modified\n");
  const flags = [], stat = guardrails(repo, flags, baseSha);
  assert.match(stat, /1 file changed/);
  assert.match(stat, /\(staged\)$/);
  assert.ok(!flags.includes("no-changes"));
});

test("guardrails: nothing changed flags no-changes", () => {
  const { repo, baseSha } = initRepo();
  const flags = [], stat = guardrails(repo, flags, baseSha);
  assert.strictEqual(stat, "no changes");
  assert.ok(flags.includes("no-changes"));
});

test("guardrails: committed plus uncommitted work is labeled committed+staged", () => {
  const { repo, g, baseSha } = initRepo();
  fs.writeFileSync(path.join(repo, "a.txt"), "committed\n");
  g("add", "a.txt");
  g("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "work");
  fs.writeFileSync(path.join(repo, "b.txt"), "uncommitted\n");
  const flags = [], stat = guardrails(repo, flags, baseSha);
  assert.match(stat, /2 files changed/);
  assert.match(stat, /\(committed\+staged\)$/);
  assert.ok(!flags.includes("no-changes"));
});

test("sessionName is unique per task id and honors explicit --session", () => {
  const a = sessionName(undefined, 2, "large", "job-1", "sprint");
  const b = sessionName(undefined, 2, "large", "job-2", "sprint");
  assert.notStrictEqual(a, b);
  assert.ok(a.includes("job-1") && b.includes("job-2"));
  assert.strictEqual(sessionName("custom-s", 2, "large", "job-1", "sprint"), "custom-s");
  assert.strictEqual(sessionName(undefined, null, "large", "job-1", "sprint"), undefined);
});

test("skipReason returns parked reason for parked executors", () => {
  const h = { executors: {} };
  const hermesReason = skipReason(h, "hermes");
  const goReason = skipReason(h, "opencode:go");
  assert.ok(typeof hermesReason === "string" && hermesReason.length > 0);
  assert.match(hermesReason, /parked/i);
  assert.ok(typeof goReason === "string" && goReason.length > 0);
  assert.match(goReason, /parked/i);
});

test("runChild does not crash when output arrives after kill/finish", async () => {
  const childScript = `
    const { spawn } = require("child_process");
    const g = spawn(process.execPath, ["-e", "setTimeout(() => { setInterval(() => process.stdout.write('late\\\\n'), 10); setTimeout(() => process.exit(0), 200); }, 100)"], { detached: true, stdio: ["ignore", 1, 2] });
    g.unref();
    process.stdout.write(${JSON.stringify(HEADER)});
    setTimeout(() => {}, 30000);
  `;
  const { state, log, p } = fakeAgy(childScript);
  await untilLogHas(log, "status file");
  state.t = IDLE_MS + 1000;
  const r = await p;
  assert.strictEqual(r.why, "stall");
  await wait(350);
  assert.ok(!fs.readFileSync(log, "utf8").includes("late"), "wrote after finish");
});
