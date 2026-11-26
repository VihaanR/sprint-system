# SPRINT-fix.md: Sprint System v3.0 Upgrade Spec (Claude Code CLI Execution Blueprint)

> **Purpose:** Complete, self-contained context and implementation specification for **Claude Code CLI** to upgrade Sprint System v2.0 -> **v3.0** across both this repository (`v:\Projects\sprint`) and global user infrastructure (`~/.claude/`, `~/.agent-bridge/`).
> **Sources:** `SPRINT-ISSUES.md` (Sprint 1 post-mortem), 6-Faction Council (3 rounds + `pro` Claude Code CLI Architect audit), and verified local configs (`~/.claude/bin/ab-route.js`, `~/.config/opencode/opencode.json`, `~/.claude/settings.json`, `agent-bridge` `0.1.0`, `scripts/evolve_skills.py`).

---

## 1. Post-Mortem: What Broke in Sprint 1 (Must Fix)

1. **Phase skills skipped (Phases 1-3):** Claude Code planned using the 6-phase summary in `SPRINT.md` / `sprint-orchestrator/SKILL.md` without loading `Skill(phase-discover)`, `Skill(phase-backend)`, or `Skill(phase-frontend)`. `SPRINT.md` had no machine-enforced phase lock, and `~/.claude/settings.json` had `"sprint-orchestrator": "off"` and `"sprint-recursive-optimizer": "off"` in `skillOverrides`.
2. **No `"start a sprint"` auto-trigger:** The user had to manually invoke skills or `/route`. Saying `"start a sprint"` (or `"run a sprint"`) must automatically boot the sprint pipeline and automatic `ab-route.js` routing.
3. **`agy` transport stalls & blind retries:** Tasks `d75d`, `5bfb`, `9a86` froze at `"Waiting for the agent to start..."` after `transport cli`. `STALL_BY_EXECUTOR.antigravity = 360000` (`ab-route.js:42`) burned 6 min per attempt, and blind `--reset` retries wasted 12-18 min. Also `ab-route.js` hardcoded `{}` for `antigravity` instead of passing `--model` (`hydrogen` / `gemini-flash`) or `--session` for handover continuity.
4. **Main-checkout `isolation-breach`:** `ab-route.js:328-335` snapshots `git status --porcelain` on `o.repo`. Claude edited `data/` and `scripts/` in the main checkout while router jobs A and C ran, tripping `isolation-breach` (exit code 5).
5. **OpenCode free-model stampede & unused `freellmapi/auto`:** `CHAINS` (`ab-route.js:30-40`) pinned `freellmapi/moonshotaikimi-k2.7-code`, `freellmapi/qwen3-coder`, and `opencode/deepseek-v4.1-flash-free`. With `kimi` exhausted and `qwen3-coder` returning 429s, Jobs A/B/C stampeded `deepseek-v4.1-flash-free` while `freellmapi/auto` (`~/.config/opencode/opencode.json:3,13`) sat unused. `HARD_TIMEOUT_MS = 480000` per step allowed a 4-step `large` chain to burn >15 min.
6. **Core science delegated to free models:** Delegated backend shipped O(n^2) clustering (~30 min runtime) and broken global-identity matching. Core domain/scientific logic must stay with Claude Code and carry measurable acceptance criteria.
7. **`impeccable` bypassed & `phase-polish` AI slop:** `SPRINT.md:44` cited non-existent `npx impeccable detect`. Nobody ran `scripts/impeccable context` or read `PRODUCT.md`, `DESIGN.md`, and `skills/impeccable/reference/craft-floor.md` (`skills/impeccable/SKILL.md:16-18`). Meanwhile `phase-polish/SKILL.md:16-19` hardcoded generic `bg-slate-950` + `backdrop-filter: blur(16px)` + `perspective: 1000px` slop, and `axe-core` waited until Phase 5.
8. **`ponytail` toothless until Phase 5:** Buried in prose (`phase-backend/SKILL.md:18-22`), while `phase-backend:25-42` mandated unrequested Stripe, Auth0, FastMCP, `Risk Score` math, `Scrapling`, and `AG-UI` SSE.
9. **Verification & Windows preflight gaps:** Playwright injected file paths instead of clicking like a human (letting P0 `"i cant import demo"` and stale `"Backend offline"` reach the user); port 8000 was Hyper-V excluded; Git Bash Python heredocs mangled `\n`; CRLF warnings fired every commit; `vercel login` happened in the final hour; `phase-launch` conflicted with `brag` (60s vs 15-25s) and forced Stripe on non-commerce apps; `phase-audit` gated on missing `docs/ARCHITECTURE_TREE.md`.
10. **Ugly `status.html` & disconnected telemetry:** `writeStatusPage()` in `ab-route.js:108-147` renders bare unstyled HTML cards with no phase timeline, no handover flow, no token/quota gauges, and `scripts/evolve_skills.py:analyze_local_telemetry()` only greps `RETRY`/`FAIL` in `SPRINT.md`.

