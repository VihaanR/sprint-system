---
name: phase-polish
description: Phase 4 of the 5-Hour Hackathon Sprint. Applies impeccable anti-slop design intelligence, code-simplify (Addy Osmani), UI/UX Pro Max, indian-gov-ui-skills (if public/gov), tailwind-design-system, ui-visual-validator, mobbin, and modern-web-guidance-plugin.
---

# Phase 4: Sleek Tactile Polish, Motion & Copy Purge (v2.0)

**Target Time Budget**: ~45 minutes  
**Goal**: Elevate the raw working frontend into an Awwwards-grade visual masterpiece with spatial Z-axis depth, spring physics motion, zero AI slop, factual technical copywriting (`egm-style`), flattened control flow complexity (`code-simplify`), and zero-token 3D sidecars.

---

## Architectural Principles & Gating

1. **DESIGN.md Is the Source of Truth (impeccable preflight)**:
   - Before any UI edit: run `scripts/impeccable context`, read `PRODUCT.md`, `DESIGN.md`, `skills/impeccable/reference/craft-floor.md`, then create `.sprint/impeccable.ok` (the PreToolUse hook blocks UI edits without it).
   - Surfaces, color, depth and type come from DESIGN.md tokens. No stock dark-glass template (no default `slate-950` canvas, blanket backdrop blur, or decorative 3D tilt).
   - axe-core runs in Phase 3 (auditor walkthrough); Phase 4 must keep violations at 0.
2. **The 12 Laws of Code-Driven Motion**:
   - Absolute ban on `linear` transitions and naive browser `ease-in-out`.
   - Deceleration curve: `cubic-bezier(0.25, 1, 0.5, 1)` for high-velocity entry into resting position.
   - Elastic settling curve: `cubic-bezier(0.34, 1.56, 0.64, 1)` for popovers, badges, and toggle switches.
   - Mandatory 50ms stagger cascade (`animation-delay: calc(var(--index) * 50ms)`).
   - GPU compositing strictly on `transform` and `opacity`.
3. **Authentic Notebook Sketch & Doodle Dynamic (When Sketch Mode Active)**:
   - Base canvas: `#FCFBF7` warm cream paper.
   - Horizontal blue ruled lines (`#E2E8F0` at 24px rhythm) and vertical red margin guide (`#F87171` at 48px offset).
   - High-contrast dark graphite (`#18181B`) rough hand-drawn SVG strokes with organic jitter.
   - Genuine squash-and-stretch dynamics on click/hover states.
4. **Out-of-Band 3D Sidecars (`sidecar://`)**:
   - For scientific or complex spatial projects, surface sidecar pills (`sidecar://science_biomolecular_structure_viewer_mcp`). Renders interactive 3D WebGL structures in the side pane at **zero agent context-token cost**.
5. **The `egm-style` Copywriting Purge & Heretic Anti-Sycophancy Filter (`p-e-w/heretic` pattern)**:
   - Strip all marketing fluff, hype words, and buzzwords: *"seamlessly"*, *"elevate"*, *"supercharge"*, *"unleash"*, *"cutting-edge"*, *"next-generation"*.
   - Strip conversational flattery, sycophantic agreement, and performative enthusiasm: *"Certainly!"*, *"I'd be glad to help!"*, *"Great question!"*, *"I apologize for that error"*.
   - Strip unprompted echo-chamber summaries of user instructions; enforce cold, factual, concise technical statements.
6. **Addy Osmani Complexity Reduction (`code-simplify`)**:
   - Flatten control flow with early returns; maximum nesting depth <= 2.
   - Eliminate promise chains in favor of `async/await`.
   - Consolidate fragmented state flags into discriminated union states.

---

## Active Tooling & Capabilities

- **`impeccable`**: Primary design director & anti-slop engine (`/impeccable polish`, `/impeccable critique`, `/impeccable typeset`).
- **`code-simplify`**: Addy Osmani complexity reduction and anti-rationalization engine.
- **`motion-graphics` & `antigravity-design-expert`**: 12 laws of animation, non-linear bezier curves, GSAP scroll-linked motion, and 3D perspective transforms.
- **`ui-ux-pro-max` & `tailwind-design-system`**: 79 styles, 192 palettes, 74 font pairings, 119 UX guidelines.
- **`science_biomolecular_structure_viewer_mcp`**: Zero-token interactive 3D macromolecular sidecar viewer.
- **`ui-visual-validator`**: Layout overflow, contrast ratio auditing, and visual regression testing.
- **`indian-gov-ui-skills`**: Applies UX4G standards and high-contrast bilingual typography for public/gov apps.
- **`gravitas`**: Reliability runtime verifying visual polish preserves functional test pass counts.

