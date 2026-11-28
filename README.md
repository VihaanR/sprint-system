<p align="center">
  <img src="assets/hero-banner.svg" alt="Sprint System" width="100%" />
</p>

<p align="center">
  <img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=15&duration=2600&pause=1000&color=38BDF8&center=true&vCenter=true&width=680&lines=Sprint+System+v3:+6+gated+phases+in+5+hours;Say+%22start+a+sprint%22+and+the+hooks+keep+the+order;Phase+skill+first%2C+exit+gate+last;Delegated+work+runs+in+isolated+worktrees;Claude+keeps+the+core+logic+and+reviews+every+diff" alt="Sprint System v3: 6 gated phases in 5 hours" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/PIPELINE-6_PHASES-38BDF8?style=for-the-badge" alt="6 phases" />
  <img src="https://img.shields.io/badge/BUDGET-5_HOURS-F59E0B?style=for-the-badge" alt="5 hours" />
  <img src="https://img.shields.io/badge/CLAUDE_CODE-HOOKS_%2B_MOD-10B981?style=for-the-badge" alt="Claude Code hooks and mod" />
  <img src="https://img.shields.io/badge/LICENSE-MIT-94A3B8?style=for-the-badge" alt="MIT" />
</p>

<p align="center">
  <img src="assets/wimpy-running-agent.svg" alt="The 5-hour sprint: the running agent" width="100%" />
</p>

# Sprint System v3

A 6-phase, 5-hour build pipeline for Claude Code. You say **"start a sprint"**, and hooks hold the session to the phase order. Each phase loads its skill first and ends at an exit gate that checks real output. Opus (CEO) keeps decisions, architecture, and core domain logic; Sonnet `builder`s dispatch mechanical slices to cheaper workers in isolated git worktrees, review every diff, and fix failures.

v3 rewrites v2 after the Sprint 1 post-mortem. Rules that v2 only wrote down are now hook checks that block the action.

---

## How a sprint runs

```mermaid
flowchart TD
    %% Entry: a phrase from sprint.config.json starts the sprint
    U(["You: 'start a sprint'"]) --> T["UserPromptSubmit hook<br/>writes .sprint-state.json · phase 1"]
    T --> P["SessionStart preflight<br/>free port · vercel/gh auth · LF · router status"]
    P --> S["Load Skill(phase-N)<br/>edits to src/ app/ api/ blocked until loaded"]

    S --> W{"Who does the work?"}
    W -->|"domain logic, scoring,<br/>algorithms"| C["Opus (CEO)<br/>decisions & core logic"]
    W -->|"mechanical, bulk,<br/>multi-file"| SB["Sonnet builder"]
    SB --> R["ab-route.js<br/>needs --accept + --status"]
    R --> X["Worker in route-* worktree<br/>agy → freellmapi/auto"]
    X -->|"diff or fail"| SB
    SB --> RV["Opus final review"]
    C --> G
    RV --> G

    G{"Exit gate<br/>sprint-gate.js advance"}
    G -->|"fails"| S
    G -->|"passes + you type go"| N{"Phase 6?"}
    N -->|"no · phase+1"| S
    N -->|"yes"| E(["evolve_skills.py<br/>sprint closed"])

    classDef you fill:#0F172A,stroke:#38BDF8,color:#E2E8F0
    classDef hook fill:#1E293B,stroke:#F59E0B,color:#F8FAFC
    classDef claude fill:#1E293B,stroke:#10B981,color:#F8FAFC
    classDef exec fill:#1E293B,stroke:#94A3B8,color:#F8FAFC
    class U,E you
    class T,P,S,G hook
    class C,RV,SB claude
    class R,X exec
```

Amber is a hook that blocks the action, green is Opus/Sonnet, grey is a router worker.

## The six phases

<p align="center">
  <img src="assets/phase-pipeline.svg" alt="The six phases with their budgets and gates" width="100%" />
</p>

Budgets come from `sprint.config.json` (300 min total).