---

## 2. Target Architecture (Claude Code CLI v3.0)

```text
User says: "start a sprint"
  │
  ▼  UserPromptSubmit hook (<20ms)
Initialize .sprint-state.json (phase: 1) + inject Skill(sprint-orchestrator) & Skill(phase-discover)
  │
  ├─► CLAUDE.md (<=50 lines, advisory: phase order, worktree rule, core science stays on Claude)
  ├─► sprint.config.json (customizable thresholds, model tiers, gates, UI/video/Stripe toggles)
  ├─► .claude/settings.json Hooks (deterministic gates: SessionStart, PreToolUse, PostToolUse, TaskCompleted, Stop)
  ├─► .claude/agents/*.md (4 narrow playbooks: discover, builder, auditor, launcher)
  ├─► ~/.claude/bin/ab-route.js (tiered agy Hydrogen->Gemini Flash + --session handover + freellmapi/auto + status.html HUD)
  └─► scripts/evolve_skills.py (ACE Reflect-Curate loop reading ~/.agent-bridge/telemetry.jsonl)
```

---

## 3. Workstream A: Customizable Control Plane (`sprint.config.json`)

Create `v:\Projects\sprint\sprint.config.json` (and support project-local overrides in any repo). All hooks, `ab-route.js`, and phase skills read from this file so the user can tune any parameter without editing code:

```json
{
  "autoTriggerPhrases": ["start a sprint", "run a sprint"],
  "timeBudgetMinutes": 300,
  "phases": {
    "1": { "name": "discover", "budgetMin": 30 },
    "2": { "name": "backend", "budgetMin": 60 },
    "3": { "name": "frontend", "budgetMin": 75 },
    "4": { "name": "polish", "budgetMin": 45 },
    "5": { "name": "audit", "budgetMin": 45 },
    "6": { "name": "launch", "budgetMin": 45 }
  },
  "router": {
    "autoRoute": true,
    "agyModels": ["hydrogen", "gemini-flash"],
    "agySessionPrefix": "sprint",
    "agyStartupStallMs": 60000,
    "agyOneStrikeDrop": true,
    "opencodeFallback": "freellmapi/auto",
    "maxChainWallMs": 600000,
    "requireStatusPreflight": true
  },
  "gates": {
    "backendMaxCoreLoc": 450,
    "maxCyclomaticComplexity": 6,
    "stripeEnabled": false,
    "architectureTreeRequired": false,
    "videoDurationSec": "15-25"
  },
  "ui": {
    "requireImpeccable": true,
    "requirePhase3HumanWalk": true,
    "requireZeroAxeViolations": true
  },
  "telemetry": {
    "enableOtel": true,
    "telemetryFile": "~/.agent-bridge/telemetry.jsonl",
    "dashboardRefreshSec": 10
  }
}
```

---

## 4. Workstream B: Tiered `agy` Handover, Usage Tracking & `ab-route.js`

Modify `C:\Users\Vihaan\.claude\bin\ab-route.js`:

1. **Tiered `antigravity` Models & `--session` Handover (`CHAINS` & spawn args):**
   - Verified in `agent-bridge.js --help`: `agent-bridge run --agent antigravity` accepts `--model <name>` and `--session <name>` (reuses conversation + worktree across runs).
   - Update `CHAINS.large` and `CHAINS.agy` to read `sprint.config.json` `router.agyModels` (default `["hydrogen", "gemini-flash"]`):
     - Step 1: `["antigravity", { model: "hydrogen" }]` (complex/large architecture or UI slices)
     - Step 2: `["antigravity", { model: "gemini-flash" }]` (fast handover fallback when Hydrogen is rate-limited or for lighter slices)
     - Step 3+: `opencode:free` (`FREE_CODER`, `FREE_ALT`, `FREE_ZR`, **`freellmapi/auto`**).
   - Add `--session <name>` support to `ab-route.js` CLI args (defaulting to `sprint-p<phase>-<slice>` when in a sprint) and pass `["--model", cfg.model]` and `["--session", o.session]` to `agent-bridge.js`.
   - Also allow `--accept "<metric>"` CLI flag on `ab-route.js`, injected into the worker's prompt contract (`ab-route.js:317-319`) alongside `SPRINT.md`, `PRODUCT.md`, `DESIGN.md` (when UI), and a 5-line `ponytail` concrete-code header.