---

## Execution Checklist

- **User questions (every phase):** ask at least 15 questions with `AskUserQuestion` before the phase may end
  (`gates.minUserQuestionsPerPhase`). A PostToolUse hook counts them into `.sprint-state.json` `questionsByPhase`;
  `advance` refuses below 15. Ask about this phase's real decisions (trade-offs, thresholds, edge cases, cuts), 4 per call.

1. **Pre-Phase Gate**:
   - Deliver Phase 3 Executive Scorecard.
   - Confirm visual archetype and motion requirements.
2. **Apply DESIGN.md Tokens**:
   - Replace any hardcoded colors, shadows and radii with DESIGN.md tokens.
   - Run `/impeccable critique` then `/impeccable polish`; fix what the craft floor flags.
   - Re-run axe-core on changed views; 0 violations.
3. **Implement 12 Laws of Motion**:
   - Replace linear transitions with `cubic-bezier(0.25, 1, 0.5, 1)` and `cubic-bezier(0.34, 1.56, 0.64, 1)`.
   - Apply 50ms stagger cascades to list and card grids.
   - Enforce GPU acceleration on `transform` and `opacity`.
4. **Run `egm-style` Copy Purge**:
   - Scan all UI strings, buttons, headings, and doc files.
   - Purge banned buzzwords; replace with dry, measurable engineering claims.
5. **Execute `/code-simplify`**:
   - Enforce early returns (nesting depth <= 2, cyclomatic complexity <= 6).
   - Merge loose state booleans into discriminated union states.
6. **Surface Zero-Token Sidecar Links**:
   - If scientific/biomolecular domain, emit interactive sidecar pill (`sidecar://science_biomolecular_structure_viewer_mcp`).
7. **Visual Validation & Gravitas Verification**:
   - Run `ui-visual-validator` screenshot inspection.
   - Confirm zero regression on test suite.
8. **Logo for approval (mandatory)**: design 2-3 logo options for the product (authored SVG, one consistent mark plus
   wordmark, in DESIGN.md tokens), save them to `frontend/public/logo-*.svg`, render each to PNG, and ask the user to pick
   one with `AskUserQuestion` (previews, options = the logos plus "none of these, redo"). Put the approved logo in the
   app header and favicon; Phase 6 uses it in the launch video. Never ship a product without a user-approved logo.
9. **Show the running app (exit step, mandatory)**: before the scorecard, open it in the user's own browser.
   - Make sure the app is serving (`curl -s -f -o /dev/null -w "%{http_code}" <url>` returns 200).
   - Open it: `cmd.exe /c start "" "<url>"` (Windows), `open <url>` (macOS) or `xdg-open <url>` (Linux).
   - Print the clickable link on its own line, above the scorecard: `Open the app: <url>`.
   - Write the proof the gate checks:
     `node -e "require('fs').writeFileSync('.sprint/showcase-polish.json', JSON.stringify({url:'<url>',timestamp:new Date().toISOString()}))"`
   - `advance` refuses without `.sprint/showcase-polish.json` (a url and a timestamp from this phase).
10. **Design exit gate (mandatory)**: `advance` checks all five before leaving Phase 4:
   - Run `/impeccable critique` on the running UI and save it to `.sprint/impeccable-critique-p4.md`.
   - Save a desktop screenshot and a 375px-wide screenshot (file name contains `375`) to `.sprint/screens-p4/`.
   - Load every `font-family` named in CSS (`@fontsource/*` import in `frontend/src` or `@font-face` in CSS).
   - Set a real `<title>` in `frontend/index.html` (no `Vite + React` or placeholder).
   - Replace the starter `frontend/public/favicon.svg`.
11. **Phase Checkpoint**:
   - Update `SPRINT.md` and prepare Executive Scorecard with screenshot evidence for gate approval into **Phase 5 (Audit & Hardening)**.
