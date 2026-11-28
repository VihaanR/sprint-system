"use strict";
// node --test bin/ab-route.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), os = require("os"), path = require("path");
const { spawnSync } = require("child_process");
const { runChild, cooldownMin, mainSnapshot, newestConvMtime, guardrails, skipReason, sessionName, CHAINS } = require("./ab-route.js");

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

test("light chain starts with Flash then Hydrogen; large keeps Hydrogen first", () => {
  const models = c => CHAINS[c].filter(([b]) => b === "antigravity").map(([, cfg]) => cfg.model);
  assert.deepStrictEqual(models("light").slice(0, 2), ["Gemini 3.8 Flash (Medium)", "Gemini 4 Hydrogen (High)"]);
  assert.strictEqual(CHAINS.light[0][1].model, "Gemini 3.8 Flash (Medium)");
  assert.strictEqual(CHAINS.large[0][1].model, "Gemini 4 Hydrogen (High)");
  assert.strictEqual(CHAINS.agy[0][1].model, "Gemini 4 Hydrogen (High)");
});

test("router JSON output includes the agy session name", () => {
  const r = spawnSync(process.execPath, [path.join(__dirname, "ab-route.js"), "--class", "light", "--repo", path.join(__dirname, ".."), "--session", "sess-reuse-1", "--dry", "noop"], { encoding: "utf8" });
  const out = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  assert.strictEqual(out.session, "sess-reuse-1", r.stdout.slice(0, 300));
  assert.strictEqual(out.attempts[0].executor.startsWith("antigravity"), true);
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

// Deterministic half of the log-stream fix: an 'error' on the log stream (here ENOENT) must not crash the router.
test("runChild survives a log stream error and still returns the child's result", async () => {
  const log = path.join(tmp(), "missing-dir", "run.log");
  const r = await runChild(process.execPath, ["-e", "process.stdout.write('hello')"], tmp(), log, IDLE_MS, 0, HARD_MS, { tickMs: 10 });
  assert.strictEqual(r.code, 0);
  assert.strictEqual(r.text, "hello");
});

// Stress half (the race fires only sometimes on the old code): the writer is orphaned (its parent exits at once), so killTree cannot reach it, and it floods the child's stdout
// pipe across the kill. Data landing between out.end() and the log stream's async close crashed the old code with
// ERR_STREAM_WRITE_AFTER_END (later writes to the destroyed stream are dropped silently, hence the flood).
test("runChild does not crash when a child keeps printing after it was killed", async () => {
  const sd = tmp(), orphan = path.join(sd, "orphan.js"), mid = path.join(sd, "mid.js");
  fs.writeFileSync(orphan, `require("fs").writeFileSync("late.txt", "1"); const t0 = Date.now(), chunk = "LATE-OUTPUT\\n".repeat(20000);
    const pump = () => { if (Date.now() - t0 > 1500) process.exit(0); process.stdout.write(chunk, () => setImmediate(pump)); }; pump();`);
  fs.writeFileSync(mid, `require("child_process").spawn(process.execPath, [${JSON.stringify(orphan)}], { detached: true, stdio: ["ignore", 1, 2] }).unref();`);
  const { state, log, p } = fakeAgy(`const m = require("child_process").spawn(process.execPath, [${JSON.stringify(mid)}], { stdio: ["ignore", 1, 2] });
    m.on("exit", () => process.stdout.write(${JSON.stringify(HEADER)})); setTimeout(() => {}, 30000);`);
  await untilLogHas(log, "status file");
  state.t = IDLE_MS + 1000;
  const r = await p;
  assert.strictEqual(r.why, "stall");
  const marker = path.join(path.dirname(log), "late.txt");
  for (let i = 0; i < 300 && !fs.existsSync(marker); i++) await wait(10);
  assert.ok(fs.existsSync(marker), "orphan writer never ran: the test did not exercise late output");
  await wait(100);
  const size = fs.statSync(log).size;
  await wait(400);
  assert.strictEqual(fs.statSync(log).size, size, "log kept growing after finish");
});
