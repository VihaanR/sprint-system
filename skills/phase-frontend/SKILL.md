---
name: phase-frontend
description: Phase 3 of the 5-Hour Hackathon Sprint. Assembles frontend components live via live-swarm-coding, ponytail (YAGNI), impeccable (craft-floor/live), browser-code-verifier, chrome-devtools-plugin, StitchMCP, react-state-management, android-cli-plugin, and flutter.
---

# Phase 3: Zero-Copy Swarm & Frontend Assembly (v2.0)

**Target Time Budget**: ~75 minutes  
**Goal**: Assemble a responsive, tactile, zero-slop frontend connected to the Phase 2 API. Sonnet `builder` managers dispatch disjoint UI slices via `ab-route.js` in isolated `route-*` worktrees, review worker diffs, and fix failures; verified with native HTML5 primitives, domain design tokens, and live Chrome DevTools + `auditor` walkthroughs.

---

## Architectural Principles & Gating

1. **Isolated Router Worktrees (`route-*`)**:
   - Sonnet `builder`s run `ab-route.js --status` once per phase, then dispatch independent feature slices (`--class large|agy|bulk --accept "<metric>" --accept-cmd "<check>"`) into isolated `route-*` worktrees. Never edit the main checkout while a `route-*` worktree is live.
   - Central files (`App.tsx`, `routes.ts`, `main.py`) stay write-locked during parallel slices; failed chains go to the Sonnet `builder`, never to Opus.
   - Slices register via inverted dynamic auto-discovery (`import.meta.glob('./features/*/index.tsx')` or router auto-loaders).
2. **Domain Design Token Injection (`design-tokens.json`)**:
   - Before a single line of UI code is written, inject custom domain tokens:
     - *Dev Tools*: stark dark canvas (`#09090B`), JetBrains Mono, 1px neutral borders.
     - *Healthcare / Ops*: clinical high-contrast light canvas (`#FFFFFF`, `#F8FAFC`), deep slate typography, tabular nums.
     - *Fintech*: dense data grids, TradingView Lightweight Charts, OHLCV time-series tables, audit timestamps, subtle border highlights (`1px solid rgba(255,255,255,0.08)`).
   - Theme Signature Pre-Flight (`Nutlope/hallmark` pattern): In addition to colors, lock in verified font pairings, strict border radius tokens, and subtle elevation tokens to guarantee handcrafted visual identity over generic AI templates.
   - Zero default shadcn palettes or generic Tailwind templates.
3. **Native Semantic HTML5 Primitives (Zero npm Bloat)**:
   - Replace heavy npm modal wrappers with native `<dialog>` and the HTML Popover API (`popover="auto"`).
   - Use `<details>` / `<summary>` for collapsibles and `<form method="dialog">` for modal state.
4. **Pro Ergonomics & Zero-Jank Tactility**:
   - Global command palette (`Cmd+K` / `Ctrl+K`) for keyboard-first navigation.
   - Instant optimistic feedback (<16ms perceived response).
   - Tactile button press feedback (`active:scale-[0.98] transition-transform duration-100 ease-out`).
5. **Zero Layout Shift (CLS = 0.00)**:
   - Use Container Queries (`@container`) instead of fragile viewport queries so components adapt directly to allocated parent width.
   - Dimensioned skeleton loaders rendered during async fetches to prevent layout jumps.
6. **Pre-Commit Anti-Slop Linter**:
   - Auto-Fix with Hard Failback: automatically replaces banned gradients and buzzwords; if unfixable, blocks build with Exit Code 1.
7. **Frontend Blast Radius Protection (Wednesday Solutions Pattern)**:
   - Workers in `route-*` worktrees must compute blast radius before editing shared files (`index.css`, `theme.ts`, `App.tsx`). If downstream components > 5, edits must use localized component props without mutating global tokens.
8. **Art Direction & Reference Image Verification (Taste-Skill Pattern)**:
   - Before writing markup, compare component specifications against visual design references (`mobbin` MCP or `gdrive` mockups) to guarantee high-taste visual layout over generic AI defaults.
9. **AG-UI Streaming Event Client Consumption (`ag-ui-protocol/ag-ui` pattern)**:
   - Consume backend SSE streams (`event: ui_delta`, `event: tool_call`, `event: agent_thought`) via native `EventSource` or `fetch()` readable stream directly into React state or vanilla Web Components. Zero heavy client wrapper libraries or complex state machines.

---

## Active Tooling & Capabilities

