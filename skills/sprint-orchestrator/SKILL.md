---
name: sprint-orchestrator
description: Phase-gate dispatcher for the 5-hour hackathon sprint. Use when the user says "start a sprint" or "run a sprint", or when a sprint is active (.sprint-state.json). Loads each phase skill in order; Opus is the CEO (decisions, core science, final review); Sonnet builders manage agy/free models via ab-route.js and review their work; stops for the user's go between phases.
---

# Sprint Orchestrator v3 (phase-gate dispatcher)

State: `.sprint-state.json`. Config: `sprint.config.json` (budgets, router tiers, gates). Hooks enforce the gates.

Every reply in a sprint starts with: `Phase N/6 (<name>) | X min in | floor F, budget B`

## Runs on Opus 5.5, high effort
The sprint only starts on `claude-opus-5-5` at `high` effort (`sprint.config.json` `orchestrator`); the start hook
blocks otherwise and pins both in `.claude/settings.local.json`. You are the orchestrator: think before acting,
validate before claiming. You are the CEO: decisions, architecture and the core science code; nothing else.

## Phase window: floor = budget − 5 min, ceiling = budget
- A phase may not end before its floor. `advance` refuses, and stopping early is blocked with the next validation
  round (up to `maxFloorStopBlocks` rounds per phase). Finishing early means validating more, not idling:
  run the tests, re-check golden outputs, attack an assumption, re-read the spec against the build.
- Only the user can lift a floor, by typing `skip floor`. Never suggest it to save time.
- At the budget the hook says `[OVER BUDGET]`: post the scorecard and ask for go at once.

## Phase loop
1. The FIRST tool call of each phase is `Skill(phase-<name>)`: discover, backend, frontend, polish, audit, launch.
   The PreToolUse hook blocks code edits until it is loaded.
