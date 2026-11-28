---
name: sprint-orchestrator
description: Phase-gate dispatcher for the 5-hour hackathon sprint. Use when the user says "start a sprint" or "run a sprint", or when a sprint is active (.sprint-state.json). Loads each phase skill in order, builds directly (Opus plans and reviews, Sonnet builder slices), uses ab-route.js only for off-critical-path bulk jobs, and stops for the user's go between phases.
---

# Sprint Orchestrator v3 (phase-gate dispatcher)

State: `.sprint-state.json`. Config: `sprint.config.json` (budgets, router tiers, gates). Hooks enforce the gates.

Every reply in a sprint starts with: `Phase N/6 (<name>) | X min in | floor F, budget B`

## Runs on Opus 5.5, high effort
The sprint only starts on `claude-opus-5-5` at `high` effort (`sprint.config.json` `orchestrator`); the start hook
blocks otherwise and pins both in `.claude/settings.local.json`. You are the orchestrator: think before acting,
validate before claiming, and keep core logic yourself.

## Phase window: floor = budget − 5 min, ceiling = budget
- A phase may not end before its floor. `advance` refuses, and stopping early is blocked with the next validation
  round (up to `maxFloorStopBlocks` rounds per phase). Finishing early means validating more, not idling:
  run the tests, re-check golden outputs, attack an assumption, re-read the spec against the build.
- Only the user can lift a floor, by typing `skip floor`. Never suggest it to save time.
- At the budget the hook says `[OVER BUDGET]`: post the scorecard and ask for go at once.

## Phase loop
1. The FIRST tool call of each phase is `Skill(phase-<name>)`: discover, backend, frontend, polish, audit, launch.
   The PreToolUse hook blocks code edits until it is loaded.
2. Phase 1 output (PRODUCT.md, DESIGN.md, golden fixture, frozen schema) gates every later phase.
3. Claude builds, not the router: wall-clock minutes are the scarce resource (Sprint 1 lost 12-18 min to executor
   stalls, two isolation breaches and an exhausted quota pool).
4. Sonnet writes the code, Opus (you) runs the sprint (the user's choice: it protects the 5-hour usage window).
   - Default for every implementation slice (backend endpoints, UI screens, tests, seed data, deploy config):
     spawn the `builder` agent (Sonnet, own worktree) with the outcome, the frozen schema and a measurable acceptance
     check. Independent slices: several `builder` agents in one message, in parallel.
   - Opus writes code itself only for: core domain/scientific logic (the part judges probe), fixes under ~20 lines,
     merging builder worktrees, or a slice a builder already failed once.
   - Opus always: plans, writes briefs, reviews every builder diff and runs the checks before merging.
   - Check `/usage` at each phase end and put the % in the scorecard's [TIME] line. Above 70% with phases left,
     Opus stops writing code entirely and only reviews.
5. Router (`node ~/.claude/bin/ab-route.js --class <bulk|large|agy> --accept "<metric>" --repo . "<outcome>"`) only for
   independent, mechanical, off-critical-path jobs: seed data, bulk tests, docs, repeating a pattern across files.
   Run `--status` first. Not started in 60 s, or one failed chain: implement directly, no `--reset`, no retry.
   Never edit the main checkout while a route-* worktree is live.
6. Phase end: post the scorecard, wait for the user to type `go`, then run `node V:/Projects/sprint/scripts/hooks/sprint-gate.js advance`
   (runs the exit gate: every phase its floor and 15+ answered user questions, P1 5 challenge rounds, P2 pytest + LOC,
   P3 walkthrough + axe 0 + showcase, P4 showcase, P6 live URL + video + README claims).
7. User questions in EVERY phase: at least 15 `AskUserQuestion` questions per phase (`gates.minUserQuestionsPerPhase`); a PostToolUse hook counts them in `questionsByPhase` and `advance` refuses below 15.
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
- chain exhausted 4x: implement directly after one failed chain; no re-dispatch.

## Delegation lessons (2026-11-27 sprint, by hand)
- Delegate UI slices with `--accept-cmd "<real check>"`: the router runs it in the worktree. A stub slice once came back "ok".
- The router adds the worktree-only rule to every write brief; never put the main checkout's absolute path in a brief.
- agy through agent-bridge stayed `status: queued` and never started, while agy called directly answered in ~110 s. Smoke-test agy through the router at sprint start and treat it as down until that passes. Disable slow MCP servers in agy (`agy mcp disable <name>`).
- Free models (opencode freellmapi/auto) return stubs or stall on multi-file UI slices: one file or one mechanical job each, with an accept-cmd; dispatch parallel jobs at least 30 s apart.
- Earth Engine bakes: filterBounds every collection, pick ERA5 hours by system:index (never calendarRange), cache Overpass, checkpoint per batch, run long bakes in a separate terminal (a Claude Code restart kills background jobs).
- The sprint clock pauses on any hook-silent gap over `gates.idlePauseMin` (default 10 min).
