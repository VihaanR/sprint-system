# Design: context handoff at 40% + parallel waves under the CEO / Sonnet-manager model

Status: proposed (designed, not built; 2026-11-28 post-mortem of the Sheetal sprint, complaints C21–C27 in
V:/Projects/practice-1/SPRINT.md). Build in a fresh session.

## Goals
1. Keep the orchestrator's context healthy: never run a sprint past ~40% context in one session.
2. Enforce the chain of command: Opus (CEO) owns decisions, architecture, core domain/scientific code only, and final
   review; Sonnet `builder` managers dispatch slices through `ab-route.js`, review worker diffs, and fix failures;
   `agy` and `opencode` (`freellmapi/auto`) are the workers.

## 1. Handoff at 40% context
- **Measure:** in `sprint-gate.js` (PostToolUse + Stop), read the transcript JSONL tail; context% = last assistant
  turn's input tokens (incl. cache read/creation) / model context window. Store `state.contextPct`.
- **Thresholds:** ≥40% → Stop is blocked with "finish the current atomic step, then write `.sprint/HANDOFF.md`";
  if a phase boundary is within ~10 min, hand off there instead. ≥55% → PreToolUse blocks Edit/Write/Bash (except
  writing HANDOFF.md and git) until the handoff exists.
- **HANDOFF.md (≤150 lines, template in the orchestrator skill):** phase + clock; decisions (links to SPRINT.md
  rows); every live branch, worktree, router job and detached job with log paths; last /verify result; user
  preferences and open complaints; next 3 actions; exact resume instruction.
- **Resume:** user types `/clear` (sprint-mod adds a "Hand off" button that writes nothing itself, only prompts).
  SessionStart (source `clear`/`startup`) sees `state.handoff.pending` and injects HANDOFF.md + SPRINT.md tail +
  `git log --oneline -15`; sets `pending=false`, increments `state.handoffs`. The idle-pause clock covers the gap.
- **Sidebar:** shows context % and handoff count; turns warn at 35%.

## 2. Waves: Sonnet managers dispatch worker waves via `ab-route.js`
- **Assignment by job shape:** Opus (CEO) writes core domain/scientific code only; `agy` (`--class large`/`agy`,
  Gemini 4 Hydrogen → Gemini 3.8 Flash) → multi-file slices; `opencode` (`--class bulk`, `freellmapi/auto`) →
  single-file mechanical work (tests, docs, seed data, one component). Parked executors (`opencode:go`, `hermes`)
  are skipped. Each job gets its own `route-*` worktree and `route/<id>` branch.
- **Router `--wave wave.json`:** dispatch N jobs in parallel, one JSON result. Every write job passes `--accept`
  (required by `sprint-gate.js`) and `--accept-cmd` (run by `ab-route.js` in the worktree); committed and/or staged
  worker work both count (JSON `work` field).
- **agy path (current router contract):** launched through `agent-bridge` in per-job session
  `sprint-p<N>-<class>-<taskId>` with a no-subagents line in the brief. Liveness = output, worktree edits, or writes
  to `~/.gemini/antigravity-cli/conversations` (`agyIdleMs` 300s idle = stall; `agySilentMs` 900s upper bound;
  startup stall only after `agyStartupStallMs >= 180s` with no agent-bridge output, or on exit with no output and no
  edits). One stall is tolerated; a second in a row trips for at most 30 min.
- **Barrier:** wave ends when all jobs are done, failed, or hit the 25 min chain cap (`maxChainWallMs` 1500000;
  per-job `hardTimeoutMs` 1200000).
- **Sonnet-manager review and recovery:** each Sonnet `builder` reviews its workers' diffs + `--accept-cmd` output and
  merges or fixes failures (a failed router chain goes to the Sonnet `builder`, never to Opus). Opus reads only the
  manager handbacks, reviews the final diffs, and merges at the boundary.
- **Health check at sprint start:** `node V:/Projects/sprint/scripts/router-smoke.mjs --require antigravity` (works
  from any folder; recorded in `.sprint/preflight.json`).

## Acceptance
- A sprint with a simulated 41% context gets a HANDOFF.md written, `/clear`, and resumes the next action from the
  file with no other context.
- A wave of 3 slices produces `route-*` branches, Sonnet `builder` diff reviews, and merges only passing ones;
  Opus edits only core domain/scientific files, never delegated worker slices.