2. Phase 1 output (`PRODUCT.md`, `DESIGN.md`, golden fixture, frozen schema, `.sprint/preflight.json`, `.sprint/user-asks.json`) gates later phases.
3. Sprint start: run `node V:/Projects/sprint/scripts/router-smoke.mjs --require antigravity` (works from any folder; flags `--router`, `--timeout-min`, `--require`, `--dry`) and record it in `.sprint/preflight.json`. `agy` counts as available only after it passes.
4. Chain of command (the user's rule):
   - Opus (you) = CEO: decisions, architecture, the frozen schema, and the core domain/scientific logic (the only
     code you write). You review what each Sonnet manager hands back and run the checks before merging.
   - Sonnet `builder` = manager: one per slice (backend endpoints, UI screens, tests, seed data, docs, deploy
     config). It dispatches the implementation to agy/free models through the router
     (`node ~/.claude/bin/ab-route.js --class <large|agy|bulk> --accept "<metric>" --accept-cmd "<real check>" --repo . "<outcome>"`),
     reviews their diff, and redoes or fixes what fails. Brief it with the outcome, the frozen schema and a
     measurable acceptance check. Independent slices: several builders in one message, in parallel.
   - agy / opencode = workers: they write the slice code.
   - Check `/usage` at each phase end and put the % in the scorecard's [TIME] line.
5. Router rules: run `--status` once per phase before dispatching; parked executors (`opencode:go`, `hermes`) are skipped.
   `agy` runs via `agent-bridge` in session `sprint-p<N>-<class>-<taskId>` with a no-subagents line in its brief. Liveness
   tracks output, worktree edits, or `~/.gemini/antigravity-cli/conversations` writes (`agyIdleMs` 300000 = 5 min stall;
   `agySilentMs` 900000 = 15 min upper bound; startup stall only after `agyStartupStallMs >= 180000` with no agent-bridge
   output, or on exit with no output and no edits). One stall is tolerated; a second in a row trips for at most 30 min
   (no sprint-long ban). Committed and/or staged worker work both count (JSON `work` field). `maxChainWallMs` = 25 min (`1500000`).
   A failed router chain goes to the Sonnet `builder`, never to Opus; no `--reset`. Never edit the main checkout while a `route-*` worktree is live.
6. Phase end: post the scorecard, wait for the user to type `go`, then run `node V:/Projects/sprint/scripts/hooks/sprint-gate.js advance`
   (checks floor with phase-aware stop rounds, 15+ answered user questions, `.sprint/user-asks.json` with no unconfirmed cuts
   and open asks printed, P1 discover-log + preflight, P2 pytest + LOC, P3 walkthrough + axe 0 + showcase + design gate,
   P4 showcase + design gate, P6 live URL + video + README claims).
7. User questions in EVERY phase: at least 15 `AskUserQuestion` answers per phase (`gates.minUserQuestionsPerPhase`), counted via the PostToolUse `AskUserQuestion` matcher into `questionsByPhase`; `advance` refuses below 15.
8. After Phase 3 (frontend) and Phase 4 (polish): open the running app in the user's browser and print the clickable link before the scorecard; the phase skill writes `.sprint/showcase-<phase>.json` and `advance` requires it.
9. Right after Phase 2 (backend): list every key in `.env.example` with comments, ask the user to copy it to `.env` and fill it in, then exercise the live paths with the real keys before advancing.
10. Phase 6 launch video: ask the user the tone before building; default to high energy (chaotic or cinematic), never calm polished by default. Music is upbeat by default (major key, bright), never just tense.
11. Phase 4 (polish): design 2-3 logo options and get the user to approve one (AskUserQuestion with previews) before the phase ends; the approved logo goes in the app header, favicon and the launch video.

## Sprint report (automatic)
- A message starting with `wtf` is the user's complaint: the hook logs it word for word. Fix the cause if it is in
  scope, but never argue with it or ask them to rephrase. Frustrated-sounding messages and Esc interrupts are logged too.
- `end sprint` (user only) stops the sprint early. Every `advance` and `end sprint` rewrites `SPRINT-REPORT.md` in the
  project and copies it to `V:/Projects/sprint/docs/sprint-reports/` (local only, gitignored: it quotes the user).
- Post-mortem: read every file in `docs/sprint-reports/`, rank by minutes lost and `wtf` count, propose at most 3 fixes.

## Executive Scorecard (5 lines, end of each phase)
```
[DONE]   <artifacts shipped, with paths>
[VERIFY] <command> -> <exit code / count>
[RISK]   <top open risk or none>
[TIME]   <used> / <budget> min this phase (floor <F>)
[NEXT]   Phase N+1 (<name>): <first action>. Type go.
```

## Learned guardrails (auto, evolve_skills.py)
- executor quota trips seen 2x: prefer freellmapi/auto; batch slices into one dispatch.
- chain exhausted 4x: the Sonnet builder fixes it after one failed chain; no re-dispatch.

## Delegation lessons (2026-11-27 sprint, by hand)
- Delegate UI slices with `--accept "<metric>"` and `--accept-cmd "<real check>"`: the router runs it in the worktree. A stub slice once came back "ok".
- The router adds the worktree-only rule (plus a no-subagents line for `agy`) to every write brief; never put the main checkout's absolute path in a brief.
- Free models (`opencode` `freellmapi/auto`) return stubs or stall on multi-file UI slices: one file or one mechanical job each, with an `--accept-cmd`; dispatch parallel jobs at least 30 s apart.
- Earth Engine bakes: filterBounds every collection, pick ERA5 hours by system:index (never calendarRange), cache Overpass, checkpoint per batch, run long bakes in a separate terminal (a Claude Code restart kills background jobs).
- The sprint clock pauses on hook-silent gaps over `gates.idlePauseMin` (default 10 min) only when no tracked tool is in flight (`AskUserQuestion` has no `PreToolUse` hook, so >10 min thinking on a question counts as a pause). `.sprint-state.json` is written atomically.
