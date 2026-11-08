---
name: phase-discover
description: Phase 1 of the 5-Hour Hackathon Sprint. Leverages research subagents, mobbin, StitchMCP, api-anything MCP, impeccable (init/shape), context7, google-developer-knowledge, api-design-principles, and mermaid-expert to architect the winning moat, OpenAPI specs, and database ERD.
---

# Phase 1: Discover & Spec (Complete Research & Architecture)

**Target Time Budget**: ~30 minutes  
**Goal**: Transform a problem statement into a bulletproof technical specification with an undeniable hackathon-winning "hook" (moat), concrete API schema, and database design.

---

## Pre-Phase Interrogation Gate

Before research begins, the system executes the **Devil's Advocate 15-Point Interrogation** via `ask_question`. The user must define their vision, non-negotiable features, competitive differentiation, and target audience before research subagents dispatch.

---

## Active Tooling & Capabilities

- **`superpowers` (brainstorming)**: Translates vague requirements into concrete architecture.
- **`impeccable` (init / shape)**: Establishes durable product truth (`PRODUCT.md`), user personas, design language (`DESIGN.md`), and pre-code UX planning (`shape`).
- **`api-anything` MCP & skill**: Searches shared catalogs or learns live website APIs over plain HTTP (`find_sites`, `call_operation`), inspecting external data sources without API keys.
- **`mobbin` MCP**: Searches 600,000+ real-world app flows to benchmark industry-leading UX for this exact domain.
- **`StitchMCP`**: Generates initial visual layout concepts and wireframe variants.
- **`context7` & `google-developer-knowledge`**: Fetches verified, up-to-date documentation on target frameworks and APIs.
- **`graphify`**: Maps codebase architecture and dependency graphs if building on an existing project.
- **`github-mcp-server`**: Inspects related repos, references, and issues.
- **`api-design-principles` & `openapi-spec-generation`**: Contract-first REST API design with strict schemas.
- **`mermaid-expert`**: Renders database ERDs and sequence architecture flowcharts directly in markdown.
- **`gdocs` plugin**: Imports existing PRD/notes or exports initial project briefs to Google Docs.

---

## Execution Checklist

1. **Pre-Phase Gate**:
   - Run Devil's Advocate interrogation probing for problem statement validity, target persona, and unique technical moat.
2. **Scoping & The Winning Hook**:
   - Query `mobbin` MCP for top competitor UI/UX teardowns in this category.
   - Use `api-anything` (`find_sites`) to verify feasibility of integrating third-party web data without API key friction.
   - Run `impeccable init` to anchor product vision, target persona, and core constraints into `PRODUCT.md`.
   - Run `impeccable shape` to plan information architecture and user journeys before touching code.
   - Define the unique technical moat (e.g. edge AI, multi-agent orchestration, offline-first).
3. **System Architecture (`docs/SPEC.md`)**:
   - Use `mermaid-expert` to render end-to-end data flow (Client $\rightarrow$ API $\rightarrow$ Database/AI $\rightarrow$ Worker).
4. **Database Schema & Relational ERD**:
   - Model relational entities, foreign keys, and indexes in Mermaid syntax.
5. **API Contract Definition**:
   - Use `api-design-principles` to define endpoint routes, payload contracts, and error responses.
6. **Phase Checkpoint**:
   - Output `docs/SPEC.md`. Update `SPRINT.md` and prepare Executive Scorecard for gate approval into **Phase 2 (Core Engine & Backend)**.
