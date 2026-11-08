# AAS Elite Skill: Chaos Testing & Fault Injection

This playbook provides automated fault injection and resilience testing patterns from the Agentic Awesome Skills (AAS) catalog.

## [CORE CHAOS PATTERNS]

### 1. Simulated Network Latency & Throttling
- Inject artificial delays (500ms - 3000ms) on external API dependencies to verify client loading states and timeout handling.
- Verify that UI displays responsive skeleton loaders rather than freezing the main thread.

### 2. External Service Outage Fallbacks
- Simulate 500 / 503 HTTP responses from third-party services (LLM providers, database connection drops).
- Verify graceful degradation:
  * Cache fallbacks serve stale-while-revalidate data.
  * User-facing alerts clearly explain the outage with retry buttons.
  * System does not crash or throw unhandled promise rejections.

### 3. Payload Malformation & Fuzzing
- Inject empty payloads, unexpected null values, deeply nested arrays, and out-of-range integer IDs.
- Ensure API returns clean HTTP 422 Unprocessable Entity responses rather than HTTP 500 Internal Server Errors.
