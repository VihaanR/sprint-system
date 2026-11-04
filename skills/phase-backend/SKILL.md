---
name: phase-backend
description: Phase 2 of the 5-Hour Hackathon Sprint. Implements backend services, Gemini AI/RAG models, databases, and APIs using fastapi-pro, gemini-api, rag-implementation, sqlite/fetch/docker MCPs, firebase, postman, and data-agent-kit-plugin.
---

# Phase 2: Core Engine, AI & Backend (Complete API & Data Layer)

**Target Time Budget**: ~60 minutes  
**Goal**: Build a fully operational, test-passing backend with persistent storage, Gemini LLM/RAG integration, clean endpoints, and live response verification.

---

## Active Tooling & Capabilities

- **`fastapi-pro`**: Async FastAPI 0.100+, Pydantic V2 models, dependency injection, background tasks.
- **`gemini-api` & `prompt-engineering-patterns`**: Integrates Google Gemini models (Flash, Pro, Live API, multimodal processing).
- **`rag-implementation`**: Embeddings, vector similarity search, document chunking, and grounded responses.
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

1. **Environment & Scaffolding**:
   - Initialize with `uv` (`uv venv`, `uv pip install`).
2. **Database & Data Layer**:
   - Declare SQLAlchemy 2.0 models or configure Firebase Firestore.
   - Seed initial mock data; verify schemas with `sqlite` MCP or `firebase-mcp-server`.
3. **AI & Core Intelligence**:
   - Connect `gemini-api` with optimized system prompts (`prompt-engineering-patterns`).
   - If document Q&A or search is needed, wire up `rag-implementation`.
4. **API Endpoints & Postman Collections**:
   - Implement routes with Pydantic validation.
   - Run `postman` collection verification and test live endpoints with `fetch` MCP.
5. **Phase Checkpoint**:
   - Verify unit test pass (`pytest`).
   - Update `SPRINT.md` and prompt user for gate approval into **Phase 3 (Visual Swarm & Frontend)**.