2. **60s Startup Fail-Fast & 1-Strike Auto-Drop (`STALL_BY_EXECUTOR` & `runChild`):**
   - Replace `STALL_BY_EXECUTOR.antigravity = 360000` (`ab-route.js:42`) with a two-stage watchdog:
     - **Startup watchdog (`60000` ms):** Poll the task's `status.md` (or stdout/stderr); if it still says `"Waiting for the agent to start"` after 60s, kill immediately (`why = "startup-stall"`).
     - **One-strike auto-drop:** If `antigravity` fails with `startup-stall` during a sprint, trip `antigravity` for the remainder of the sprint (`300` min) with zero blind `--reset` retries.
   - Add a chain-wide wall-clock cap (`MAX_CHAIN_WALL_MS = 600000`, overridable via `--max-wall-ms` or `sprint.config.json`) across the `for` loop in `main()`.

3. **Cross-Agent Usage & Handover Telemetry (`telemetry.jsonl` + `agent-bridge tokens`):**
   - In `recordLocked()` (`ab-route.js:150-161`) and on `isolation-breach` / `exhausted`, append a JSON line to `~/.agent-bridge/telemetry.jsonl`:
     ```json
     {"ts":"...","taskId":"...","phase":3,"from":"claude","to":"antigravity","model":"hydrogen","session":"sprint-p3-ui","outcome":"ok","durS":42,"flags":[]}
     ```
   - On `ab-route.js --status` and `writeStatusPage()`, also shell out (with short timeout) or read `agent-bridge tokens --json` (or parse `agent-bridge tokens` output) + `~/.agent-bridge/health.json` + last 30 lines of `telemetry.jsonl` so usage across Claude (OTEL), Codex, Antigravity (`Hydrogen` / `Gemini Flash`), and OpenCode is unified in one view.

---

## 5. Workstream C: Pretty, Interactive `status.html` Command Center

Completely redesign `writeStatusPage(h)` in `C:\Users\Vihaan\.claude\bin\ab-route.js` (`L108-147`).

**Design requirements (adhere to `skills/impeccable/reference/craft-floor.md` — NO purple-indigo gradients, NO fake metrics):**
- **Aesthetic:** Crisp high-contrast OLED dark / daylight light adaptive theme (`#0A0D12` / `#F6F8FA`), `1px solid` hairline borders, `Inter` / system-ui headings + `JetBrains Mono` / `ui-monospace` tabular numbers (`font-variant-numeric: tabular-nums`), subtle status pills (green `#10B981`, amber `#F59E0B`, red `#EF4444`, cyan `#06B6D4`).
- **5 Interactive Panels:**
  1. **Top Pulse Bar:** Current Sprint Phase (`Phase N/6`), elapsed/remaining sprint timer, `agent-bridge otel` status badge, auto-refresh countdown + Pause/Resume button, and `r` to refresh.
  2. **6-Phase Interactive Stepper:** Horizontal clickable timeline (`1 Discover` -> `2 Backend` -> `3 Frontend` -> `4 Polish` -> `5 Audit` -> `6 Launch`) reading `.sprint-state.json` (if embedded/available) showing `DONE` / `ACTIVE` / `LOCKED` and gate checklist.
  3. **Live Handover Flow & Timeline:** Visualizes the latest handovers from `telemetry.jsonl` (`Claude -> agy:hydrogen -> agy:gemini-flash -> opencode:freellmapi/auto`), showing `--session` IDs, duration (`durS`), exit outcome, and diffstat.
  4. **Executor Quota & Token Gauges:** Filterable by chain tab (`all`, `recon`, `bulk`, `large`, `review`, `agy`). Each card shows live cooldown progress bar, `usedToday`, `agent-bridge tokens` summary, last 5 runs as interactive micro-badges, and a **one-click Copy Command** button (`node ~/.claude/bin/ab-route.js --reset <key>`).
  5. **Config & Keyboard Bar:** Shows active `sprint.config.json` toggles (`agyModels`, `stripeEnabled`, `backendMaxCoreLoc`) and keyboard hints (`j`/`k` navigate, `h`/`l` switch chain, `c` copy reset cmd, `Space` pause refresh).

