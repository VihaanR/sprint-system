#!/usr/bin/env node
"use strict";
// Sprint v3 hook: one script, dispatched on hook_event_name. Inert unless <project>/.sprint-state.json has active:true
// (except UserPromptSubmit, which starts a sprint). Exit 2 = block, stderr goes to Claude.
//   CLI: node sprint-gate.js advance   -> run the current phase's exit gate, then move to the next phase
const fs = require("fs"), path = require("path"), os = require("os");
const { spawnSync } = require("child_process");

const TELE = path.join(os.homedir(), ".agent-bridge", "telemetry.jsonl");
const NAMES = ["discover", "backend", "frontend", "polish", "audit", "launch"];
const CODE_DIR = /(^|[\\/])(src|app|api|backend|frontend)[\\/]/i;
const UI_FILE = /\.(tsx|jsx|css|html)$/i;
const SLOP = [/bg-slate-950/, /from-purple-\d+/, /to-indigo-\d+/, /transition:\s*all[^;]*linear/i];

const log = ev => { try { fs.mkdirSync(path.dirname(TELE), { recursive: true }); fs.appendFileSync(TELE, JSON.stringify({ ts: new Date().toISOString(), from: "hook", ...ev }) + "\n"); } catch {} };
const readJson = p => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };
const block = msg => { process.stderr.write(msg + "\n"); process.exit(2); };
const context = (event, text) => { process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } })); process.exit(0); };

function config(root) {
  return readJson(path.join(root, "sprint.config.json")) || readJson("V:/Projects/sprint/sprint.config.json") || {};
}
const statePath = root => path.join(root, ".sprint-state.json");
const saveState = (root, s) => fs.writeFileSync(statePath(root), JSON.stringify(s, null, 2));

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
  return (r.stdout || "").split(/\n\n/).filter(b => /branch refs\/heads\/route\//.test(b) && !/prunable/.test(b))
    .map(b => (/^worktree (.+)$/m.exec(b) || [])[1]).filter(p => p && fs.existsSync(p));
}

