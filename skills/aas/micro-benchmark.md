# AAS Elite Skill: Micro-Benchmark & Latency Profiling

This playbook provides micro-benchmarking and serialization latency profiling patterns from the Agentic Awesome Skills (AAS) catalog.

## [CORE BENCHMARKING PROTOCOLS]

### 1. Sub-Millisecond Serialization
- Profile JSON encoding/decoding overhead on critical endpoints.
- Standardize on C-accelerated engines (`orjson` in Python, native V8 in Node.js) for payloads exceeding 100KB.
- Benchmark deserialization time to ensure p99 latency < 5ms.

### 2. Inner-Loop Vectorization & Comprehensions
- Profile hot path iterations. Replace nested procedural loops with list comprehensions, vector operations, or generator expressions.
- Avoid allocating unnecessary intermediate collections.

### 3. Database Query Latency & Index Verification
- Verify that every query in critical API paths runs in < 15ms.
- Enforce explicit `EXPLAIN ANALYZE` or SQLite query plan checks on filtered columns to confirm B-tree index utilization.
