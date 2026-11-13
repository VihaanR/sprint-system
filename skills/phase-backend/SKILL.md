---
name: phase-backend
description: Phase 2 of the 5-Hour Hackathon Sprint. Implements backend services, Gemini AI/RAG models, databases, and APIs using fastapi-pro, ponytail (YAGNI), gemini-api, rag-implementation, api-anything MCP, sqlite/fetch/docker MCPs, firebase, postman, and gravitas.
---

# Phase 2: Core Engine, AI & Backend (Concrete Monolith Architecture v2.0)

**Target Time Budget**: ~60 minutes  
**Goal**: Build a fully operational, test-passing monolith backend with persistent storage, Gemini LLM/RAG integration, instant auth, Stripe monetization proof, clean endpoints, and mechanical live response verification.

---

## Architectural Principles & Gating

1. **Dynamic Archetype Selection**:
   - **AI, Scientific, Biotech, or Data Engineering Projects**: FastAPI (Python 3.11) monolith with Pydantic V2 and SQLite/LibSQL. Provides zero-friction integration with Python data/science packages (`rdkit`, `pandas`, `torch`).
   - **Pure Consumer SaaS or Web-First Apps**: Next.js 15 (TypeScript) fullstack monolith with Route Handlers, React Server Components, and Drizzle ORM.
2. **Ponytail Invariant 01 (Concrete First)**:
   - Absolutely zero generic repository interfaces, abstract service factories, or premature microservice divisions.
   - Collocate route logic, query execution, and validation in concrete handlers.
3. **Karpathy Core Rule 2 (Minimum Code)**:
   - Target <= 450 lines of total backend core code. The best code is code you never had to write.
4. **Minute-1 Immutable Kernel Contract**:
   - Before parallel frontend subagents dispatch in Phase 3, the backend MUST lock and export `types.ts` (or OpenAPI JSON schema). Subagents code against this immutable contract without shared git lock contention.
5. **Declarative Security & Mandatory Delegation**:
   - Identity: Zero-boilerplate auth via `auth0` or `firebase`.
   - Security Rules: If using Firebase Firestore, rules authoring is MANDATORILY delegated to `firestore-rules-author`. Wildcard rules (`allow read, write: if true;`) are strictly banned.
6. **Commercial Monetization Gate**:
   - Implement `/api/v1/billing/create-checkout-session` using `stripe` plugin. Generates live `cs_test_...` URLs for test payment verification.
7. **On-Demand FastMCP Scaffolding (Anthropics Pattern)**:
   - When custom tools or external hardware/API bridges are required without existing MCP servers, scaffold a typed FastMCP Python server (`from mcp.server.fastmcp import FastMCP`) with Pydantic schema validation in < 60s. Ad-hoc bash/curl wrappers are banned.
8. **Blast Radius & Risk Scoring Gate (Wednesday Solutions Pattern)**:
   - Calculate downstream dependents before mutating shared data models or schemas:
     $$\text{Risk Score} = \min\left(100, \; \text{Complexity} \times (\text{Dependents} + 1) \times 5\right)$$
   - If Risk Score > 80 or Blast Radius > 5 files, in-place breaking changes are strictly forbidden; enforce append-only non-breaking extensions.

---

## Active Tooling & Capabilities

- **`fastapi-pro`**: Async FastAPI 0.100+, Pydantic V2 models, dependency injection, background tasks.
- **`ponytail`**: Ruthless YAGNI engine. Bans speculative wrappers and bloated boilerplate.
- **`gravitas`**: Reliability runtime. Cites mechanical evidence (pytest outputs, exit code 0, curl status 200).
- **`gemini-api` & `prompt-engineering-patterns`**: Integrates Google Gemini 2.0 Flash/Pro with structured output.
- **`rag-implementation`**: Embeddings, vector similarity search, document chunking, and grounded responses.
- **`science` plugin**: RDKit physicochemical descriptors, PDB coordinates, Boltz-2 co-folding API.
- **`auth0` & `firebase` plugins**: Instant authenticated sessions and token verification.
- **`firestore-rules-author` subagent**: Mandatory specialist for generating tested `firestore.rules`.
- **`stripe` plugin**: Checkout sessions, customer portal, and webhook listener.
- **`api-anything` MCP**: Ingests external web data over plain HTTP (`call_operation`, `learn_site`) without third-party API keys.
- **`sqlite` MCP**: Inspects tables, seeds mock rows, and validates SQL queries directly.
- **`fetch` MCP (`--allow-private-ips`)**: Makes live HTTP requests to local endpoints (`http://127.0.0.1:8000`).
- **`docker` MCP**: Manages container compose services and persistent databases.
- **`uv-package-manager`**: Ultrafast dependency management via `uv`.

---

## Execution Checklist

1. **Pre-Phase Gate**:
   - Deliver Phase 1 Executive Scorecard.
   - Confirm backend archetype (FastAPI or Next.js 15) and data model.
2. **Environment & Scaffolding**:
   - Initialize with `uv` (`uv venv`, `uv pip install fastapi uvicorn pydantic sqlalchemy`) or `pnpm create next-app`.
3. **Database & Data Layer (Concrete First)**:
   - Declare direct SQLAlchemy / Drizzle models without repository wrappers.
   - Seed initial mock rows; verify schema with `sqlite` MCP.
4. **AI & Core Intelligence Engine**:
   - Connect `gemini-api` with optimized system prompts and structured outputs.
   - If document Q&A is needed, wire up `rag-implementation`.
   - If scientific/biotech data is needed, call `science` tools (RDKit / Boltz-2).
   - If external live data is needed, call `api-anything`.
   - For local LLM inference (e.g. `llama.cpp`), use zero-code `OPENAI_BASE_URL` redirection.
5. **Identity & Monetization**:
   - Configure `auth0` or `firebase` authentication routes.
   - If Firestore is used, dispatch `firestore-rules-author` to write and test `firestore.rules`.
   - Implement Stripe checkout session endpoint (`/api/v1/billing/create-checkout-session`).
6. **Lock Kernel Contract**:
   - Generate and export immutable `types.ts` / OpenAPI schema for Phase 3 frontend consumption.
7. **Phase Checkpoint & Gravitas Evidence Pass**:
   - Run test suite (`pytest`) and verify exit code 0.
   - Update `SPRINT.md` with mechanical test logs for gate approval into **Phase 3 (Frontend Build)**.
