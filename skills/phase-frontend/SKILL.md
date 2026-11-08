---
name: phase-frontend
description: Phase 3 of the 5-Hour Hackathon Sprint. Assembles frontend components live via live-swarm-coding, ponytail (YAGNI), impeccable (craft-floor/live), browser-code-verifier, chrome-devtools-plugin, StitchMCP, react-state-management, android-cli-plugin, and flutter.
---

# Phase 3: Visual Swarm & Frontend Build (Live Component Assembly)

**Target Time Budget**: ~75 minutes  
**Goal**: Assemble a responsive, interactive frontend connected to your Phase 2 API. Runs the multi-agent parallel swarm with Hot Module Replacement, Ponytail YAGNI lean state, Impeccable craft-floor quality rules, and live Chrome DevTools preview.

---

## Pre-Phase Interrogation Gate

Before execution starts, the system delivers the **Phase 2 Executive Scorecard** (endpoints active, test passes, DB models), followed by the **Devil's Advocate 15-Point Interrogation** (mandatory >= 15 deep-dive questions across 5 dimensions). The user must confirm UI hierarchy, state architecture, and killer feature requirements before subagents write code.

---

## Active Tooling & Capabilities

- **`live-swarm-coding` (with `resources/swarm-overlay.js`)**: Visual multiplayer swarm engine with glowing cursors, Figma-style selection boxes, and code streamers.
- **`ponytail`**: Ruthless YAGNI engine. Prohibits over-engineered state machines (e.g. Redux/XState) when simple booleans or React Query suffice; prevents speculative generic wrapper components.
- **`gravitas`**: Engineering reliability runtime. Prohibits claiming UI completion without launching server, probing port, and observing zero console errors.
- **`impeccable` (craft-floor & live variants)**: Enforces `reference/craft-floor.md` quality rules from line one, preventing generic AI slop. Enables live browser variant generation (`/impeccable live`, `/impeccable generate`).
- **`browser-code-verifier`**: Automates live browser testing, network asset integrity, and zero-error verification.
- **`chrome-devtools-plugin`**: Real-time DOM inspection, console message streaming, and screenshots.
- **`modern-web-guidance-plugin`**: Enforces modern web standards, semantic HTML, responsive viewport units, and modern CSS.
- **`StitchMCP`**: Generates and refactors screen components and UI variants.
- **`react-state-management` & `react-modernization`**: Zustand / React Query for efficient server state sync; React 19 concurrent features.
- **`android-cli-plugin` & `mobile-developer`**: Jetpack Compose UI rendering, `@Preview` inspections, and `adb` device deployment (for Android).
- **`flutter` plugin**: Dart/Flutter widget trees and cross-platform compilation (for Flutter).
- **`google_maps_platform`**: Embeds live interactive maps and location selectors.

---

## Execution Checklist

1. **Pre-Phase Gate (>= 15 Questions)**:
   - Deliver Phase 2 Executive Scorecard.
   - Run Devil's Advocate interrogation on frontend architecture, state sync, and signature interactions.
2. **Dev Server & Swarm Overlay Boot**:
   - Start Vite server (`npm run dev`) or Android emulator as background daemon (`IsDaemon: true`).
   - Attach `swarm-overlay.js` to render live agent cursors.
   - Open browser via `chrome-devtools-plugin` at `http://localhost:5173`.
3. **Parallel Swarm Dispatch (Ponytail YAGNI + Impeccable Craft-Floor)**:
   - Subagents build layout, styles, and state concurrently (`invoke_subagent`).
   - Enforce Ponytail: keep state flat; use concrete components before building generic design systems.
   - Every agent enforces `impeccable/reference/craft-floor.md` (no generic purple gradients, strict line length 45-75ch, intentional padding rhythm).
   - Use `/impeccable generate` for live browser variant exploration on key components.
4. **API & Data Binding**:
   - Connect frontend state stores to Phase 2 endpoints (`fetch` / React Query).
5. **Interactive Verification & Gravitas DOM Check**:
   - Test critical buttons, inputs, modals, and dynamic data feeds.
   - Verify zero unhandled exceptions in browser console.
6. **Phase Checkpoint**:
   - Update `SPRINT.md` and prepare Executive Scorecard with DOM snapshot proofs for gate approval into **Phase 4 (Beautification & Polish)**.
