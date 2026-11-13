# Sprint System v2.0: Agent Directives & Operating Invariants

Any AI coding assistant operating within this repository or executing a hackathon sprint must adhere to the **9-Faction Architectural Grand Accord**:

---

## [1. GRAVITAS RELIABILITY RUNTIME]
- **Prime Directive**: Report what actually happened, not what you intended. Every completion claim must be grounded in observed terminal output, test passes, exit code 0, or visual DOM confirmation.
- **Scoped Reconnaissance**: Never edit, patch, or refactor a file you have not read directly in the current session.
- **Evidence-Backed Verification**: Always cite the exact mechanical tool output verifying that tests pass and endpoints respond.

---

## [2. PONYTAIL RUTHLESS YAGNI & KARPATHY RULES]
- **Concrete Code First**: Abstract only on the third distinct duplication. Never create single-implementation interfaces or generic wrapper layers.
- **Negative LOC**: Prioritize lines of code deleted over lines added. Eliminate speculative abstractions.
- **Karpathy Rule 2**: Minimum code that solves the problem. Target <= 450 lines of total backend core code.

---

## [3. I-HAVE-ADHD COMMUNICATION PROTOCOL]
- **Line 1 Action**: First line is always the next immediate executable command or technical action.
- **Minute Bounds**: Every planned step carries an explicit minute estimate (`[EST: X min]`).
- **Zero Filler**: Monospace bracket tags only (`[ACTION]`, `[VERIFY]`, `[DONE]`, `[BLOCKED]`). Zero conversational preamble, zero em-dashes.

---

## [4. 45-SECOND INTERACTIVE GATE (2-TIER PROTOCOL)]
- **Tier 1 (Automated Heuristics - 12 Questions)**: Auto-resolved in <2s by scanning repository files, connected MCPs, and environment defaults.
- **Tier 2 (Irreducible Decisions - 3 Questions)**: Served as one single interactive `ask_question` modal card in Antigravity chat (moat, target user, tactile hero demo). Developer answers in 45 seconds flat.
- **Resilient Fixtures**: Enforce mandatory `DEMO_MODE=offline` fixture definitions so live judging demos never fail if conference Wi-Fi drops.

---

## [5. MECHANICAL ANTI-SLOP LINTER (AAS-v2)]
- **Auto-Fix with Hard Failback (Exit Code 1)**:
  - Banned lexicons (*"seamlessly"*, *"elevate"*, *"supercharge"*, *"unleash"*, *"cutting-edge"*) automatically purged via `egm-style` into measurable technical claims.
  - Banned visual clichés (`bg-gradient-to-r from-purple-* to-indigo-*`, decorative non-functional sparkles, fake hardcoded metric cards) strictly forbidden.
  - Addy Osmani complexity reduction enforced: nesting depth <= 2, cyclomatic complexity <= 6.

---

## [6. SLEEK UI/UX & MOTION DESIGN STANDARDS]
- **Spatial Depth**: Multi-layer Z-axis elevation, calibrated glassmorphism (`backdrop-filter: blur(16px)`), sub-pixel border highlights (`1px solid rgba(255,255,255,0.08)`), and 3D perspective transforms (`perspective: 1000px`).
- **Pro Ergonomics**: Global command palette (`Cmd+K`), keyboard navigation, instant optimistic feedback (<16ms), active press response (`active:scale-[0.98]`).
- **12 Laws of Motion**: Absolute ban on `linear` transitions. Enforce deceleration `cubic-bezier(0.25, 1, 0.5, 1)` and spring settling `cubic-bezier(0.34, 1.56, 0.64, 1)` with 50ms staggered cascades.
- **Authentic Notebook Sketch Dynamic (When Active)**: `#FCFBF7` cream paper, blue horizontal ruled lines, red margin guideline, and graphite pencil strokes (`#18181B`).

---

## [7. ZERO-COPY WORKTREES & MINUTE-1 IMMUTABLE CONTRACTS]
- Lock immutable `types.ts` / Pydantic schema before parallel workers launch.
- Parallel subagents author disjoint feature slices in native Git worktrees (`workspace: "share"`). Central files are strictly write-locked.
- Auto-discover feature slices via dynamic loaders (`import.meta.glob`).

---

## [8. 2-PASS MAP-REDUCE AUDIT & ZERO-LOCALHOST GATE]
- **Pass 1 (Mechanical)**: Pytest exit code 0 + `AgentShield` / `security-auditor` AST scan + headless Chrome visual/a11y sniff test (`axe-core` 0 violations).
- **Pass 2 (Readiness)**: `egm-implementation-readiness` checks for broken TODOs or incomplete routes.
- **Active Context Pruning (ACP)**: Raw build/test dumps flushed to disk; active context memory kept < 35%.
- **Zero-Localhost Gate**: Sprint cannot close without a live edge production URL (Vercel/Railway/Netlify) returning HTTP 200 in < 2s and verified Stripe test checkout session (`cs_test_...`).
