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
3. Claude builds by default. Wall-clock minutes are the scarce resource, not tokens (Sprint 1 lost 12-18 min to
   executor stalls, two isolation breaches and an exhausted quota pool). Critical-path work, anything without a
   measurable check, and core domain/scientific logic: Claude in its own worktree.
4. Model split, to protect the 5-hour usage window: Opus (you) plans, decides and reviews; implementation slices go
   to the `builder` agent (Sonnet) when they are independent. Check `/usage` at each phase end and put the % in the
   scorecard's [TIME] line. Above 70% with phases left: move more slices to `builder`, keep Opus for review only.
5. Router (`node ~/.claude/bin/ab-route.js --class <bulk|large|agy> --accept "<metric>" --repo . "<outcome>"`) only for
   independent, mechanical, off-critical-path jobs: seed data, bulk tests, docs, repeating a pattern across files.
   Run `--status` first. Not started in 60 s, or one failed chain: implement directly, no `--reset`, no retry.
   Never edit the main checkout while a route-* worktree is live.
6. Phase end: post the scorecard, wait for the user to type `go`, then run `node scripts/hooks/sprint-gate.js advance`
   (runs the exit gate: every phase its floor, P1 15+ user questions + 5 challenge rounds, P2 pytest + LOC,
   P3 walkthrough + axe 0, P6 live URL + video + README claims).

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
