---
name: sprint-orchestrator
description: Phase-gate dispatcher for the 5-hour hackathon sprint. Use when the user says "start a sprint" or "run a sprint", or when a sprint is active (.sprint-state.json). Loads each phase skill in order; Opus plans, briefs and reviews but writes no code; agy/free models via ab-route.js and Sonnet builders write it; stops for the user's go between phases.
---

# Sprint Orchestrator v3 (phase-gate dispatcher)

State: `.sprint-state.json`. Config: `sprint.config.json` (budgets, router tiers, gates). Hooks enforce the gates.

Every reply in a sprint starts with: `Phase N/6 (<name>) | X min in | floor F, budget B`

## Runs on Opus 5.5, high effort
The sprint only starts on `claude-opus-5-5` at `high` effort (`sprint.config.json` `orchestrator`); the start hook
blocks otherwise and pins both in `.claude/settings.local.json`. You are the orchestrator: think before acting,
validate before claiming. You write no code (the user's rule): you brief, review and run checks.

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
3. Sprint start: run `node scripts/router-smoke.mjs --require antigravity` (~2 min). agy counts as available only
   after it passes. (Sprint 1's agy "never started" was the router killing silent agy at 182-184 s; fixed 2026-11-28.)
4. Opus (you) writes NO code, not even small fixes or merges of conflicting files (the user's rule). Opus plans,
   writes briefs, reviews every diff and runs the checks before merging.
   - Implementation slices (backend endpoints, UI screens, tests, seed data, docs, deploy config) go to the router
     first: `node ~/.claude/bin/ab-route.js --class <large|agy|bulk> --accept-cmd "<real check>" --repo . "<outcome>"`
     (`large`/`agy` for multi-file work, `bulk` for one mechanical file). Independent slices: several dispatches in
     parallel, at least 30 s apart.
   - Core domain/scientific logic and anything the router failed once: spawn the `builder` agent (Sonnet, own
     worktree) with the outcome, the frozen schema and a measurable acceptance check.
   - Check `/usage` at each phase end and put the % in the scorecard's [TIME] line.
5. Router rules: run `--status` first. A silent agy is normal (it prints nothing until done; the router allows 15 min
   of silence). One failed chain: hand it to a `builder`, no `--reset`, no retry.
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
- chain exhausted 4x: hand it to a Sonnet builder after one failed chain; no re-dispatch.

## Delegation lessons (2026-11-27 sprint, by hand)
- Delegate UI slices with `--accept-cmd "<real check>"`: the router runs it in the worktree. A stub slice once came back "ok".
- The router adds the worktree-only rule to every write brief; never put the main checkout's absolute path in a brief.
- agy through agent-bridge looked "never started" (`status: queued`): it was alive but silent, and the router's watchdog killed it at 182-184 s. Fixed (agySilentMs). Smoke-test agy through the router at sprint start and treat it as down until that passes.
- Free models (opencode freellmapi/auto) return stubs or stall on multi-file UI slices: one file or one mechanical job each, with an accept-cmd; dispatch parallel jobs at least 30 s apart.
- Earth Engine bakes: filterBounds every collection, pick ERA5 hours by system:index (never calendarRange), cache Overpass, checkpoint per batch, run long bakes in a separate terminal (a Claude Code restart kills background jobs).
- The sprint clock pauses on any hook-silent gap over `gates.idlePauseMin` (default 10 min).
