---
name: phase-backend
description: Phase 2 of the 5-Hour Hackathon Sprint. Implements backend services, Gemini AI/RAG models, databases, and APIs using fastapi-pro, ponytail (YAGNI), gemini-api, rag-implementation, api-anything MCP, sqlite/fetch/docker MCPs, firebase, postman, and gravitas.
---

# Phase 2: Core Engine, AI & Backend (Complete API & Data Layer)

**Target Time Budget**: ~60 minutes  
**Goal**: Build a fully operational, test-passing backend with persistent storage, Gemini LLM/RAG integration, live web data feeds, clean endpoints, and mechanical live response verification.

---

## Pre-Phase Interrogation Gate

Before execution starts, the system delivers the **Phase 1 Executive Scorecard** (spec finalized, ERD schema locked, moat defined, architecture tree mapped), followed by the **Devil's Advocate 15-Point Interrogation** (mandatory >= 15 deep-dive questions across 5 dimensions). The user must confirm database engine, AI model temperature/caching, and endpoint edge cases before code execution begins.

---

## Active Tooling & Capabilities

- **`fastapi-pro`**: Async FastAPI 0.100+, Pydantic V2 models, dependency injection, background tasks.
- **`ponytail`**: Ruthless YAGNI engine. Strictly enforces concrete code first, bans speculative wrappers, prevents premature microservice splitting, and keeps codebase lean.
- **`gravitas`**: Engineering reliability runtime. Prohibits blind file edits; requires quoting mechanical evidence (pytest outputs, exit code 0, curl status 200).
- **`gemini-api` & `prompt-engineering-patterns`**: Integrates Google Gemini models (Flash, Pro, Live API, multimodal processing).
- **`rag-implementation`**: Embeddings, vector similarity search, document chunking, and grounded responses.
- **`api-anything` MCP**: Calls websites over plain HTTP (`call_operation`, `learn_site`), feeding live external web data into backend routes without third-party API keys.
- **`google-antigravity-sdk`**: Constructs autonomous multi-agent pipelines and tools in Python.
- **`data-agent-kit-plugin`**: Advanced data engineering, BigQuery queries, transformations, and notebook tasks.
- **`firebase` & `firebase-mcp-server`**: Firebase Auth, Firestore, Realtime Database, and Security Rules.
- **`google_maps_platform`**: Geolocation, reverse geocoding, directions, and places API integration.
- **`postman` plugin**: API contract testing, mocking, and collection generation.
- **`sqlite` MCP**: Inspects tables, seeds mock rows, and validates SQL queries directly in `chatbot.db` or project db.
- **`fetch` MCP (`--allow-private-ips`)**: Makes live HTTP requests to local endpoints (`http://127.0.0.1:8000`).
- **`docker` MCP**: Manages multi-container compose services and database containers.
- **`async-python-patterns` & `sql-optimization-patterns`**: Concurrency and query optimization.
- **`python-testing-patterns` / `test-driven-development`**: Pytest fixtures, async test loops, and TDD.
- **`uv-package-manager`**: Ultrafast dependency management via `uv`.

---

## Execution Checklist

1. **Pre-Phase Gate (>= 15 Questions)**:
   - Deliver Phase 1 Executive Scorecard.
   - Run Devil's Advocate interrogation probing for concurrency locks, API latency, and data persistence models.
2. **Environment & Scaffolding**:
   - Initialize with `uv` (`uv venv`, `uv pip install`).
3. **Database & Data Layer (Ponytail YAGNI Enforced)**:
   - Declare direct SQLAlchemy 2.0 models or configure Firebase Firestore without unnecessary repository wrappers.
   - Seed initial mock data; verify schemas with `sqlite` MCP or `firebase-mcp-server`.
4. **AI, External Data & Core Intelligence**:
   - Connect `gemini-api` with optimized system prompts (`prompt-engineering-patterns`).
   - If document Q&A or search is needed, wire up `rag-implementation`.
   - If third-party live data is required (e.g. flight searches, community sentiment, pricing catalogs), call `api-anything` over plain HTTP instead of writing scrapers.
5. **API Endpoints & Postman Collections**:
   - Implement routes with Pydantic validation.
   - Run `postman` collection verification and test live endpoints with `fetch` MCP.
6. **Phase Checkpoint & Gravitas Evidence Pass**:
   - Run test suite (`pytest`) and observe exit code 0.
   - Update `SPRINT.md` and prepare Executive Scorecard with mechanical test logs for gate approval into **Phase 3 (Visual Swarm & Frontend)**.
