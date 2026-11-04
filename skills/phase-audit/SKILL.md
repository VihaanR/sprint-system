---
name: phase-audit
description: Phase 5 of the 5-Hour Hackathon Sprint. Executes security auditing, code reviews, and QA using security-auditor, coderabbit, sentry, playwright MCP, impeccable (harden/audit), e2e-testing-patterns, and indian-gov-ui-skills.
---

# Phase 5: Ironclad Audit & Verification (Security, QA & Telemetry)

**Target Time Budget**: ~45 minutes  
**Goal**: Run comprehensive automated security scans, headless browser tests, telemetry setup, and console zero-error validation to eliminate any chance of runtime crashes during judging.

---

## Active Tooling & Capabilities

- **`security-auditor`**: OWASP Top 10 vulnerability checks, SQL injection checks, auth security, and secret leak scanning.
- **`coderabbit` (`code-reviewer` agent)**: Fresh-context multi-pass review catching edge cases, memory leaks, and logic errors.
- **`impeccable` (harden / audit)**: Hardens UI edge cases (error states, text overflow, truncation, locale formatting) and performs automated design audits.
- **`sentry` plugin**: Wires real-time error telemetry and issue tracking into the project.
- **`playwright` MCP & `e2e-testing-patterns`**: Headless end-to-end regression tests across critical user journeys.
- **`chrome-devtools-plugin`**: Verifies 0 uncaught console errors, 0 asset 404s, and inspects performance.
- **`indian-gov-ui-skills`**: Validates statutory WCAG 2.1 AA criteria, color contrast ($4.5:1$), and keyboard traps.
- **`superpowers` (systematic-debugging)**: Root-cause debugging to resolve any issues caught during testing.

---

## Execution Checklist

1. **Secrets & Security Sweep**:
   - Check git staging and `.env` files: ensure zero API keys or private tokens are leaked.
   - Verify input sanitization and parameterized SQL statements via `security-auditor`.
2. **Impeccable Interface Hardening**:
   - Execute `impeccable harden` to stress-test error boundaries, loading empty states, and long text overflow resilience.
3. **Automated End-to-End Tests**:
   - Run Playwright test script validating the primary user workflow:
     $$\text{Homepage Load} \rightarrow \text{User Interaction} \rightarrow \text{Backend Response} \rightarrow \text{State Verified}$$
4. **Console & Network Zero-Error Pass**:
   - Inspect Chrome DevTools logs: **0 uncaught exceptions**, 0 network 404 errors.
5. **Telemetry & Sentry Setup**:
   - Initialize Sentry SDK to capture any live client or server errors.
6. **Accessibility Validation**:
   - Verify tab keyboard navigation and focus rings across all interactive elements.
7. **Phase Checkpoint**:
   - Output `docs/AUDIT_REPORT.md`.
   - Update `SPRINT.md` and prompt user for gate approval into **Phase 6 (Judge-Ready Pitch & Launch)**.
