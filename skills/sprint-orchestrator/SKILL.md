---
name: sprint-orchestrator
description: Phase-gate dispatcher for the 5-hour hackathon sprint. Use when the user says "start a sprint" or "run a sprint", or when a sprint is active (.sprint-state.json). Loads each phase skill in order, routes delegable work through ab-route.js, and stops for the user's go between phases.
---

# Sprint Orchestrator v3 (phase-gate dispatcher)

State: `.sprint-state.json`. Config: `sprint.config.json` (budgets, router tiers, gates). Hooks enforce the gates.

Every reply in a sprint starts with: `Phase N/6 (<name>) | ~X min left`

## Phase loop
1. The FIRST tool call of each phase is `Skill(phase-<name>)`: discover, backend, frontend, polish, audit, launch.
   The PreToolUse hook blocks code edits until it is loaded.
2. Phase 1 output (PRODUCT.md, DESIGN.md, golden fixture, frozen schema) gates every later phase.
3. Delegate with `node ~/.claude/bin/ab-route.js --class <bulk|large|agy> --accept "<metric>" --repo . "<outcome>"`.
   Run `--status` first in each phase. Never edit the main checkout while a route-* worktree is live.
4. Core domain/scientific logic stays with Claude. Playbooks: `.claude/agents/{discover,builder,auditor,launcher}.md`.
5. On one failed chain, implement directly. No blind `--reset`.
6. Phase end: post the scorecard, wait for the user to type `go`, then run `node scripts/hooks/sprint-gate.js advance`
   (runs the exit gate: P2 pytest + LOC, P3 walkthrough + axe 0, P6 live URL + video + README claims).

## Executive Scorecard (5 lines, end of each phase)
```
[DONE]   <artifacts shipped, with paths>
[VERIFY] <command> -> <exit code / count>
[RISK]   <top open risk or none>
[TIME]   <used> / <budget> min this phase
[NEXT]   Phase N+1 (<name>): <first action>. Type go.
```
