---
name: phase-discover
description: Phase 1 of the 5-Hour Hackathon Sprint. Leverages research subagents, mobbin, StitchMCP, api-anything MCP, impeccable (init/shape), context7, google-developer-knowledge, api-design-principles, mermaid-expert, graphify, and understand-anything to architect the winning moat, OpenAPI specs, database ERD, and architecture tree.
---

# Phase 1: Discover & Spec (Complete Research & Architecture)

**Target Time Budget**: ~30 minutes  
**Goal**: Transform a problem statement into a bulletproof technical specification with an undeniable hackathon-winning "hook" (moat), concrete API schema, database design, and deep architectural tree.

---

## Pre-Phase Interrogation Gate

Before research begins, the system executes the **Devil's Advocate 15-Point Interrogation** (mandatory >= 15 deep-dive questions across 5 dimensions). The user must define their vision, non-negotiable features, competitive differentiation, and target audience before research subagents dispatch.

---

## Active Tooling & Capabilities

- **`superpowers` (brainstorming)**: Translates vague requirements into concrete architecture.
- **`impeccable` (init / shape)**: Establishes durable product truth (`PRODUCT.md`), user personas, design language (`DESIGN.md`), and pre-code UX planning (`shape`).
- **`api-anything` MCP & skill**: Searches shared catalogs or learns live website APIs over plain HTTP (`find_sites`, `call_operation`), inspecting external data sources without API keys.
- **`mobbin` MCP**: Searches 600,000+ real-world app flows to benchmark industry-leading UX for this exact domain.
- **`StitchMCP`**: Generates initial visual layout concepts and wireframe variants.
- **`context7` & `google-developer-knowledge`**: Fetches verified, up-to-date documentation on target frameworks and APIs.
- **`graphify`**: Maps codebase architecture and macro dependency graphs (`graphify-out/graph.html`).
- **`understand-anything`**: Analyzes AST structures post-Graphify to generate hierarchical `docs/ARCHITECTURE_TREE.md` and optional interactive browser exploration.
- **`gravitas`**: Enforces scoped reconnaissance (no blind speculation) and evidence-backed specification claims.
- **`github-mcp-server`**: Inspects related repos, references, and issues.
- **`api-design-principles` & `openapi-spec-generation`**: Contract-first REST API design with strict schemas.
- **`mermaid-expert`**: Renders database ERDs and sequence architecture flowcharts directly in markdown.
- **`gdocs` plugin**: Imports existing PRD/notes or exports initial project briefs to Google Docs.

---

## Execution Checklist

1. **Pre-Phase Gate (>= 15 Questions)**:
   - Run Devil's Advocate interrogation probing for problem statement validity, target persona, and unique technical moat.
2. **Scoping & The Winning Hook**:
   - Query `mobbin` MCP for top competitor UI/UX teardowns in this category.
   - Use `api-anything` (`find_sites`) to verify feasibility of integrating third-party web data without API key friction.
   - Run `impeccable init` to anchor product vision, target persona, and core constraints into `PRODUCT.md`.
   - Run `impeccable shape` to plan information architecture and user journeys before touching code.
   - Define the unique technical moat (e.g. edge AI, multi-agent orchestration, offline-first).
3. **Macro Knowledge Graph & AST Tree (Post-Graphify Drill-Down)**:
   - Run `graphify` to map file dependencies and macro god nodes.
   - Run `understand-anything` immediately post-Graphify to output `docs/ARCHITECTURE_TREE.md` and offer `npx understand-anything-viewer`.
4. **System Architecture (`docs/SPEC.md`)**:
   - Use `mermaid-expert` to render end-to-end data flow (Client -> API -> Database/AI -> Worker).
5. **Database Schema & Relational ERD**:
   - Model relational entities, foreign keys, and indexes in Mermaid syntax.
6. **API Contract Definition**:
   - Use `api-design-principles` to define endpoint routes, payload contracts, and error responses.
7. **Phase Checkpoint & Gravitas Evidence Pass**:
   - Output `docs/SPEC.md` and `docs/ARCHITECTURE_TREE.md`. Update `SPRINT.md` and prepare Executive Scorecard with mechanical evidence for gate approval into **Phase 2 (Core Engine & Backend)**.
