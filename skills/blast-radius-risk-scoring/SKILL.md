---
name: blast-radius-risk-scoring
description: Computes downstream dependency blast radius and risk scores before modifying critical files. Prevents silent regressions in multi-agent sprints. Inspired by wednesday-solutions/ai-agent-skills.
---

# Blast Radius & Risk Scoring Engine

Curated from **`wednesday-solutions/ai-agent-skills`**, this engine prevents silent regressions and merge collisions in multi-agent sprints by calculating the downstream blast radius before any file mutation.

---

## [THE BLAST RADIUS FORMULA]

Before touching core interfaces (`types.ts`, `schema.py`, `routes.ts`, `App.tsx`, `auth.ts`), agents calculate the risk metric:

$$\text{Blast Radius} = \sum \text{Direct Downstream Importers} + \sum \text{Indirect Consumers}$$
$$\text{Risk Score} = \min\left(100, \; \text{Cyclomatic Complexity} \times (\text{Blast Radius} + 1) \times 5\right)$$

---

## [RISK TIERS & MANDATORY GATES]

| Risk Score | Tier | Blast Radius | Enforced Agent Protocol |
| :--- | :--- | :--- | :--- |
| **0 - 39** | **Low** | 0 - 2 files | Direct inline edit permitted. Run local unit test. |
| **40 - 79** | **Moderate** | 3 - 5 files | Scoped edit permitted. Must run dependent tests before marking complete. |
| **80 - 100** | **Critical** | > 5 files | **HARD STOP**. Monolithic in-place rewrite strictly banned. Must use append-only non-breaking interface extension or create an RFC test pass. |

---

## [INTEGRATION IN SPRINT SYSTEM v2.0]

- **Phase 2 (Backend)**: Prevents subagents from altering database models or Pydantic schemas without checking dependent route handlers.
- **Phase 3 (Frontend)**: Blocks workers in `workspace: "share"` from modifying shared design token definitions or root providers (`App.tsx`) if downstream components depend on them.
- **Phase 5 (Audit)**: Validates that zero high-risk uncontracted modifications occurred across the sprint.
