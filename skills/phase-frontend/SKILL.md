---
name: phase-frontend
description: Phase 3 of the 5-Hour Hackathon Sprint. Assembles frontend components live via live-swarm-coding, browser-code-verifier, chrome-devtools-plugin, StitchMCP, react-state-management, android-cli-plugin, and flutter.
---

# Phase 3: Visual Swarm & Frontend Build (Live Component Assembly)

**Target Time Budget**: ~75 minutes  
**Goal**: Assemble a responsive, interactive frontend connected to your Phase 2 API. Runs the multi-agent parallel swarm with Hot Module Replacement and live Chrome DevTools preview.

---

## Active Tooling & Capabilities

- **`live-swarm-coding` (with `resources/swarm-overlay.js`)**: Visual multiplayer swarm engine with glowing cursors, Figma-style selection boxes, and code streamers.
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

1. **Dev Server & Swarm Overlay Boot**:
   - Start Vite server (`npm run dev`) or Android emulator.
   - Attach `swarm-overlay.js` to render live agent cursors.
   - Open browser via `chrome-devtools-plugin` at `http://localhost:5173`.
2. **Parallel Swarm Dispatch**:
   - Subagents build layout, styles, and state concurrently (`invoke_subagent`).
   - Every file save hot-reloads the screen in sub-seconds.
3. **API & Data Binding**:
   - Connect frontend state stores to Phase 2 endpoints (`fetch` / React Query).
4. **Interactive Verification**:
   - Test critical buttons, inputs, modals, and dynamic data feeds.
5. **Phase Checkpoint**:
   - Update `SPRINT.md` and prompt user for gate approval into **Phase 4 (Beautification & Polish)**.
