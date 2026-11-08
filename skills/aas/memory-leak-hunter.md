# AAS Elite Skill: Memory Leak Hunter

This playbook provides automated memory leak detection and heap growth diagnostic patterns from the Agentic Awesome Skills (AAS) catalog.

## [CORE LEAK HUNTING PROTOCOLS]

### 1. Unclosed File Handles & Connection Pools
- Verify that every database session, HTTP client (`httpx.AsyncClient`), and file handle uses structured context managers (`with` / `async with`).
- Audit connection pool exhaustion settings: verify explicit timeout bounds and connection release triggers.

### 2. Dangling Event Listeners & Timers
- On the client side (React, Vue, vanilla JS), verify that every `addEventListener`, `setInterval`, or WebSocket connection has an explicit cleanup in `useEffect` return functions or component teardown hooks.

### 3. Heap Growth Monitoring
- Inspect heap memory retention across 1,000 synthetic request iterations.
- If memory grows monotonically without plateauing under garbage collection, isolate static cache accumulation or global dictionary growths.
