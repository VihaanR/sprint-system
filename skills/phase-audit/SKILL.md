---
name: phase-audit
description: Phase 5 of the 5-Hour Hackathon Sprint. Executes security auditing, code reviews, and QA using security-auditor, gravitas, ponytail (/ponytail-review), understand-anything, coderabbit, sentry, playwright MCP, impeccable (harden/audit), aas elite bundle, and e2e-testing-patterns.
---

# Phase 5: Ironclad Audit & Verification (Security, QA & Telemetry)

**Target Time Budget**: ~45 minutes  
**Goal**: Run comprehensive automated security scans, headless browser tests, telemetry setup, Ponytail negative-LOC audit, AST tree verification, and console zero-error validation to eliminate any chance of runtime crashes during judging.

---

## Pre-Phase Interrogation Gate

Before execution starts, the system delivers the **Phase 4 Executive Scorecard** (design system applied, zero layout shifts, code simplified, impeccable anti-slop pass), followed by the **Devil's Advocate 15-Point Interrogation** (mandatory >= 15 deep-dive questions across 5 dimensions). The user must confirm security boundaries, auth scopes, and critical failure modes before auditing launches.

---

## Active Tooling & Capabilities

- **`gravitas`**: Engineering reliability runtime. Prime Directive: *"Report what actually happened, not what you intended."* Prohibits sign-off without observed test suites, exit code 0, and DOM evidence.
- **`security-auditor`**: OWASP Top 10 vulnerability checks, SQL injection checks, auth security, and secret leak scanning.
- **`ponytail` (`/ponytail-review`)**: Negative LOC audit. Deletes dead code, single-use abstractions, and unneeded wrapper utilities.
- **`understand-anything`**: AST architecture tree audit. Confirms zero circular dependencies and validates architectural tier separation in `docs/ARCHITECTURE_TREE.md`.
- **`aas` elite bundle**:
  - `skills/aas/security-hardening.md`: Timing-safe comparisons, security headers, input sanitization.
  - `skills/aas/chaos-testing.md`: Latency injection, simulated service drop fallbacks.
  - `skills/aas/micro-benchmark.md`: Microsecond loop profiling and JSON serialization benchmarks.
  - `skills/aas/memory-leak-hunter.md`: Unclosed handles, dangling event listeners, heap growth checks.
- **`coderabbit` (`code-reviewer` agent)**: Fresh-context multi-pass review catching edge cases, memory leaks, and logic errors.
- **`impeccable` (harden / audit)**: Hardens UI edge cases (error states, text overflow, truncation, locale formatting) and performs automated design audits.
- **`sentry` plugin**: Wires real-time error telemetry and issue tracking into the project.
- **`playwright` MCP & `e2e-testing-patterns`**: Headless end-to-end regression tests across critical user journeys.
- **`chrome-devtools-plugin`**: Verifies 0 uncaught console errors, 0 asset 404s, and inspects performance.
- **`indian-gov-ui-skills`**: Validates statutory WCAG 2.1 AA criteria, color contrast (4.5:1), and keyboard traps.
- **`superpowers` (systematic-debugging)**: Root-cause debugging to resolve any issues caught during testing.

---

## Execution Checklist

1. **Pre-Phase Gate (>= 15 Questions)**:
   - Deliver Phase 4 Executive Scorecard.
   - Run Devil's Advocate interrogation probing for attack vectors, authentication bypasses, and unhandled exceptions.
2. **Secrets & Security Sweep (AAS Hardening)**:
   - Check git staging and `.env` files: ensure zero API keys or private tokens are leaked.
   - Apply constant-time comparisons (`hmac.compare_digest`) on webhooks/tokens.
   - Verify input sanitization and parameterized SQL statements via `security-auditor`.
3. **Ponytail Negative-LOC Review (`/ponytail-review`)**:
   - Audit modified files: eliminate dead functions, remove speculative wrappers, delete unused imports.
4. **AST Tree Audit (`understand-anything`)**:
   - Re-run AST tree inspection: verify zero circular dependencies and clean component boundaries.
5. **Impeccable Interface Hardening**:
   - Execute `impeccable harden` to stress-test error boundaries, loading empty states, and long text overflow resilience.
6. **Automated End-to-End Tests & Chaos Verification**:
   - Run Playwright test script validating the primary user workflow:
     $$\text{Homepage Load} \rightarrow \text{User Interaction} \rightarrow \text{Backend Response} \rightarrow \text{State Verified}$$
   - Run AAS chaos checks: simulate 500ms latency and verify UI skeletons remain responsive.
7. **Console & Network Zero-Error Pass**:
   - Inspect Chrome DevTools logs: **0 uncaught exceptions**, 0 network 404 errors.
8. **Telemetry & Sentry Setup**:
   - Initialize Sentry SDK to capture any live client or server errors.
9. **Accessibility & Contrast Validation**:
   - Verify tab keyboard navigation, focus rings, and contrast compliance (>= 4.5:1).
10. **Phase Checkpoint & Gravitas Evidence Pass**:
    - Output `docs/AUDIT_REPORT.md` with observed exit codes and test pass counts.
    - Update `SPRINT.md` and prepare Executive Scorecard for gate approval into **Phase 6 (Judge-Ready Pitch & Launch)**.
