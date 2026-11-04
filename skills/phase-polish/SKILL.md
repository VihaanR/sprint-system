---
name: phase-polish
description: Phase 4 of the 5-Hour Hackathon Sprint. Applies impeccable anti-slop design intelligence, UI/UX Pro Max, indian-gov-ui-skills (if public/gov), tailwind-design-system, ui-visual-validator, mobbin, and modern-web-guidance-plugin.
---

# Phase 4: Beautification & Polish (Design Intelligence & A11y Polish)

**Target Time Budget**: ~45 minutes  
**Goal**: Elevate the raw working frontend into an "Awwwards-grade" visual masterpiece with zero generic "AI slop", perfect typography, micro-interactions, and statutory compliance.

---

## Active Tooling & Capabilities

- **`impeccable`**: Primary design director & anti-slop engine (`/impeccable polish`, `/impeccable critique`, `/impeccable bolder`, `/impeccable typeset`, `/impeccable layout`, and `npx impeccable detect`).
- **`ui-ux-pro-max`**: Searchable offline design intelligence (79 styles, 192 palettes, 74 font pairings, 119 UX guidelines).
- **`indian-gov-ui-skills`**: Applies GIGW 3.0, DBIM v3.0, and UX4G design systems, bilingual UI patterns, and high-contrast accessibility (for Indian public/gov apps).
- **`tailwind-design-system`**: Design tokens, consistent spacing scales, and dark/light modes.
- **`ui-visual-validator`**: DOM node inspection, padding consistency, contrast ratios, and Cumulative Layout Shift (CLS) auditing.
- **`modern-web-guidance-plugin`**: Fluid typography, responsive grids, and modern CSS standards.
- **`mobbin` MCP**: Compares polished components against top-tier design references.
- **`chrome-devtools-plugin`**: High-resolution visual screenshots and layout inspection.

---

## Execution Checklist

1. **Design System & Style Archetype**:
   - Query `ui-ux-pro-max` search tool:
     ```powershell
     python "C:\Users\Vihaan\.gemini\config\skills\ui-ux-pro-max\scripts\search.py" "<product> dark mode" --domain style
     ```
   - Apply distinct visual style: Deep OLED Dark (`#000000`/`#121212`), Frosted Glassmorphism, or Bento Grid.
   - If targeting public sector or Indian audiences, apply `indian-gov-ui-skills` UX4G standards and bilingual typography.
2. **Impeccable Anti-Slop Audit & Refinement**:
   - Run deterministic anti-slop detector across the codebase:
     ```bash
     npx impeccable detect src/
     ```
   - Execute `impeccable polish` to strip generic AI gradients, balance whitespace, and sharpen contrast.
   - Run `impeccable bolder` if interface feels bland or timid; run `impeccable typeset` to enforce proper typographic rhythm.
3. **Typography & Iconography Upgrade**:
   - Enforce verified font pairings (e.g. Inter + JetBrains Mono, or Outfit + Plus Jakarta Sans).
   - Replace raw text/emojis with Phosphor / Lucide SVG icons.
4. **Micro-Interactions & Transitions**:
   - Add active button scales (`active:scale-95`), loading skeletons, and smooth CSS transitions (`duration-200`).
5. **Responsive Viewport Audit**:
   - Test mobile ($375\text{px}$), tablet ($768\text{px}$), and desktop ($1440\text{px}$). Ensure zero horizontal overflow.
6. **Phase Checkpoint**:
   - Capture clean visual screenshots via `chrome-devtools-plugin`.
   - Update `SPRINT.md` and prompt user for gate approval into **Phase 5 (Ironclad Audit & Verification)**.
