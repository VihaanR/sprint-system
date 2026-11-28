#!/usr/bin/env node
"use strict";
// Sprint v3 hook: one script, dispatched on hook_event_name. Inert unless <project>/.sprint-state.json has active:true
// (except UserPromptSubmit, which starts a sprint). Exit 2 = block, stderr goes to Claude.
//   CLI: node sprint-gate.js advance   -> run the current phase's exit gate, then move to the next phase
// Every advance and "end sprint" (re)writes <project>/SPRINT-REPORT.md and copies it to docs/sprint-reports/.
const fs = require("fs"), path = require("path"), os = require("os");
const { spawnSync } = require("child_process");

const TELE = path.join(os.homedir(), ".agent-bridge", "telemetry.jsonl");
const SPRINT_REPO = path.resolve(__dirname, "..", "..");
const GATE_CMD = `node ${__filename.replace(/\\/g, "/")} advance`; // absolute: projects don't contain this script
const REPORTS_DIR = process.env.SPRINT_REPORTS_DIR || path.join(SPRINT_REPO, "docs", "sprint-reports");
const NAMES = ["discover", "backend", "frontend", "polish", "audit", "launch"];
const CODE_DIR = /(^|[\\/])(src|app|api|backend|frontend)[\\/]/i;
const UI_FILE = /\.(tsx|jsx|css|html)$/i;
const SLOP = [/bg-slate-950/, /from-purple-\d+/, /to-indigo-\d+/, /transition:\s*all[^;]*linear/i];
// Prompts quoted in the report as "sounded frustrated". Quotes make false positives cheap; "wtf" at the start is explicit.
const FRUSTRATED = /\b(wtf|ffs|not working|doesn'?t work|still (broken|not|failing)|why (is|does|did|doesn'?t|isn'?t|won'?t)|i can'?t|useless|what the)\b/i;
let PHASE = 0; // current phase, so blocks land in the right row of the report

const log = ev => { try { fs.mkdirSync(path.dirname(TELE), { recursive: true }); fs.appendFileSync(TELE, JSON.stringify({ ts: new Date().toISOString(), from: "hook", ...ev }) + "\n"); } catch {} };
const readJson = p => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };
const block = msg => { log({ phase: PHASE, to: "block", outcome: msg.split("\n")[0].slice(0, 160) }); process.stderr.write(msg + "\n"); process.exit(2); };
const context = (event, text) => { process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } })); process.exit(0); };

function config(root) {
  return readJson(path.join(root, "sprint.config.json")) || readJson("V:/Projects/sprint/sprint.config.json") || {};
}
const statePath = root => path.join(root, ".sprint-state.json");
function renameAtomic(tmp, p) {
  try { fs.renameSync(tmp, p); return "ok"; }
  catch (e) { return e.code === "EPERM" || e.code === "EBUSY" ? "retry" : "fail"; }
}
function saveState(root, s) {
  const p = statePath(root), tmp = `${p}.${process.pid}.tmp`, data = JSON.stringify(s, null, 2);
  fs.writeFileSync(tmp, data);
  for (let i = 0; i < 4; i++) {
    const res = renameAtomic(tmp, p);
    if (res === "ok") return;
    if (res === "fail") break;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 15);
  }
  try { fs.unlinkSync(tmp); } catch {}
  fs.writeFileSync(p, data);
}

// Phase 1 artifacts that every later phase depends on.
function missingArtifacts(root) {
  const miss = ["SPRINT.md", "PRODUCT.md", "DESIGN.md"].filter(f => !fs.existsSync(path.join(root, f)));
  const golden = ["fixtures", "data", "tests/fixtures"].some(d => { try { return fs.readdirSync(path.join(root, d)).some(f => /golden|fixture|expected/i.test(f)); } catch { return false; } });
  if (!golden) miss.push("golden fixture (fixtures/|data/|tests/fixtures/ *golden*|*expected*)");
  return miss;
}

