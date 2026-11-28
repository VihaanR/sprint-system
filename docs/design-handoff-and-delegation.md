# Design: context handoff at 40% + cheap-executor waves with one Sonnet review

Status: proposed (user request, 2026-11-28 post-mortem of the Sheetal sprint, complaints C21–C27 in
V:/Projects/practice-1/SPRINT.md). Build in a fresh session.

## Goals
1. Keep the orchestrator's context healthy: never run a sprint past ~40% context in one session.
2. Spend Claude tokens on planning and review only: cheap executors (agy, opencode freellmapi/auto, DeepSeek) write
   the code; one Sonnet pass reviews every branch at once; Opus writes no code.

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

## 2. Waves: cheap executors code, one Sonnet review
- **Assignment by job shape:** agy → large multi-file slices; opencode freellmapi/auto → single-file mechanical
  (tests, docs, seed data, one component); DeepSeek → logic slices and fix passes. Each job: own worktree + branch
  `wave/<phase>-<n>-<slug>`.
- **Router `--wave wave.json`:** dispatch N jobs in parallel (unique ids incl. pid; ≥0 s stagger now that ids are
  unique), one JSON result. Every job carries `--accept-cmd` (build/tests + anti-stub check, e.g. min lines and a
  required import); the router runs it in the worktree; only passing jobs count as done.
- **agy path:** call `agy -p` directly in the job worktree (the agent-bridge launch stayed `queued` and never
  started agy). Liveness = worktree edits or agy log growth; startup limit 180 s.
- **Barrier:** wave ends when all jobs are done, failed or timed out (per-job hard limit 20 min).
- **One Sonnet review:** a single `builder`-model reviewer gets all branch diffs + accept-cmd output in one brief;
  returns per branch `merge | fix(file:line, why) | reject`. Fix items go back to the same cheap executor once,
  then to a Sonnet builder. Opus reads only the verdict table, then merges the passing branches at the boundary.
- **Health check at sprint start:** smoke-test every executor through the exact router path; failures mark the
  executor down in the sidebar and in the plan before any assignment.

## Acceptance
- A sprint with a simulated 41% context gets a HANDOFF.md written, `/clear`, and resumes the next action from the
  file with no other context.
- A wave of 3 jobs (one per executor) produces 3 branches, one Sonnet review table, and merges only passing ones;
  Opus tool calls in the wave contain no Edit/Write to source files.
