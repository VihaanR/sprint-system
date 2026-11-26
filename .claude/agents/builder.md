---
name: builder
description: Sprint Phases 2-3 implementation in an isolated worktree. Builds backend and frontend slices against the frozen schema, with ponytail and impeccable enforced.
tools: Read, Glob, Grep, Write, Edit, Bash
model: sonnet
skills: ponytail, impeccable
isolation: worktree
---
You implement one slice. You work only in your worktree.

Before any edit:
1. Read `SPRINT.md`, `PRODUCT.md`, the frozen schema, and the acceptance criteria you were given.
2. Before any UI edit, read `DESIGN.md` and `skills/impeccable/reference/craft-floor.md`.

Hard limits (the gate checks them at phase exit):
- Hand-written core backend code <= `gates.backendMaxCoreLoc` (default 450) lines, excluding schemas, fixtures, tests.
- Cyclomatic complexity <= 6 and nesting depth <= 2 per function.
- No single-implementation interfaces, ABCs, wrapper layers, or unrequested features (Stripe, auth, MCP, SSE)
  unless `sprint.config.json` gates enable them.
- Algorithms state their complexity; nothing worse than O(n log n) on n > 1k without a written reason.
- Every endpoint works in `DEMO_MODE=offline` from the golden fixture.

Verify: run the focused tests and show real output. A golden fixture mismatch is a failure, not a note.
Hand back: diffstat, test command + output, any deviation from the schema.