| # | Phase | Budget | Exit gate checks (`sprint-gate.js advance`) — every phase also checks floor (`budget − 5 min`), `15+` answered `AskUserQuestion`s, and `.sprint/user-asks.json` |
|---|---|---|---|
| 1 | discover | 30 min | `SPRINT.md`, `PRODUCT.md`, `DESIGN.md`, golden fixture, `.sprint/discover-log.json` (15+ questions, 5+ challenge rounds), `.sprint/preflight.json` (`router-smoke.mjs` + services), `.sprint/user-asks.json` |
| 2 | backend | 60 min | `pytest` exits 0, `<= 450` hand-written core backend LOC |
| 3 | frontend | 75 min | `.sprint/phase3-proof.json` (walkthrough screenshot + `axeViolations: 0`), `.sprint/showcase-frontend.json`, design gate (critique, desktop + `375`px screens, loaded fonts, real `<title>`, custom `favicon.svg`) |
| 4 | polish | 45 min | `.sprint/showcase-polish.json`, design gate (critique, desktop + `375`px screens, loaded fonts, real `<title>`, custom `favicon.svg`) |
| 5 | audit | 45 min | phase floor, `15+` user questions, `.sprint/user-asks.json`, then the user's `go` |
| 6 | launch | 45 min | `.sprint/launch-proof.json` (live URL HTTP 200, video length, `readmeClaimsChecked: true`; Stripe `cs_test_` only when `gates.stripeEnabled` is true) |

## What the hooks block

All checks live in [`scripts/hooks/sprint-gate.js`](scripts/hooks/sprint-gate.js), which writes `.sprint-state.json` atomically. They do nothing unless `.sprint-state.json` has `active: true` (except `UserPromptSubmit` start detection and the direct-executor route guard). A block exits 2 with `[BLOCKED]`.

| Hook | Behavior |
|---|---|
| UserPromptSubmit | starts sprint on trigger phrase (requires `claude-opus-5-5` at `high` effort), logs `wtf`/frustrated prompts, handles `end sprint` and `skip floor` |
| PreToolUse · Edit/Write | blocks code edited before `Skill(phase-N)` · Phase 2+ code with Phase 1 artifacts missing · `.tsx/.jsx/.css/.html` edited before `.sprint/impeccable.ok` · main checkout edited while a `route-*` worktree is live |
| PreToolUse · Bash | blocks direct executor runs (`AB_DIRECT=1` bypasses) · `ab-route.js` write jobs (`bulk`, `large`, `agy`) without `--accept "<metric>"` or `--status` in the current phase · Python heredocs in Git Bash on Windows |
| PostToolUse | records loaded skills, counts `AskUserQuestion` answers per phase (`questionsByPhase`), clears `inFlight`, records `ab-route.js --status`, flags UI slop, logs router outcomes to `~/.agent-bridge/telemetry.jsonl` |
| Stop | blocks under the phase floor with phase-aware validation rounds (up to `maxFloorStopBlocks`), and blocks while a requested exit still fails its gate |

The sprint clock pauses on hook-silent gaps over `idlePauseMin` (10 min) only when no tracked tool (`Bash|PowerShell|Edit|Write|MultiEdit`) is in flight; `AskUserQuestion` has no `PreToolUse` hook, so >10 min thinking on a question still counts as a pause.

## Delegation

Work is sent through the router `~/.claude/bin/ab-route.js`, which lives outside this repo. Each write job runs in its own `route-*` worktree, and the router never pushes.

```mermaid
flowchart LR
    L["--class large"] --> H["agy<br/>Gemini 4 Hydrogen"]
    H -->|"quota / stall"| F["agy<br/>Gemini 3.8 Flash"]
    F -->|"quota / stall"| A["opencode<br/>freellmapi/auto"]
    A -->|"exhausted"| CL["Sonnet builder<br/>Opus reviews"]
    B["--class bulk / recon"] --> A

    classDef agy fill:#1E293B,stroke:#38BDF8,color:#F8FAFC
    classDef free fill:#1E293B,stroke:#94A3B8,color:#F8FAFC
    classDef claude fill:#1E293B,stroke:#10B981,color:#F8FAFC
    class H,F agy
    class A,L,B free
    class CL claude
```

