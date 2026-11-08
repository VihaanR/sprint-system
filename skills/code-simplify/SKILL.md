---
name: code-simplify
description: Complexity reduction and anti-rationalization verification engine. Flattens control flows, eliminates dead state, and enforces full verification without AI excuses. Provides /code-simplify. Inspired by Addy Osmani's agent-skills.
---

# Code-Simplify: Complexity Reduction & Anti-Rationalization Engine

Curated from engineering patterns by Addy Osmani (Google Chrome Engineering Director), this engine systematically reduces cognitive and cyclomatic complexity while enforcing strict anti-rationalization verification guardrails.

---

## [CYCLOMATIC COMPLEXITY REDUCTION RULES]

### Rule 01: Flatten Nested Conditionals (Early Return Pattern)
- Replace pyramid-of-doom deeply nested `if`/`else` trees with guard clauses and early returns.
- Target maximum nesting depth: **<= 2 levels**.

### Rule 02: Flatten Async/Promise Chains
- Eliminate `.then().then().catch()` chains; standardize on clean `async/await` with explicit `try/catch` or result tuples.
- Eliminate nested async callbacks.

### Rule 03: Consolidate Redundant State Variables
- Detect and merge interdependent state variables that can cause desynchronization (e.g. `isFetching`, `isUpdating`, `data`, `error`).
- Use discriminated union states: `{ status: 'idle' | 'loading' | 'success' | 'error', data, error }`.

### Rule 04: Pure Functions Over Stateful Side-Effects
- Extract complex transformation logic into deterministic, pure helper functions without external dependencies.
- Ensure all business transformations are easily testable in isolation.

---

## [ADDY OSMANI'S ANTI-RATIONALIZATION MATRIX]

Coding agents frequently attempt to rationalize cutting corners when time is short or tasks are complex. This matrix intercepts and strictly bans common AI rationalizations:

| AI Rationalization (BANNED) | Underlying Reality | Mandatory Enforced Action |
| :--- | :--- | :--- |
| *"Skipping error handling here for brevity..."* | The application will crash on unexpected inputs during judging. | Implement explicit status code handling, fallback states, and user-facing error banners. |
| *"Mocking this service because real DB/API is slow..."* | You are testing a fiction; the live endpoint may fail completely. | Wire real integration tests using live SQLite or lightweight container instances. |
| *"Leaving this edge case as a TODO for production..."* | Hackathon judges and automated audits inspect edge cases directly. | Address the edge case immediately or explicitly bound the input space with schema validation. |
| *"This test failure is just an environment timing issue..."* | The test is flaky, or an underlying race condition exists. | Diagnose race conditions, stabilize timeouts, or use deterministic polling (`wait_for`). |
| *"The styling looks good in theory based on the classes..."* | CSS classes often conflict, overflow, or fail responsive constraints. | Probe headless preview server and inspect DOM snapshot/screenshot before claiming UI victory. |

---

## [SLASH COMMAND: /code-simplify]

When `/code-simplify` is invoked:
1. Identify all functions with cyclomatic complexity > 6 or nesting depth > 2.
2. Flatten control flows with guard clauses and early returns.
3. Consolidate fragmented state declarations.
4. Run the test suite to mechanically verify zero regression.