// Live router worktrees registered on this repo (stale/prunable ones ignored).
function liveRouteTrees(root) {
  const r = spawnSync("git", ["worktree", "list", "--porcelain"], { cwd: root, encoding: "utf8", timeout: 3000 });
  return (r.stdout || "").split(/\r?\n\r?\n/).filter(b => /branch refs\/heads\/route\//.test(b) && !/prunable/.test(b))
    .map(b => ((/^worktree (.+)$/m.exec(b) || [])[1] || "").trim()).filter(p => p && fs.existsSync(p));
}

function preEdit(root, s, file) {
  const abs = path.resolve(root, file || ""), rel = path.relative(root, abs);
  if (rel.startsWith("..")) return; // outside the project (scratch, ~/.claude): not gated
  const inAgentTree = /^\.claude[\\/]worktrees[\\/]/.test(rel);
  const trees = inAgentTree ? [] : liveRouteTrees(root);
  if (trees.length) block(`[BLOCKED] Router worktree active (${trees[0]}). Editing the main checkout now trips isolation-breach. Wait for the route job, or edit inside the worktree.`);
  const name = NAMES[s.phase - 1];
  const isCode = CODE_DIR.test(rel), isUi = UI_FILE.test(rel);
  if (isCode && !(s.skillsLoaded || []).some(k => k.endsWith(`phase-${name}`)))
    block(`[BLOCKED] Phase ${s.phase}/6 (${name}): call Skill(phase-${name}) before editing code.`);
  if (isCode && s.phase >= 2) { const m = missingArtifacts(root); if (m.length) block(`[BLOCKED] Phase 1 artifacts missing: ${m.join(", ")}.`); }
  if (isUi && !fs.existsSync(path.join(root, ".sprint", "impeccable.ok")))
    block("[BLOCKED] UI edit before impeccable preflight. Run `scripts/impeccable context`, read PRODUCT.md, DESIGN.md and skills/impeccable/reference/craft-floor.md, then create .sprint/impeccable.ok.");
}

function preBash(s, cmd) {
  if (process.platform === "win32" && /\bpython3?(\.exe)?\b[^\n|]*<<-?\s*['"]?\w+/.test(cmd))
    block("[BLOCKED] Python heredoc in Git Bash mangles \\n on Windows. Write a script file (scratchpad) or use Edit.");
  if (/ab-route\.js/.test(cmd) && /--class\s+(bulk|large|agy)\b/.test(cmd) && !/--dry\b/.test(cmd)) {
    if (!/--accept\s+\S/.test(cmd)) block('[BLOCKED] Router write job needs --accept "<measurable metric>".');
    if (s.statusPhase !== s.phase) block("[BLOCKED] Run `node ~/.claude/bin/ab-route.js --status` in this phase before dispatching.");
  }
}

function answerCount(inp) {
  const ans = (inp.tool_response || {}).answers;
  if (Object.prototype.toString.call(ans) === "[object Object]")
    return Object.values(ans).filter(v => String(v ?? "").trim()).length;
  const qs = (inp.tool_input || {}).questions;
  return Array.isArray(qs) ? qs.length : 1;
}

// PreToolUse marks a tool_use_id in flight, PostToolUse/PostToolUseFailure clears it (pauseClock reads it first).
function trackInFlight(root, s, inp, ev) {
  const id = inp.tool_use_id;
  if (!id) return;
  if (ev === "PreToolUse") { s.inFlight = { ...(s.inFlight || {}), [id]: new Date().toISOString() }; saveState(root, s); return; }
  const post = ev === "PostToolUse" || ev === "PostToolUseFailure";
  if (post && Object.prototype.hasOwnProperty.call(s.inFlight || {}, id)) { delete s.inFlight[id]; saveState(root, s); }
}

function postTool(root, s, inp) {
  const t = inp.tool_name, ti = inp.tool_input || {};
  // Rule: >= gates.minUserQuestionsPerPhase answered questions in EVERY phase. The tool returns after the user answered.
  if (t === "AskUserQuestion") {
    const n = answerCount(inp);
    if (n) { s.questionsByPhase = { ...(s.questionsByPhase || {}), [s.phase]: ((s.questionsByPhase || {})[s.phase] || 0) + n }; saveState(root, s); }
    return;
  }
  if (t === "Skill" && ti.skill) { s.skillsLoaded = [...new Set([...(s.skillsLoaded || []), ti.skill])]; saveState(root, s); return; }
  if (t === "Bash" && /ab-route\.js\s+--status/.test(ti.command || "")) { s.statusPhase = s.phase; saveState(root, s); }
  if (t === "Bash" && /ab-route\.js/.test(ti.command || "")) {
    const out = JSON.stringify(inp.tool_response || "");
    const m = /isolation-breach|exhausted|startup-stall|"quota"|"stall"/.exec(out);
    if (m) log({ phase: s.phase, to: "router", outcome: m[0].replace(/"/g, ""), source: "PostToolUse" });
  }
  if ((t === "Edit" || t === "Write") && UI_FILE.test(ti.file_path || "")) {
    let txt = ""; try { txt = fs.readFileSync(ti.file_path, "utf8"); } catch {}
    const hits = SLOP.filter(r => r.test(txt)).map(String);
    if (hits.length) { log({ phase: s.phase, to: "slop-check", outcome: "slop", file: ti.file_path, flags: hits });
      context("PostToolUse", `[SLOP] ${path.basename(ti.file_path)} matches ${hits.join(", ")}. Replace with DESIGN.md tokens.`); }
  }
}

// ---- phase window: a phase may not end before budget - lead (floor) and should end by its budget (ceiling) ----
function pausedMs(pauses, phase, since, until) {
  let ms = 0;
  for (const p of pauses || []) {
    const to = Date.parse(p?.to);
    if (p?.phase !== phase || !(to >= since)) continue;
    const from = Date.parse(p.from) || since;
    ms += Math.max(0, Math.min(until, to) - Math.max(since, from));
  }
  return ms;
}

function phaseWindow(s, cfg, now = Date.now()) {
  const budget = ((cfg.phases || {})[s.phase] || {}).budgetMin || 0;
  const lead = (cfg.gates || {}).phaseFloorLeadMin ?? 5;
  const started = Date.parse(s.phaseStartedAt || s.startedAt || "") || now;
  const paused = pausedMs(s.pauses, s.phase, started, now);
  const floor = s.floorSkippedPhase === s.phase ? 0 : Math.max(0, budget - lead); // the user typed "skip floor"
  return { elapsedMin: Math.max(0, (now - started - paused) / 60000), floorMin: floor, ceilMin: budget };
}
const CHALLENGES = [
  { phases: [3, 4], text: "run /impeccable critique on the running UI, have a builder fix the top finding, re-screenshot into .sprint/screens-p<N>/" },
  { phases: [3, 4], text: "compare the build against DESIGN.md (fonts, colors, layout, spacing) and have a builder fix one drift" },
  { phases: [1, 2], text: "check one golden expected output against the code or data by hand" },
  { phases: [1, 2], text: "attack one spec assumption: what input or user breaks it?" },
  { phases: [2, 3, 4, 5, 6], text: "re-test one edge case end to end and record the result" },
  { text: "re-raise one open item from .sprint/user-asks.json with the user (AskUserQuestion); update its status" },
  { text: "ask the user one question that changes a decision in this phase (AskUserQuestion)" },
  { text: "re-read SPRINT.md against what is built: list every claim that is not yet true" },
  { text: "ask a cold subagent (devil-advocate) to find the weakest decision of this phase" },
];
const challengesFor = phase => CHALLENGES.filter(c => !c.phases || c.phases.includes(phase)).map(c => c.text.replace("<N>", phase));

// Discover's interrogation record: user Q&A and self-challenge rounds.
function discoverLogFails(root, g) {
  const d = readJson(path.join(root, ".sprint", "discover-log.json")) || {};
  const minQ = g.discoverMinUserQuestions ?? 15, minR = g.discoverMinChallengeRounds ?? 5, fail = [];
  const qs = (d.userQuestions || []).filter(x => x && String(x.q || "").trim() && String(x.answer || "").trim());
  const rs = (d.challengeRounds || []).filter(x => x && x.claim && x.attack && x.verdict);
  if (qs.length < minQ) fail.push(`.sprint/discover-log.json: ${qs.length}/${minQ} answered user questions`);
  if (rs.length < minR) fail.push(`.sprint/discover-log.json: ${rs.length}/${minR} self-challenge rounds (claim, attack, verdict)`);
  return fail;
}

function serviceFail(sv) {
  const s = sv || {}, n = s.name || "?";
  if (s.status === "cut") return s.userConfirmed === true ? null : `.sprint/preflight.json services: '${n}' is cut without userConfirmed true`;
  return s.status === "ok" ? null : `.sprint/preflight.json services: '${n}' status must be ok or cut`;
}

function smokeFail(rs) {
  const s = rs || {};
  if (s.exitCode === 0 || s.waivedByUser === true) return [];
  return [`.sprint/preflight.json routerSmoke: exit ${s.exitCode ?? "missing"} and no user waiver`];
}

// Discover's pre-flight record: router smoke and external service checks.
function preflightFails(root) {
  const p = readJson(path.join(root, ".sprint", "preflight.json"));
  if (!p) return [".sprint/preflight.json missing: run router-smoke.mjs and check every login/API key (see phase-discover)"];
  if (!Array.isArray(p.services)) return [...smokeFail(p.routerSmoke), ".sprint/preflight.json services: must be an array"];
  return [...smokeFail(p.routerSmoke), ...p.services.map(serviceFail).filter(Boolean)];
}

function userAskFail(a) {
  const x = Object(a), name = x.ask || "?";
  if (x.status === "cut") return x.userConfirmedCut === true ? null : `.sprint/user-asks.json: '${name}' was cut without the user confirming (ask them, then set userConfirmedCut true)`;
  return ["planned", "done"].includes(x.status) ? null : `.sprint/user-asks.json: '${name}' status must be planned, done, or cut`;
}
function userAskFails(root, phase) {
  const p = path.join(root, ".sprint", "user-asks.json");
  if (!fs.existsSync(p)) return phase === 1 ? [".sprint/user-asks.json missing: record every explicit user ask"] : [];
  const asks = readJson(p);
  return Array.isArray(asks) ? asks.map(userAskFail).filter(Boolean) : [".sprint/user-asks.json must be a JSON array"];
}
function openAsksLine(root) {
  const asks = readJson(path.join(root, ".sprint", "user-asks.json"));
  if (!Array.isArray(asks)) return "";
  const open = asks.filter(a => Object(a).status === "planned").map(a => `${a.ask || "?"}${a.phase ? ` (P${a.phase})` : ""}`);
  return open.length ? `Open user asks: ${open.join(", ")}` : "";
}

// Every phase: the user answered at least gates.minUserQuestionsPerPhase questions (counted by the AskUserQuestion hook).
function questionFails(s, g) {
  const min = g.minUserQuestionsPerPhase ?? 15, n = (s.questionsByPhase || {})[s.phase] || 0;
  return n < min ? [`Phase ${s.phase} user questions: ${n}/${min} answered (counted by the AskUserQuestion PostToolUse hook). Ask the rest with AskUserQuestion: real decisions and trade-offs for this phase, not filler.`] : [];
}
// Phases 3 and 4: the running app was opened in the user's browser; the phase skill writes .sprint/showcase-<phase>.json.
const SHOWCASE_PHASES = [3, 4];
function showcaseFails(root, s) {
  if (!SHOWCASE_PHASES.includes(s.phase)) return [];
  const f = `.sprint/showcase-${NAMES[s.phase - 1]}.json`, p = readJson(path.join(root, f)) || {};
  const at = Date.parse(p.timestamp || ""), since = Date.parse(s.phaseStartedAt || s.startedAt || "") || 0;
  if (!/^https?:\/\/\S+/.test(p.url || "") || !at || at < since)
    return [`${f}: {url, timestamp} written in this phase, after opening the running app in the user's browser and printing the link`];
  return [];
}

// ---- Phases 3 and 4 design exit gate: critique, desktop + 375px screens, loaded fonts, real title, custom favicon ----
const IGNORED_FONTS = new Set([
  "serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-sans-serif", "ui-serif",
  "ui-monospace", "ui-rounded", "-apple-system", "blinkmacsystemfont", "emoji", "math", "inherit", "initial",
  "unset", "arial", "helvetica", "helvetica neue", "segoe ui", "georgia", "times new roman", "courier new",
  "menlo", "consolas", "monaco", "apple color emoji", "segoe ui emoji",
]);
const BAD_TITLES = new Set(["", "app name", "vite + react", "vite + react + ts", "vite app", "react app"]);

function critiqueFail(root, phase) {
  const f = `.sprint/impeccable-critique-p${phase}.md`;
  let txt = ""; try { txt = fs.readFileSync(path.join(root, f), "utf8"); } catch {}
  return txt.trim() ? null : `${f} missing or empty (run /impeccable critique on the running UI)`;
}

function screensFail(root, phase) {
  const dir = `.sprint/screens-p${phase}`;
  let imgs = []; try { imgs = fs.readdirSync(path.join(root, dir)).filter(f => /\.(png|jpe?g|webp)$/i.test(f)); } catch {}
  const miss = [];
  if (!imgs.some(f => !/375|mobile/i.test(f))) miss.push("desktop");
  if (!imgs.some(f => /375|mobile/i.test(f))) miss.push("375px (name with 375 or mobile)");
  return miss.length ? `${dir}/ missing ${miss.join(" and ")} screenshot` : null;
}

function walkFiles(dir, extRe, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, extRe, out);
    else if (extRe.test(e.name)) out.push(p);
  }
  return out;
}

const stripQuotes = s => s.replace(/!important/gi, "").trim().replace(/^['"]|['"]$/g, "").trim();
function fontFaceFamilies(css) {
  const out = [];
  for (const b of css.matchAll(/@font-face\s*\{([^}]*)\}/gi)) {
    const m = /font-family\s*:\s*([^;]+)/i.exec(b[1]);
    if (m) out.push(stripQuotes(m[1]).toLowerCase());
  }
  return out;
}

const fontsourceImports = txt => [...txt.matchAll(/['"]@fontsource(?:-variable)?\/([a-z0-9-]+)(?:\/[^'"]*)?['"]/gi)].map(m => m[1].toLowerCase());
function parseFamilies(raw) {
  return raw.replace(/var\([^()]*\)/gi, "").split(",").map(stripQuotes)
    .filter(x => x && !/^var\(/i.test(x) && !IGNORED_FONTS.has(x.toLowerCase()));
}

// font-family declarations plus font custom properties (--font-ui: "Inter", ...; Tailwind @theme --font-*), minus size/weight-style tokens.
const FONT_DECL = /(?:^|[;\s{])(?:font-family|--font(?![\w-]*(?:size|weight|leading|line|letter|tracking|style|feature|variation|stretch|smooth))[\w-]*)\s*:\s*([^;{}]+)/gi;
function usedFontFamilies(css) {
  const out = [];
  for (const m of css.replace(/@font-face\s*\{[^}]*\}/gi, "").matchAll(FONT_DECL))
    out.push(...parseFamilies(m[1]));
  return out;
}

function collectFonts(files) {
  const faces = new Set(), imports = new Set(), used = new Map();
  for (const f of files) {
    const txt = fs.readFileSync(f, "utf8");
    fontsourceImports(txt).forEach(s => imports.add(s));
    if (!/\.css$/i.test(f)) continue;
    const clean = txt.replace(/\/\*[\s\S]*?\*\//g, "");
    fontFaceFamilies(clean).forEach(fam => faces.add(fam));
    usedFontFamilies(clean).forEach(fam => { const k = fam.toLowerCase(); used.set(k, used.get(k) || fam); });
  }
  return { faces, imports, used };
}

function fontFail(root) {
  const src = path.join(root, "frontend", "src");
  if (!fs.existsSync(src)) return null;
  const { faces, imports, used } = collectFonts(walkFiles(src, /\.(css|js|jsx|ts|tsx)$/i, []));
  const unloaded = [...used.entries()].filter(([k]) => !faces.has(k) && !imports.has(k.replace(/\s+/g, "-"))).map(([, v]) => v);
  return unloaded.length ? `fonts not loaded (no @font-face or @fontsource import in frontend/src): ${unloaded.join(", ")}` : null;
}

function titleFail(root) {
  const p = path.join(root, "frontend", "index.html");
  if (!fs.existsSync(p)) return null;
  const m = /<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i.exec(fs.readFileSync(p, "utf8"));
  const title = m ? m[1].trim().replace(/\s+/g, " ") : "";
  return BAD_TITLES.has(title.toLowerCase()) ? `frontend/index.html <title> is missing or a placeholder (${title || "empty"})` : null;
}

function faviconFail(root) {
  const starter = path.join(process.env.SPRINT_STARTER_DIR || "V:/Projects/hackathon-starter", "frontend", "public", "favicon.svg");
  const fav = path.join(root, "frontend", "public", "favicon.svg");
  if (!fs.existsSync(starter) || !fs.existsSync(fav)) return null;
  return fs.readFileSync(fav).equals(fs.readFileSync(starter)) ? "frontend/public/favicon.svg is still the starter default" : null;
}

function designFails(root, phase) {
  if (phase !== 3 && phase !== 4) return [];
  return [critiqueFail(root, phase), screensFail(root, phase), fontFail(root), titleFail(root), faviconFail(root)].filter(Boolean);
}

// ---- orchestrator model: the sprint runs on cfg.orchestrator (Opus 5.5, high effort) ----
function lastModel(transcript) {
  let lines = []; try { lines = fs.readFileSync(transcript, "utf8").trim().split("\n"); } catch { return null; }
  for (let i = lines.length - 1; i >= 0; i--) {
    try { const e = JSON.parse(lines[i]); if (e.type === "assistant" && e.message && e.message.model) return e.message.model; } catch {}
  }
  return null;
}
function pinOrchestrator(root, want) {
  const p = path.join(root, ".claude", "settings.local.json");
  const cur = readJson(p) || {};
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ ...cur, model: want.model, effortLevel: want.effort }, null, 2));
}
function effortLevel(root) {
  if (process.env.CLAUDE_CODE_EFFORT_LEVEL) return process.env.CLAUDE_CODE_EFFORT_LEVEL;
  for (const p of [path.join(root, ".claude", "settings.local.json"), path.join(root, ".claude", "settings.json"), path.join(os.homedir(), ".claude", "settings.json")]) {
    const e = (readJson(p) || {}).effortLevel; if (e) return e;
  }
  return null;
}
function orchestratorMismatch(root, cfg, transcript) {
  const want = cfg.orchestrator; if (!want) return null;
  pinOrchestrator(root, want);
  const model = lastModel(transcript), effort = effortLevel(root), bad = [];
  if (model && !model.startsWith(want.model)) bad.push(`model is ${model}`);
  if (effort !== want.effort) bad.push(`effort is ${effort || "unset"}`);
  return bad.length ? bad.join(", ") : null;
}

// ---- phase exit gates (run by `advance`, re-checked on Stop while an exit is pending) ----
function coreLoc(root) {
  let n = 0;
  const walk = d => { let es = []; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of es) { const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!/^(tests?|fixtures|node_modules|\.venv|__pycache__|schemas?|migrations)$/i.test(e.name)) walk(p); }
      else if (/\.py$/.test(e.name) && !/^(test_|conftest|schemas?\.py|models\.py)/.test(e.name))
        n += fs.readFileSync(p, "utf8").split("\n").filter(l => l.trim() && !l.trim().startsWith("#")).length; } };
  ["backend", "api", "app"].forEach(d => walk(path.join(root, d)));
  return n;
}
function exitGate(root, s, cfg) {
  const g = cfg.gates || {}, fail = [];
  const w = phaseWindow(s, cfg);
  if (w.elapsedMin < w.floorMin) fail.push(`Phase ${s.phase} floor: ${Math.ceil(w.floorMin - w.elapsedMin)} min left (floor ${w.floorMin} of ${w.ceilMin} min). Keep validating before advancing.`);
  fail.push(...questionFails(s, g), ...showcaseFails(root, s), ...designFails(root, s.phase), ...userAskFails(root, s.phase));
  if (s.phase === 1) { const m = missingArtifacts(root); if (m.length) fail.push(`Phase 1 artifacts missing: ${m.join(", ")}`); fail.push(...discoverLogFails(root, g), ...preflightFails(root)); }
  if (s.phase === 2) {
    // uv projects keep deps in .venv, which the system python cannot see (pytest then exits 2 on import errors).
    const uv = fs.existsSync(path.join(root, "uv.lock"));
    const t = spawnSync(uv ? "uv" : "python", uv ? ["run", "pytest", "-q"] : ["-m", "pytest", "-q"], { cwd: root, encoding: "utf8", timeout: 300000, shell: process.platform === "win32" });
    if (t.status !== 0) fail.push(`pytest exit ${t.status}${t.stdout ? ": " + t.stdout.trim().split("\n").pop() : ""}`);
    const loc = coreLoc(root), max = g.backendMaxCoreLoc || 450; if (loc > max) fail.push(`core backend LOC ${loc} > ${max}`);
  }
  if (s.phase === 3) {
    const p = readJson(path.join(root, ".sprint", "phase3-proof.json"));
    if (!p || !p.screenshot || !fs.existsSync(path.resolve(root, p.screenshot))) fail.push(".sprint/phase3-proof.json needs a human-click walkthrough screenshot path");
    if (!p || p.axeViolations !== 0) fail.push("axe-core violations must be 0 (phase3-proof.json axeViolations)");
  }
  if (s.phase === 6) {
    const p = readJson(path.join(root, ".sprint", "launch-proof.json")) || {};
    if (!p.url || p.httpStatus !== 200) fail.push("launch-proof.json: live url with httpStatus 200");
    if (!p.videoSec) fail.push(`launch-proof.json: brag video length (target ${g.videoDurationSec || "15-25"}s)`);
    if (!p.readmeClaimsChecked) fail.push("launch-proof.json: readmeClaimsChecked true");
    if (g.stripeEnabled && !/^cs_test_/.test(p.stripeSession || "")) fail.push("Stripe enabled: launch-proof.json stripeSession cs_test_...");
  }
  return fail;
}

// Router guard (was ~/.claude/bin/route-guard.js): always on, sprint or not. Escape hatch: AB_DIRECT=1.
const DIRECT_EXECUTOR = [
  /\bagent-bridge(\.js)?["']?\s+run\b/i,
  /\bagy(\.exe)?["']?\s+(-p\b|--print\b|--mode\b|--dangerously)/i,
  /\bopencode(\.exe)?["']?\s+run\b(?!\s+--help)/i,
];
function routeGuard(cmd) {
  if (/ab-route\.js/.test(cmd) || /AB_DIRECT=1/.test(cmd) || !DIRECT_EXECUTOR.some(r => r.test(cmd))) return;
  block("Blocked: use the router, not an executor directly.\n" +
    "  node ~/.claude/bin/ab-route.js --class <recon|bulk|large|review|research> --repo <dir> \"<outcome + acceptance criteria>\"\n" +
    "  (status: node ~/.claude/bin/ab-route.js --status). To bypass on purpose, prefix the command with AB_DIRECT=1.");
}

// ---- SPRINT-REPORT.md: your words, phase times and friction, for the post-mortem ----
// Paused clock: a gap with no hook activity longer than idlePauseMin (terminal closed, usage exhausted, session
// restart) is not sprint time. Record the pause with its phase instead of shifting start timestamps, so
// showcase/report checks still match real start times while phaseWindow/report subtract paused ms.
// Signal: a long tool call (router chain, test run) is hook-silent between its PreToolUse and PostToolUse, so a
// tool_use_id in s.inFlight younger than maxChainWallMs + idlePauseMin suppresses the pause; an older entry is a
// tool that died with the session and is dropped. Limitation: only tools matched by the PreToolUse hook
// (Bash|PowerShell|Edit|Write|MultiEdit in settings.json) are tracked, so a long gap inside an unmatched tool
// (e.g. the user thinking over AskUserQuestion) may still count as a pause.
function pauseBounds(cfg) {
  const idle = (cfg.gates?.idlePauseMin ?? 10) * 60000;
  return { idle, cap: (cfg.router?.maxChainWallMs ?? 1500000) + idle };
}
function pruneInFlight(s, now, cap) {
  const next = {};
  let changed = false;
  for (const [id, ts] of Object.entries(s.inFlight || {})) {
    const t = Date.parse(ts);
    if (t && now - t < cap) next[id] = ts;
    else changed = true;
  }
  if (changed) s.inFlight = next;
  return { changed, busy: Object.keys(next).length > 0 };
}
function pauseClock(root, s, cfg) {
  const now = Date.now(), { idle, cap } = pauseBounds(cfg);
  const stored = Date.parse(s.lastActivityAt), gap = stored ? now - stored : 0;
  const { changed, busy } = pruneInFlight(s, now, cap);
  const paused = gap > idle && !busy;
  if (paused) s.pauses = [...(s.pauses || []), { from: new Date(stored).toISOString(), to: new Date(now).toISOString(), min: Math.round(gap / 60000), phase: s.phase }];
  s.lastActivityAt = new Date(now).toISOString();
  if ([paused, changed, !stored, gap > 60000].some(Boolean)) saveState(root, s);
}

const endPhase = (s, now) => { s.phaseLog = [...(s.phaseLog || []), { phase: s.phase, startedAt: s.phaseStartedAt || s.startedAt, endedAt: now }]; };
const jsonl = p => { try { return fs.readFileSync(p, "utf8").split("\n").map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch { return []; } };
const oneLine = t => String(t).replace(/\s+/g, " ").trim();

function writeReport(root, s, cfg, status) {
  const since = Date.parse(s.startedAt), at = Date.parse, now = Date.now();
  const phaseOf = t => ((s.phaseLog || []).find(x => t >= at(x.startedAt) && t < at(x.endedAt)) || { phase: s.phase }).phase;
  const label = p => `P${p} ${NAMES[p - 1] || "?"}`, hhmm = iso => new Date(iso).toTimeString().slice(0, 5);
  const gripes = s.gripes || [], mine = gripes.filter(g => g.kind === "wtf"), auto = gripes.filter(g => g.kind === "auto");
  const interrupts = {};
  for (const t of s.transcripts || []) for (const e of jsonl(t))
    if (e.type === "user" && at(e.timestamp) >= since && JSON.stringify(e.message || "").includes("[Request interrupted by user")) {
      const p = phaseOf(at(e.timestamp)); interrupts[p] = (interrupts[p] || 0) + 1; }
  const friction = {};
  for (const e of jsonl(TELE)) {
    if (!e.ts || at(e.ts) < since || e.to === "phase") continue;
    const k = `${e.phase ?? "?"}|${e.to}|${e.outcome}`;
    friction[k] = friction[k] || { phase: e.phase, to: e.to, outcome: e.outcome, n: 0, ex: oneLine((e.flags || [])[0] || e.file || "") };
    friction[k].n++;
  }
  const phases = [...(s.phaseLog || []), ...(s.active ? [{ phase: s.phase, startedAt: s.phaseStartedAt, endedAt: null }] : [])];
  const quote = g => `- [${label(g.phase)}, ${hhmm(g.ts)}] ${oneLine(g.text)}`;
  const open = openAsksLine(root);
  const md = [
    `# Sprint report: ${path.basename(root)}`, "",
    `Started ${s.startedAt} · status: **${status}** · reached Phase ${s.phase}/6 (${NAMES[s.phase - 1]})`,
    ...(open ? ["", open] : []), "",
    "## Your words", "",
    `### wtf (you flagged these): ${mine.length}`, ...(mine.length ? mine.map(quote) : ["- none"]), "",
    `### Sounded frustrated (auto, may include false positives): ${auto.length}`, ...(auto.length ? auto.map(quote) : ["- none"]), "",
    `### Interrupts (Esc): ${Object.values(interrupts).reduce((a, b) => a + b, 0)}`,
    ...Object.entries(interrupts).map(([p, n]) => `- ${label(+p)}: ${n}`), "",
    "## Time per phase", "", "| Phase | Used (min) | Budget (min) | |", "|---|---|---|---|",
    ...phases.map(x => { const start = at(x.startedAt), end = x.endedAt ? at(x.endedAt) : now;
      const used = Math.max(0, Math.round((end - start - pausedMs(s.pauses, x.phase, start, end)) / 60000)), b = ((cfg.phases || {})[x.phase] || {}).budgetMin;
      return `| ${label(x.phase)} | ${used} | ${b ?? "-"} | ${!x.endedAt ? "running" : b && used > b ? "**over**" : ""} |`; }), "",
    "## Friction (blocks, failures, router)", "", "| Phase | Source | Event | Count | Example |", "|---|---|---|---|---|",
    ...Object.values(friction).sort((a, b) => b.n - a.n).map(f => `| ${f.phase ?? "?"} | ${f.to} | ${oneLine(f.outcome)} | ${f.n} | ${f.ex.slice(0, 120)} |`), "",
    "## For the post-mortem",
    "Read this with every other file in the sprint repo's docs/sprint-reports/. Rank problems by minutes lost and by how often",
    "the user flagged them (wtf first), then propose at most 3 fixes, each tied to a quote or a row above.", "",
  ].join("\n");
  fs.writeFileSync(path.join(root, "SPRINT-REPORT.md"), md);
  try { fs.mkdirSync(REPORTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(REPORTS_DIR, `${s.startedAt.slice(0, 10)}-${path.basename(root)}.md`), md); } catch {}
}

function main() {
  if (process.argv[2] === "advance") {
    const root = process.cwd(), s = readJson(statePath(root)), cfg = config(root);
    if (!s || !s.active) { console.log("no active sprint"); process.exit(1); }
    const fail = exitGate(root, s, cfg), open = openAsksLine(root);
    if (fail.length) { s.exitRequested = true; saveState(root, s); console.log([`[BLOCKED] Phase ${s.phase} exit gate:\n- ${fail.join("\n- ")}`, open].filter(Boolean).join("\n")); process.exit(1); }
    const now = new Date().toISOString();
    endPhase(s, now); s.exitRequested = false; s.phaseStartedAt = now; s.floorStopBlocks = 0; s.ceilNoticed = false;
    if (s.phase === 6) { s.active = false; spawnSync("python", [path.join(SPRINT_REPO, "scripts", "evolve_skills.py")], { cwd: SPRINT_REPO, stdio: "inherit" }); }
    else s.phase++;
    saveState(root, s); log({ phase: s.phase, to: "phase", outcome: s.active ? "advanced" : "sprint-closed" });
    writeReport(root, s, cfg, s.active ? "in progress" : "complete");
    const done = s.active ? `[DONE] Phase ${s.phase}/6 (${NAMES[s.phase - 1]}). Load Skill(phase-${NAMES[s.phase - 1]}) first. SPRINT-REPORT.md updated.` : "[DONE] Sprint closed; evolve_skills.py ran; SPRINT-REPORT.md written.";
    console.log([done, open].filter(Boolean).join("\n"));
    return;
  }
  let inp = {}; try { inp = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); } catch {}
  // The project root is the folder holding .sprint-state.json, searched upward: a session whose cwd moved into a
  // subfolder (frontend/) otherwise read no state, recorded no activity, and the idle-pause saw a fake 28-min gap.
  const start = process.env.CLAUDE_PROJECT_DIR || inp.cwd || process.cwd(), ev = inp.hook_event_name;
  const findUp = d => { for (let p = path.resolve(d); ; p = path.dirname(p)) { if (fs.existsSync(path.join(p, ".sprint-state.json"))) return p; if (path.dirname(p) === p) return null; } };
  const root = findUp(start) || start;
  if (ev === "PreToolUse" && (inp.tool_name === "Bash" || inp.tool_name === "PowerShell")) routeGuard(String((inp.tool_input || {}).command || ""));
  const cfg = config(root);

  if (ev === "UserPromptSubmit") {
    const phrases = cfg.autoTriggerPhrases || ["start a sprint", "run a sprint"];
    if (phrases.some(p => (inp.prompt || "").trim().toLowerCase().startsWith(p))) {
      const bad = orchestratorMismatch(root, cfg, inp.transcript_path);
      if (bad) { log({ phase: 0, to: "orchestrator", outcome: "wrong-model", flags: [bad] });
        block(`[BLOCKED] Sprint needs ${cfg.orchestrator.model} at ${cfg.orchestrator.effort} effort (${bad}). Run /model ${cfg.orchestrator.model} and /effort ${cfg.orchestrator.effort}, then say "start a sprint" again. (.claude/settings.local.json now pins both for new sessions; an /effort changed mid-session is not visible to hooks.)`); }
      const now = new Date().toISOString();
      const s = { active: true, phase: 1, startedAt: now, phaseStartedAt: now, skillsLoaded: [], userGo: false, autoRoute: (cfg.router || {}).autoRoute !== false,
        transcripts: inp.transcript_path ? [inp.transcript_path] : [], gripes: [], phaseLog: [] };
      saveState(root, s); log({ phase: 1, to: "phase", outcome: "sprint-started" });
      const w = phaseWindow(s, cfg);
      context(ev, `SPRINT ACTIVE (Phase 1/6: Discover, window ${w.floorMin}-${w.ceilMin} min). Your FIRST tool call MUST be Skill(sprint-orchestrator) then Skill(phase-discover). Ask the user at least ${(cfg.gates || {}).minUserQuestionsPerPhase ?? 15} questions in EVERY phase (AskUserQuestion; the hook counts them) and keep challenging the spec until the floor; advance refuses earlier. Automatic ab-route.js routing is ${s.autoRoute ? "ON" : "OFF"} (sprint.config.json). Advance phases only with \`${GATE_CMD}\` (run from the project root) after the user says go. The user can start any message with "wtf" to log a complaint for SPRINT-REPORT.md, or say "end sprint" to stop early.`);
    }
  }
  const s = readJson(statePath(root)); if (!s || !s.active) return;
  PHASE = s.phase;
  pauseClock(root, s, cfg);
  if (ev === "UserPromptSubmit") {
    const p = (inp.prompt || "").trim(), kind = /^wtf\b/i.test(p) ? "wtf" : FRUSTRATED.test(p) ? "auto" : null;
    const newTranscript = inp.transcript_path && !(s.transcripts || []).includes(inp.transcript_path);
    if (kind) s.gripes = [...(s.gripes || []), { ts: new Date().toISOString(), phase: s.phase, kind, text: p.slice(0, 500) }];
    if (newTranscript) s.transcripts = [...(s.transcripts || []), inp.transcript_path];
    if (/^end sprint\b/i.test(p)) {
      endPhase(s, new Date().toISOString()); s.active = false; saveState(root, s);
      log({ phase: s.phase, to: "phase", outcome: "sprint-ended-early" }); writeReport(root, s, cfg, "ended early by you");
      context(ev, `[DONE] Sprint ended at Phase ${s.phase}/6 by the user. SPRINT-REPORT.md is written in the project and copied to ${REPORTS_DIR}. Tell the user both paths; gates are now off.`);
    }
    if (kind || newTranscript) saveState(root, s);
  }
  // Only the user's own prompt can lift the floor (the phase's checks still run on advance).
  if (ev === "UserPromptSubmit" && /^skip floor\b/i.test((inp.prompt || "").trim())) {
    s.floorSkippedPhase = s.phase; saveState(root, s); log({ phase: s.phase, to: "phase", outcome: "floor-skipped" });
    context(ev, `[DONE] Phase ${s.phase}/6 floor lifted by the user. The exit gate's other checks still apply; post the scorecard and ask for go.`);
  }
  const ti = inp.tool_input || {};
  if (ev === "PreToolUse" && (inp.tool_name === "Edit" || inp.tool_name === "Write")) preEdit(root, s, ti.file_path);
  else if (ev === "PreToolUse" && inp.tool_name === "Bash") preBash(s, ti.command || "");
  trackInFlight(root, s, inp, ev); // after the pre-gates: a blocked call never ran
  if (ev === "PostToolUse") postTool(root, s, inp);
  else if (ev === "PostToolUseFailure") log({ phase: s.phase, to: inp.tool_name, outcome: "tool-failure", flags: [String(inp.error || "").slice(0, 200)] });
  else if (ev === "Stop") stopGate(root, s, cfg, inp);
  if (ev === "UserPromptSubmit" || ev === "PostToolUse") ceilingNotice(root, s, cfg, ev);
}

// Stop: under the floor, Claude keeps validating (bounded); a requested exit is re-checked once.
function stopGate(root, s, cfg, inp) {
  const w = phaseWindow(s, cfg), max = (cfg.gates || {}).maxFloorStopBlocks ?? 10, n = s.floorStopBlocks || 0;
  if (w.elapsedMin < w.floorMin && n < max) {
    s.floorStopBlocks = n + 1; saveState(root, s);
    const list = challengesFor(s.phase);
    block(`[BLOCKED] Phase ${s.phase}/6 (${NAMES[s.phase - 1]}) floor: ${Math.ceil(w.floorMin - w.elapsedMin)} min left before this phase may end. Next validation round: ${list[n % list.length]}. Record it${s.phase === 1 ? " in .sprint/discover-log.json challengeRounds" : " in SPRINT.md"}, then continue.`);
  }
  if (s.exitRequested && !inp.stop_hook_active) {
    const fail = exitGate(root, s, cfg); if (fail.length) block(`[BLOCKED] Phase ${s.phase} exit gate still failing:\n- ${fail.join("\n- ")}`);
  }
}

// Ceiling: time can't be blocked, so tell Claude once per phase to wrap up.
function ceilingNotice(root, s, cfg, ev) {
  const w = phaseWindow(s, cfg);
  if (w.ceilMin && w.elapsedMin >= w.ceilMin && !s.ceilNoticed) {
    s.ceilNoticed = true; saveState(root, s);
    context(ev, `[OVER BUDGET] Phase ${s.phase}/6 (${NAMES[s.phase - 1]}) used ${Math.round(w.elapsedMin)} of ${w.ceilMin} min. Post the scorecard and ask the user for go now.`);
  }
}
main();