- `agy` runs through `agent-bridge` in a per-job session `sprint-p<N>-<class>-<taskId>` with a no-subagents line in its brief. Parked executors (`opencode:go`, `hermes`) are skipped.
- `agy` liveness tracks output, worktree edits, or writes to `~/.gemini/antigravity-cli/conversations`; idle stalls after `agyIdleMs` (`300000`, 5 min), and total silence (no output/edits) is capped at `agySilentMs` (`900000`, 15 min).
- Startup watchdog `agyStartupStallMs` (`>= 180000`, 3 min) declares a `startup-stall` only after 3 min with no agent-bridge output, or on exit with no output and no edits.
- One stall is tolerated; a second stall in a row trips the executor for at most 30 min (no sprint-long ban). Committed and/or staged worker work both count (JSON `work` field).
- Chains are capped at 25 min (`maxChainWallMs`, `1500000`). A failed chain goes to the Sonnet `builder`, never to Opus.
- Smoke-test at sprint start from any folder: `node V:/Projects/sprint/scripts/router-smoke.mjs --require antigravity` (flags: `--router`, `--timeout-min`, `--require`, `--dry`).

## Sidebar mod (`sprint-mod/`)

A Claude Code mod that adds a sprint sidebar, a status-line row and four commands. It shows the current phase and time left, the gate state, delegated jobs, executor quotas and token use.

| Command | What it does |
|---|---|
| `/sprint` | Opens the sidebar: phases, handovers, executors, usage |
| `/sprint-status` | Prints the sprint status as text, without calling the model |
| `/sprint-agents` | Opens the Agents tab: live subagents, delegated jobs, worktrees; `btw` asks what an agent is doing without interrupting it |
| `/sprint-critiques` | Side-agent critiques held during a sprint: `apply` sends them through `ponytail-review`, `hold off` sends notes straight to Claude |

Sidebar keys: `c` compact · `g` agents · `r` refresh · `h` hud · `p` ponytail review · `a` advance.

## Setup

```powershell
git clone https://github.com/VihaanR/sprint-system.git V:\Projects\sprint
cd V:\Projects\sprint
python scripts/evolve_skills.py   # mirrors skills/ to ~/.claude/skills and ~/.gemini/config/skills
```

Then, in `~/.claude/settings.json`:

1. Load the mod: set `"env": { "CLAUDE_CODE_PLUGIN_DIRS": "V:/Projects/sprint/sprint-mod" }`.
2. Point the `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure` and `Stop` hooks at `node V:/Projects/sprint/scripts/hooks/sprint-gate.js`.
3. Point `SessionStart` at `node V:/Projects/sprint/scripts/hooks/preflight.js`.

The hook scripts read the absolute path `V:/Projects/sprint`. If you clone somewhere else, edit those paths.

## Running a sprint

```text
start a sprint for <problem statement>
```

```bash
node ~/.claude/bin/ab-route.js --status                                   # once per phase, before any dispatch
node ~/.claude/bin/ab-route.js --class large --accept "pytest exit 0" "<outcome>"
node V:/Projects/sprint/scripts/hooks/sprint-gate.js advance                                 # after you type go
```

## Configuration

`sprint.config.json` controls the trigger phrases, phase budgets, router models and stall limits, gate thresholds (`backendMaxCoreLoc`, `maxCyclomaticComplexity`, `stripeEnabled`, `videoDurationSec`) and the UI checks (`requireImpeccable`, `requirePhase3HumanWalk`, `requireZeroAxeViolations`). A `sprint.config.json` in the project root overrides the one in this repo.

## Verify

```bash
node scripts/verify.mjs
```

This runs the mod tests (`claude plugin test sprint-mod`), `claude plugin validate`, `py_compile` on `scripts/*.py` and `node --check` on the hooks. It writes an evidence file to `~/.claude/verify-evidence/`, with `result: pass` only when every check exits 0.

## Layout

| Path | What |
|---|---|
| `skills/phase-*` | One skill per phase, loaded as the phase's first action |
| `skills/sprint-orchestrator` | Phase dispatcher and scorecard template |
| `.claude/agents/` | `discover`, `builder`, `auditor`, `launcher` subagent playbooks |
| `scripts/hooks/` | `sprint-gate.js` (all gates), `preflight.js` (SessionStart) |
| `sprint-mod/` | Sidebar, status line and commands |
| `AGENTS.md` | The rules any agent follows in this repo |

## License

MIT.