---

## 6. Workstream D: Deterministic Claude Code CLI Enforcement & `"start a sprint"` Trigger

1. **Fix `~/.claude/settings.json` `skillOverrides`:**
   - Remove `"off"` (or set `"on"`) for `"sprint-orchestrator"` and `"sprint-recursive-optimizer"` in `~/.claude/settings.json`.
   - Keep `CLAUDE.md` / `AGENTS.md` under **50 lines** (strip the 9-faction lore and 40-skill table; keep only phase-order rule, worktree rule, and core-science-stays-on-Claude rule).

2. **Configure Fast (<20ms) Hooks in `~/.claude/settings.json` / `.claude/settings.json`:**
   - **`UserPromptSubmit` (`scripts/hooks/sprint-trigger.js`):**
     - Matches `"start a sprint"` or `"run a sprint"` (case-insensitive).
     - Initializes `.sprint-state.json` (`{ "active": true, "phase": 1, "startedAt": "...", "skillsLoaded": [], "userGo": false, "autoRoute": true }`).
     - Outputs hook context instructing Claude Code: *"SPRINT ACTIVE (Phase 1/6: Discover). Your FIRST tool call MUST be `Skill(sprint-orchestrator)` then `Skill(phase-discover)`. Automatic `ab-route.js` routing is ON (`sprint.config.json`)."*
   - **`SessionStart` (`scripts/hooks/preflight.js`):**
     - Runs only when `.sprint-state.json` `active === true` (or on sprint repo): checks `netsh interface ipv4 show excludedportrange protocol=tcp` to pick a free `API_PORT`, checks `vercel whoami` & `gh auth status`, verifies `.gitattributes` (`* text=auto eol=lf`) and `.env*` in `.gitignore`/`.vercelignore`, runs `node ~/.claude/bin/ab-route.js --status`, and runs a 2-min `AB_DIRECT=1 agy -p "say ok"` smoke test.
   - **`PreToolUse` (`Edit|Write` on `src/|app/|api/|backend/|frontend/`):**
     - Exits `2` (blocking) if `.sprint-state.json` `active === true` AND:
       1. `Skill(phase-<current>)` hasn't been recorded as loaded, OR
       2. Editing code in Phase 2+ without Phase 1 artifacts (`SPRINT.md`, `PRODUCT.md`, `DESIGN.md`, golden fixture), OR
       3. Editing `*.tsx|*.jsx|*.css|*.html` without `.sprint/impeccable.ok` (`scripts/impeccable context` + `craft-floor.md` read), OR
       4. Active `~/.agent-bridge/worktrees/route-*` exists while editing the main checkout (prevents `isolation-breach`).
   - **`PreToolUse` (`Bash`):**
     - Blocks `ab-route.js` write commands (`bulk|large|agy`) missing `--accept "<metric>"` or without `--status` checked in the current phase.
     - Blocks Git Bash Python heredocs (`python << 'EOF'`) that mangle `\n` on Windows; directs Claude to use `Edit` or a script file.
   - **`PostToolUse` / `PostToolUseFailure`:**
     - On UI writes, runs a fast regex slop check (`bg-slate-950`, `from-purple-`, `transition:\s*all\s+.*linear`) and logs hits to `~/.agent-bridge/telemetry.jsonl`.
     - On `ab-route.js` failures (`quota`, `stall`, `exhausted`, `isolation-breach`), logs to `telemetry.jsonl`.
   - **`TaskCompleted` / `Stop`:**
     - Phase 2 exit: verifies `pytest` exit 0 + `ponytail` check (`<=450` hand-written core backend LOC excluding schemas/fixtures/tests + cyclomatic complexity `<=6` + no single-impl ABCs).
     - Phase 3 exit: verifies `.sprint/phase3-proof.json` contains a `claude-in-chrome` human-click walkthrough screenshot path + `axe-core` `violations === 0`.
     - Phase 6 exit: verifies live URL `HTTP 200`, `brag` video (`15-25s` default), README claims pass, conditional Stripe (`sprint.config.json` `gates.stripeEnabled`), and triggers `scripts/evolve_skills.py`.

