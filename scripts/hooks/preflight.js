#!/usr/bin/env node
"use strict";
// SessionStart preflight for an active sprint: free API port, auth, line endings, env ignores, router status, agy smoke.
// Inert unless <project>/.sprint-state.json has active:true. Never blocks; reports as context. agy smoke runs detached.
const fs = require("fs"), path = require("path"), os = require("os");
const { spawnSync, spawn } = require("child_process");

let inp = {}; try { inp = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); } catch {}
const root = process.env.CLAUDE_PROJECT_DIR || inp.cwd || process.cwd();
let st = null; try { st = JSON.parse(fs.readFileSync(path.join(root, ".sprint-state.json"), "utf8")); } catch {}
if (!st || !st.active) process.exit(0);

const run = (cmd, args, ms = 8000) => spawnSync(cmd, args, { cwd: root, encoding: "utf8", timeout: ms, shell: process.platform === "win32", windowsHide: true });
const read = f => { try { return fs.readFileSync(path.join(root, f), "utf8"); } catch { return ""; } };
const out = [];

// 1. API port outside Hyper-V excluded ranges
if (process.platform === "win32") {
  const r = run("netsh", ["interface", "ipv4", "show", "excludedportrange", "protocol=tcp"]);
  const ranges = [...(r.stdout || "").matchAll(/^\s*(\d+)\s+(\d+)/gm)].map(m => [+m[1], +m[2]]);
  const port = [8000, 8010, 8080, 8787, 5055, 3001].find(p => !ranges.some(([a, b]) => p >= a && p <= b));
  out.push(`API_PORT=${port}${port !== 8000 ? " (8000 is Hyper-V excluded)" : ""}`);
}
// 2. auth (fail early, not in the final hour)
const v = run("vercel", ["whoami"]); out.push(v.status === 0 ? `vercel: ${v.stdout.trim().split("\n").pop()}` : "vercel: NOT LOGGED IN (run `! vercel login` now)");
const g = run("gh", ["auth", "status"]); out.push(g.status === 0 ? "gh: ok" : "gh: NOT LOGGED IN (run `! gh auth login`)");
// 3. repo hygiene
out.push(/\*\s+text=auto\s+eol=lf/.test(read(".gitattributes")) ? ".gitattributes: ok" : ".gitattributes: missing `* text=auto eol=lf` (CRLF warnings each commit)");
for (const f of [".gitignore", ".vercelignore"]) if (fs.existsSync(path.join(root, f)) && !/^\.env/m.test(read(f))) out.push(`${f}: add .env*`);
if (!fs.existsSync(path.join(root, ".gitignore"))) out.push(".gitignore: missing (add .env*)");
// 4. router
const ab = run(process.execPath, [path.join(os.homedir(), ".claude", "bin", "ab-route.js"), "--table"], 15000);
const tripped = (ab.stdout || "").split("\n").filter(l => /TRIPPED/.test(l)).map(l => l.split(/\s+/)[0]);
out.push(tripped.length ? `router tripped: ${tripped.join(", ")}` : "router: all executors available");
// 5. agy smoke, detached (up to 2 min); result lands in .sprint/agy-smoke.txt
fs.mkdirSync(path.join(root, ".sprint"), { recursive: true });
const smoke = fs.openSync(path.join(root, ".sprint", "agy-smoke.txt"), "w");
spawn("agy", ["-p", "say ok"], { cwd: root, env: { ...process.env, AB_DIRECT: "1" }, detached: true, stdio: ["ignore", smoke, smoke], shell: process.platform === "win32", windowsHide: true }).unref();
out.push("agy smoke: running -> .sprint/agy-smoke.txt");

process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: `[SPRINT PREFLIGHT] Phase ${st.phase}/6\n- ${out.join("\n- ")}` } }));
