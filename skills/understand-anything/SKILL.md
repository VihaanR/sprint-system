---
name: understand-anything
description: Post-Graphify architectural tree generator and interactive code explorer. Maps AST structures into architecture layers, domain models, auth flows, and complexity hotspots. Generates docs/ARCHITECTURE_TREE.md and launches interactive viewer. Inspired by Egonex-AI/Understand-Anything.
---

# Understand-Anything: Architecture Tree & Visual Code Explorer

This skill operates as the deep architectural AST and hierarchical drill-down engine within the sprint system. It executes immediately following `graphify` macro-analysis in Phase 1 (Discover) and Phase 5 (Audit) to render high-resolution architectural mental models.

---

## [POST-GRAPHIFY PIPELINE INTEGRATION]

When `graphify` completes its macro knowledge graph (`graphify-out/graph.html` and `graphify-out/GRAPH_REPORT.md`):

1. **Step 1: Scoped AST Analysis**:
   - Parse files, functions, route handlers, and database schemas.
   - Categorize components into 4 distinct architecture tiers:
     - **Presentation Tier**: UI components, pages, route views, client hooks.
     - **API & Routing Tier**: REST routers, WebSocket controllers, middleware, auth guards.
     - **Domain & Service Tier**: Business logic, AI model callers, data mappers.
     - **Persistence Tier**: Database models, migrations, caching layers, external clients.

2. **Step 2: Generate Architecture Tree Artifact**:
   - Write `docs/ARCHITECTURE_TREE.md` with:
     - Hierarchical Markdown Tree view showing directory modules and symbol exports.
     - Critical Data Flow Paths (User Input -> Auth -> Service -> Persistence -> Response).
     - Authentication & Session lifecycle map.
     - Complexity Hotspots: Files with highest fan-in/fan-out or cyclomatic density.

3. **Step 3: Launch Interactive Browser Dashboard (Optional)**:
   - Provide the user with the command to open the browser-based visualization dashboard:
     ```bash
     npx https://github.com/Egonex-AI/Understand-Anything/releases/latest/download/understand-anything-viewer.tgz .
     ```
   - Features searchable nodes, domain layer filtering, and interactive architectural drill-down.

---

## [TREE ARTIFACT TEMPLATE (docs/ARCHITECTURE_TREE.md)]

```markdown
# [SYSTEM ARCHITECTURE TREE]

## 1. Architectural Tiers & Component Hierarchy
├── [Presentation Tier]
│   ├── components/
│   └── views/
├── [API & Routing Tier]
│   ├── routes/
│   └── middleware/
├── [Domain & Logic Tier]
│   ├── services/
│   └── ai_agents/
└── [Persistence Tier]
    ├── models/
    └── db/

## 2. Critical Execution Paths
- Auth Flow: [Client] -> [Auth Middleware] -> [JWT Verify] -> [User DB Session]
- Core Feature Flow: [Request] -> [FastAPI Router] -> [Agent Orchestrator] -> [DB Write]

## 3. Complexity Hotspots & Circular Dependency Audit
- [PASSED]: Zero circular imports detected across core modules.
- Hotspot 1: orchestrator.py (Cyclomatic Complexity: 5, Fan-out: 8 dependencies)
```
