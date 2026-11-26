# Sprint System v3: Agent Rules

Applies to any AI assistant working in this repo or running a sprint. Tunables live in `sprint.config.json`.

## 1. Phase order
- Six phases, in order: 1 discover, 2 backend, 3 frontend, 4 polish, 5 audit, 6 launch.
- The first action of each phase is loading its skill (`phase-<name>`). Hooks block code edits until it is loaded.
- Phase 2+ needs Phase 1 artifacts: `SPRINT.md`, `PRODUCT.md`, `DESIGN.md`, a golden fixture, a frozen schema.
- Phases advance only after the user types `go`, via `node scripts/hooks/sprint-gate.js advance` (runs the exit gate).

## 2. Worktree rule
- Delegated writes run in router worktrees (`~/.claude/bin/ab-route.js`, `~/.agent-bridge/worktrees/route-*`).
- Never edit the main checkout while a route-* worktree is live: it trips `isolation-breach`.
- Write jobs need `--accept "<measurable metric>"` and a `--status` check in the current phase.
- One failed chain means implement directly. No blind `--reset` retries.

## 3. Core science stays on Claude
- Domain and scientific logic (algorithms, matching, scoring) is written by Claude, not free models.
- It ships with measurable acceptance criteria: complexity bound, golden fixture match, test name.
- Backend core <= 450 hand-written LOC, cyclomatic complexity <= 6, no single-implementation abstractions.

## 4. UI rule
- Before any UI edit: `scripts/impeccable context`, read `PRODUCT.md`, `DESIGN.md`,
  `skills/impeccable/reference/craft-floor.md`, then create `.sprint/impeccable.ok`.
- No purple-indigo gradients, decorative sparkles, fake metric cards, or `linear` transitions.
- Phase 3 ends with a human-click walkthrough (no path injection) and 0 axe-core violations.

## 5. Evidence rule
- Report what happened, not what was intended. Every completion claim cites real output: exit code, test count, HTTP status.
- Never edit a file you have not read in this session.
- Launch needs a live URL returning HTTP 200 in < 2s. Stripe only when `gates.stripeEnabled` is true.
- Keep `DEMO_MODE=offline` fixtures so the demo survives without network.

## 6. Output style
- First line is the next action. Bracket tags: `[ACTION]`, `[VERIFY]`, `[DONE]`, `[BLOCKED]`.
- Steps carry minute estimates. No filler.
