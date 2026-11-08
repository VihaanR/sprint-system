# AAS Elite Skill: Security Hardening

This playbook provides automated defensive hardening patterns from the Agentic Awesome Skills (AAS) catalog.

## [CORE HARDENING PROTOCOLS]

### 1. Timing-Safe Cryptographic Comparisons
- Never use standard equality `==` or `===` when verifying HMAC signatures, webhook secrets, or API auth tokens.
- Standardize on constant-time comparison:
  * Python: `hmac.compare_digest(token_a, token_b)`
  * Node.js: `crypto.timingSafeEqual(buffer_a, buffer_b)`

### 2. Defense-in-Depth Input Sanitization
- Every external input must pass strict Pydantic V2 / Zod schema validation before reaching business logic.
- Strip control characters and sanitize query strings to prevent SQL, NoSQL, and command injection attacks.
- Enforce maximum payload length limits on incoming JSON bodies.

### 3. Production Security Headers
- Ensure all HTTP responses return standard hardening headers:
  * `X-Content-Type-Options: nosniff`
  * `X-Frame-Options: DENY`
  * `Content-Security-Policy: default-src 'self'`
  * `Strict-Transport-Security: max-age=31536000; includeSubDomains`

### 4. Zero Secrets in Output & Git
- Scan all commits and logs for accidental token leakage (`AIza...`, `sk-...`, `Bearer ...`).
- Force environment variable resolution via `.env` with `.env.example` stubs.
