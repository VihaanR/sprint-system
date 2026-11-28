---
name: phase-discover
description: Phase 1 of the 5-Hour Hackathon Sprint. Interrogates the user with 15+ questions, challenges its own spec until the phase floor, and produces PRODUCT.md, DESIGN.md, a golden fixture and a frozen schema. Uses devil-advocate, impeccable (init/shape), mobbin, context7, api-design-principles and mermaid-expert.
---

# Phase 1: Discover (budget 30 min, floor 25 min)

Goal: a spec that survives attack. The time is spent asking and challenging, not writing fast.
The hook refuses `advance` before the floor (budget − `phaseFloorLeadMin`) and makes you keep validating if you
stop early. Ending in 5 minutes is a failure of this phase, not a win.

Record everything in `.sprint/discover-log.json`:
```json
{ "userQuestions":   [{ "q": "...", "answer": "...", "topic": "users" }],
  "challengeRounds": [{ "claim": "...", "attack": "...", "evidence": "...", "verdict": "kept|changed|cut" }] }
```
The exit gate needs at least 15 answered questions and 5 challenge rounds (`sprint.config.json` gates).

- **User questions (every phase):** ask at least 15 questions with `AskUserQuestion` before the phase may end (this is on top of the discover-log checks above)
  (`gates.minUserQuestionsPerPhase`). A PostToolUse hook counts them into `.sprint-state.json` `questionsByPhase`;
  `advance` refuses below 15. Ask about this phase's real decisions (trade-offs, thresholds, edge cases, cuts), 4 per call.

## Step 1: interrogate the user (15+ questions, about 10 min)
Ask with `AskUserQuestion`, 4 questions per call, in at least 4 rounds. Never answer a question for the user
when the repo and the brief don't settle it. Write each answer to the log as soon as it arrives.

| Round | Topic | Ask about |
|---|---|---|
| 1 | Problem and users | who exactly uses it, the pain today, how they solve it now, what success looks like |
| 2 | Scope and moat | the one demo moment, what is out of scope, why it is not a thin AI wrapper, judging criteria |
| 3 | Data and domain | real data sources, edge cases and failure modes, domain rules and thresholds, legal or safety limits |
| 4 | Constraints and launch | stack and hosting, offline demo needs, accounts and keys, Stripe yes or no, video length |

Each answer can raise follow-ups: ask them in a fifth round. Offer concrete options with a recommended first
option, so each question takes the user seconds. Questions the repo already answers don't count.

## Step 2: build the spec
1. `scripts/impeccable context`, then `impeccable init` → `PRODUCT.md` (user, hero demo, moat, out of scope).
2. `DESIGN.md`: tokens derived from the product (see `skills/impeccable/reference/craft-floor.md`).
3. Golden fixture: one realistic record set under `fixtures/` plus `fixtures/*golden*` with computed expected outputs.
4. `SPRINT.md`: mermaid data flow and ERD (`mermaid-expert`), API contract, `DEMO_MODE=offline` plan.
5. One domain-expert review (the `discover` agent or a cold subagent) on the fixture and thresholds.

## Step 3: challenge loop until the floor
Repeat until the floor; each round goes in `challengeRounds` and in a SPRINT.md "Challenge log":
1. Pick one claim from the spec (a threshold, a data assumption, a user need, the moat).
2. Attack it: the `devil-advocate` skill, or a cold subagent given only the claim.
3. Check it against evidence: data, docs (`context7`), competitors (`mobbin`), the golden fixture.
4. Verdict: kept, changed (edit the spec now) or cut. A changed answer from the user counts as new evidence.

Good rounds find something. Five rounds that all say "kept" means the attacks were too soft.

## Step 4: pre-flight (router and services)
Before exiting Discover, verify execution tooling and every external dependency works right now:
1. Run `node V:/Projects/sprint/scripts/router-smoke.mjs --require antigravity` and record `exitCode` (nonzero needs a user waiver via `AskUserQuestion`).
2. List every external service, login, and API key the spec needs and test each once (log in, make one real call). For any failure, ask the user (`AskUserQuestion`) whether to fix it now or cut it.
3. Write `.sprint/preflight.json` (`"services": []` if none needed):
```json
{ "routerSmoke": { "exitCode": 0 },
  "services": [{ "name": "Earth Engine login", "status": "ok|cut", "userConfirmed": true }] }
```
(If router smoke failed and the user waived it: `{ "waivedByUser": true, "reason": "..." }`.)

## Step 5: user-asks ledger
Capture every explicit user ask (features, integrations, visuals, deliverables the user named) in `.sprint/user-asks.json`:
```json
[{ "ask": "3D explainer", "phase": 3, "status": "planned", "userConfirmedCut": false }]
```
- `status` is `planned | done | cut`. Never demote an ask to stretch or cut silently: a cut needs explicit user confirmation (`AskUserQuestion`) and `"userConfirmedCut": true`.
- Update `status` to `done` when built; `advance` prints open `planned` asks and refuses unconfirmed cuts.

## Step 6: freeze and hand off
- Freeze the schema (`types.ts`, OpenAPI or Pydantic). Changes after this need the user's go.
- Post the scorecard with `[TIME] <used> / 30 min (floor 25)` and wait for go.
- If you are over budget, the hook says so: post the scorecard at once.