function preEdit(root, s, file) {
  const abs = path.resolve(root, file || ""), rel = path.relative(root, abs);
  if (rel.startsWith("..")) return; // outside the project (scratch, ~/.claude): not gated
  const trees = liveRouteTrees(root);
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

function postTool(root, s, inp) {
  const t = inp.tool_name, ti = inp.tool_input || {};
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
function phaseWindow(s, cfg, now = Date.now()) {
  const budget = ((cfg.phases || {})[s.phase] || {}).budgetMin || 0;
  const lead = (cfg.gates || {}).phaseFloorLeadMin ?? 5;
  const started = Date.parse(s.phaseStartedAt || s.startedAt || "") || now;
  const floor = s.floorSkippedPhase === s.phase ? 0 : Math.max(0, budget - lead); // the user typed "skip floor"
  return { elapsedMin: (now - started) / 60000, floorMin: floor, ceilMin: budget };
}
const CHALLENGES = [
  "attack one spec assumption: what input or user breaks it?",
  "check one golden expected output against the code or data by hand",
  "re-test one edge case end to end and record the result",
  "re-read SPRINT.md against what is built: list every claim that is not yet true",
  "ask a cold subagent (devil-advocate) to find the weakest decision of this phase",
];

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
  if (s.phase === 1) { const m = missingArtifacts(root); if (m.length) fail.push(`Phase 1 artifacts missing: ${m.join(", ")}`); fail.push(...discoverLogFails(root, g)); }
  if (s.phase === 2) {
    const t = spawnSync("python", ["-m", "pytest", "-q"], { cwd: root, encoding: "utf8", timeout: 300000 });
    if (t.status !== 0) fail.push(`pytest exit ${t.status}`);
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

function main() {
  if (process.argv[2] === "advance") {
    const root = process.cwd(), s = readJson(statePath(root));
    if (!s || !s.active) { console.log("no active sprint"); process.exit(1); }
    const fail = exitGate(root, s, config(root));
    if (fail.length) { s.exitRequested = true; saveState(root, s); console.log(`[BLOCKED] Phase ${s.phase} exit gate:\n- ${fail.join("\n- ")}`); process.exit(1); }
    s.exitRequested = false; s.phaseStartedAt = new Date().toISOString(); s.floorStopBlocks = 0; s.ceilNoticed = false;
    if (s.phase === 6) { s.active = false; spawnSync("python", [path.join(root, "scripts", "evolve_skills.py")], { cwd: root, stdio: "inherit" }); }
    else s.phase++;
    saveState(root, s); log({ phase: s.phase, to: "phase", outcome: s.active ? "advanced" : "sprint-closed" });
    console.log(s.active ? `[DONE] Phase ${s.phase}/6 (${NAMES[s.phase - 1]}). Load Skill(phase-${NAMES[s.phase - 1]}) first.` : "[DONE] Sprint closed; evolve_skills.py ran.");
    return;
  }
  let inp = {}; try { inp = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); } catch {}
  const root = process.env.CLAUDE_PROJECT_DIR || inp.cwd || process.cwd(), ev = inp.hook_event_name;
  const cfg = config(root);

  if (ev === "UserPromptSubmit") {
    const phrases = cfg.autoTriggerPhrases || ["start a sprint", "run a sprint"];
    if (phrases.some(p => (inp.prompt || "").trim().toLowerCase().startsWith(p))) {
      const bad = orchestratorMismatch(root, cfg, inp.transcript_path);
      if (bad) { log({ phase: 0, to: "orchestrator", outcome: "wrong-model", flags: [bad] });
        block(`[BLOCKED] Sprint needs ${cfg.orchestrator.model} at ${cfg.orchestrator.effort} effort (${bad}). Run /model ${cfg.orchestrator.model} and /effort ${cfg.orchestrator.effort}, then say "start a sprint" again. (.claude/settings.local.json now pins both for new sessions; an /effort changed mid-session is not visible to hooks.)`); }
      const now = new Date().toISOString();
      const s = { active: true, phase: 1, startedAt: now, phaseStartedAt: now, skillsLoaded: [], userGo: false, autoRoute: (cfg.router || {}).autoRoute !== false };
      saveState(root, s); log({ phase: 1, to: "phase", outcome: "sprint-started" });
      const w = phaseWindow(s, cfg);
      context(ev, `SPRINT ACTIVE (Phase 1/6: Discover, window ${w.floorMin}-${w.ceilMin} min). Your FIRST tool call MUST be Skill(sprint-orchestrator) then Skill(phase-discover). Ask the user at least ${(cfg.gates || {}).discoverMinUserQuestions ?? 15} questions and keep challenging the spec until the floor; advance refuses earlier. Automatic ab-route.js routing is ${s.autoRoute ? "ON" : "OFF"} (sprint.config.json). Advance phases only with \`node scripts/hooks/sprint-gate.js advance\` after the user says go.`);
    }
  }
  const s = readJson(statePath(root)); if (!s || !s.active) return;
  // Only the user's own prompt can lift the floor (the phase's checks still run on advance).
  if (ev === "UserPromptSubmit" && /^skip floor\b/i.test((inp.prompt || "").trim())) {
    s.floorSkippedPhase = s.phase; saveState(root, s); log({ phase: s.phase, to: "phase", outcome: "floor-skipped" });
    context(ev, `[DONE] Phase ${s.phase}/6 floor lifted by the user. The exit gate's other checks still apply; post the scorecard and ask for go.`);
  }
  const ti = inp.tool_input || {};
  if (ev === "PreToolUse" && (inp.tool_name === "Edit" || inp.tool_name === "Write")) preEdit(root, s, ti.file_path);
  else if (ev === "PreToolUse" && inp.tool_name === "Bash") preBash(s, ti.command || "");
  else if (ev === "PostToolUse") postTool(root, s, inp);
  else if (ev === "PostToolUseFailure") log({ phase: s.phase, to: inp.tool_name, outcome: "tool-failure", flags: [String(inp.error || "").slice(0, 200)] });
  else if (ev === "Stop") stopGate(root, s, cfg, inp);
  if (ev === "UserPromptSubmit" || ev === "PostToolUse") ceilingNotice(root, s, cfg, ev);
}

// Stop: under the floor, Claude keeps validating (bounded); a requested exit is re-checked once.
function stopGate(root, s, cfg, inp) {
  const w = phaseWindow(s, cfg), max = (cfg.gates || {}).maxFloorStopBlocks ?? 10, n = s.floorStopBlocks || 0;
  if (w.elapsedMin < w.floorMin && n < max) {
    s.floorStopBlocks = n + 1; saveState(root, s);
    block(`[BLOCKED] Phase ${s.phase}/6 (${NAMES[s.phase - 1]}) floor: ${Math.ceil(w.floorMin - w.elapsedMin)} min left before this phase may end. Next validation round: ${CHALLENGES[n % CHALLENGES.length]}. Record it${s.phase === 1 ? " in .sprint/discover-log.json challengeRounds" : " in SPRINT.md"}, then continue.`);
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