---

## 7. Workstream E: 4 Scoped Playbooks (`.claude/agents/*.md`)

Create 4 focused playbooks in `v:\Projects\sprint\.claude\agents\` (and sync to `~/.claude/agents/`), each under 60 lines with explicit `tools`, `model`, `skills`, `isolation: worktree` (for builders), and artifact handoffs:

1. **`discover.md`**: Phase 1 Discover & Domain Gate. Preloads `phase-discover`, `impeccable`. Runs `impeccable context`, produces `PRODUCT.md`, `DESIGN.md`, realistic single-assay/domain fixture + golden expected outputs, and runs 1 domain-expert review before freezing `types.ts`/OpenAPI.
2. **`builder.md`**: Phase 2-3 Implementation (`isolation: worktree`). Preloads `ponytail`, `impeccable`. Reads `DESIGN.md` + `craft-floor.md` before any UI edit; enforces `<=450` core backend LOC and complexity `<=6`.
3. **`auditor.md`**: Phase 3/5 Human-Path & Quality Verifier. Preloads `phase-audit`, `gravitas`. Runs `claude-in-chrome` / `chrome-devtools` **human-click** walkthrough (never path-injection shortcuts), captures screenshot, runs `axe-core` (0 violations), and checks `pytest` + security.
4. **`launcher.md`**: Phase 6 Zero-Localhost Launch & Evolution. Preloads `phase-launch`, `sprint-recursive-optimizer`. Verifies live `HTTP 200`, conditional Stripe, `brag` 15-25s video, README claims pass (every claim cites a test/data row), and runs `scripts/evolve_skills.py`.

---

## 8. Workstream F: Skill Cleanup & ACE Recursive Loop (`scripts/evolve_skills.py`)

1. **Trim `skills/sprint-orchestrator/SKILL.md`:** Remove the 9-faction manifesto and 40-skill matrix; replace with a crisp 30-line phase-gate dispatcher (`Phase N/6 (<name>) | ~X min left` + 5-line Executive Scorecard template + user `go` gate).
2. **Clean `skills/phase-discover`..`phase-launch` & `SPRINT.md`:**
   - Remove `npx impeccable detect` from `SPRINT.md:44` and hardcoded `bg-slate-950` / `blur(16px)` / `perspective: 1000px` boilerplate from `phase-polish/SKILL.md:16-19,63-65`.
   - Remove unrequested Stripe/Auth0/FastMCP/Risk Score/Scrapling/AG-UI mandates from `phase-backend/SKILL.md:25-42` (make them opt-in via `sprint.config.json`).
   - Make Stripe and `docs/ARCHITECTURE_TREE.md` conditional on `sprint.config.json`; align `phase-launch` video target to `15-25s` (`brag`).
3. **Upgrade `scripts/evolve_skills.py` (ACE Reflect-Curate Loop):**
   - Update `analyze_local_telemetry()` (`scripts/evolve_skills.py:28-35`) to parse `~/.agent-bridge/telemetry.jsonl`, cluster recurring `PreToolUse` blocks, `PostToolUseFailure` errors, `ab-route.js` stalls/429s, `axe-core`/slop hits, and `agy` model outcomes (`hydrogen` vs `gemini-flash`).
   - On Phase 6 close / `/sprint-evolve`, emit concrete delta patches to `.claude/agents/*.md` and `skills/*/SKILL.md`, log evidence to `docs/EVOLUTION_LOG.md`, and dual-sync to `~/.claude/skills/` and `~/.gemini/config/skills/`.

---

## 9. Verification Checklist (For Claude Code CLI After Applying)

1. `node ~/.claude/bin/ab-route.js --table` and `node ~/.claude/bin/ab-route.js --status` exit `0` and regenerate `~/.agent-bridge/status.html`.
2. Open `~/.agent-bridge/status.html` in a browser and confirm all 5 interactive panels render cleanly with 0 console errors.
3. `python scripts/evolve_skills.py` exits `0`, validates all `SKILL.md` frontmatter, and syncs to `~/.claude/skills/` and `~/.gemini/config/skills/`.
4. Dry-run hook test: `UserPromptSubmit` with `"start a sprint"` initializes `.sprint-state.json`; `PreToolUse` blocks an un-gated `Edit` on `src/` with exit code `2`.