- **`live-swarm-coding`**: Multi-agent parallel assembly with live browser synchronization.
- **`browser-code-verifier`**: Automates live preview server startup, DOM tree verification, and console error checks.
- **`chrome-devtools-plugin`**: High-resolution screenshots, layout inspection, and console streaming.
- **`impeccable` (craft-floor)**: Enforces authentic whitespace rhythm and high-contrast intentional palettes.
- **`ui-ux-pro-max` & `tailwind-design-system`**: Design tokens, component templates, and dark/light modes.
- **`modern-web-guidance-plugin`**: Modern container queries, responsive flex/grid, and zero CLS.
- **`gdrive` plugin**: Live sync of pitch mockups, icons, and image assets.
- **`StitchMCP`**: Generates and refactors screen variants.
- **`react-state-management`**: Zustand or React Query for lightweight server state synchronization.
- **`android-cli-plugin` & `flutter`**: Jetpack Compose and Flutter widget trees for mobile targets.

---

## Execution Checklist

- **User questions (every phase):** get at least 15 answers via `AskUserQuestion` before the phase may end
  (`gates.minUserQuestionsPerPhase`). The PostToolUse `AskUserQuestion` matcher counts answers into `.sprint-state.json` `questionsByPhase`;
  `advance` refuses below 15 and checks `.sprint/user-asks.json` for unconfirmed cuts. Ask about real decisions (trade-offs, thresholds, edge cases, cuts), 4 per call.

1. **Pre-Phase Gate**:
   - Deliver Phase 2 Executive Scorecard.
   - Lock in Domain Design Contract (`design-tokens.json`) and complete impeccable preflight (`.sprint/impeccable.ok`).
2. **Dev Server Boot & In-Browser Setup**:
   - Start Vite server (`npm run dev`) or mobile emulator as background daemon (`IsDaemon: true`).
   - Open browser via `chrome-devtools-plugin` at `http://localhost:5173`.
3. **Parallel Slice Dispatch (Sonnet `builder`s + `ab-route.js`)**:
   - Sonnet `builder`s dispatch disjoint feature slices (`Navbar`, `Hero`, `DataGrid`, `DetailDrawer`) through `ab-route.js`, review committed/staged `work`, and fix failures.
   - Slices register into host application via `import.meta.glob`.
4. **Implement Ergonomics & Native Primitives**:
   - Build native `<dialog>` modals with popover API.
   - Implement global `Cmd+K` command palette.
   - Enforce active states (`active:scale-[0.98]`) and mechanical focus rings.
   - Insert skeleton loaders with exact aspect ratios for CLS = 0.00.
5. **API & Data Binding**:
   - Connect frontend components to Phase 2 endpoints using the immutable `types.ts` contract.
   - Verify `DEMO_MODE=offline` fallback toggle renders cached fixtures seamlessly.
6. **Anti-Slop Pre-Commit Linter Pass**:
   - Audit code against banned gradients (`bg-gradient-to-r from-purple-* to-indigo-*`) and decorative sparkles.
   - Apply auto-fix or fail with Exit Code 1.
7. **Interactive Verification & Gravitas DOM Check**:
   - Test critical buttons, inputs, modals, and dynamic data feeds in browser.
   - Verify 0 uncaught exceptions in browser console.
8. **Show the running app (exit step, mandatory)**: before the scorecard, open it in the user's own browser.
   - Make sure the app is serving (`curl -s -f -o /dev/null -w "%{http_code}" <url>` returns 200).
   - Open it: `cmd.exe /c start "" "<url>"` (Windows), `open <url>` (macOS) or `xdg-open <url>` (Linux).
   - Print the clickable link on its own line, above the scorecard: `Open the app: <url>`.
   - Write the proof the gate checks:
     `node -e "require('fs').writeFileSync('.sprint/showcase-frontend.json', JSON.stringify({url:'<url>',timestamp:new Date().toISOString()}))"`
   - `advance` refuses without `.sprint/showcase-frontend.json` (a url and a timestamp from this phase).
9. **Design exit gate & walkthrough (mandatory)**: `advance` checks all of these before leaving Phase 3:
   - Run `auditor` human-click walkthrough and write `.sprint/phase3-proof.json` (`screenshot` exists + `axeViolations: 0`).
   - Run `/impeccable critique` on the running UI and save it to `.sprint/impeccable-critique-p3.md`.
   - Save a desktop screenshot and a 375px-wide screenshot (file name contains `375` or `mobile`) to `.sprint/screens-p3/`.
   - Load every `font-family` and `--font-*` named in CSS (`@fontsource/*`, `@fontsource-variable/*`, `@font-face`, or Google Fonts `<link>` / `@import`).
   - Set a real `<title>` in `frontend/index.html` (no `Vite + React` or placeholder) and replace starter `frontend/public/favicon.svg`.
10. **Phase Checkpoint**:
   - Update `SPRINT.md` with DOM snapshot proofs for gate approval into **Phase 4 (Sleek Polish & Motion)**.
