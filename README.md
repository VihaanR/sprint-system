# ⚡ Sprint System

> **The 5-Hour Global Hackathon Operating System for AI Coding Agents**  
> *Inspired by [`affaan-m/ecc`](https://github.com/affaan-m/ecc), designed for Google Antigravity, Claude Code, and Cursor.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Antigravity Compatible](https://img.shields.io/badge/Antigravity-Ready-purple.svg)](https://antigravity.google)
[![Architecture: 6--Phase](https://img.shields.io/badge/Sprint-6--Phase%20Pipeline-emerald.svg)](#the-6-sprint-phases)
[![Execution: 5h Budget](https://img.shields.io/badge/Time%20Budget-5%20Hours-amber.svg)](#time-budget--fast-gated-autonomy)

---

## 🎯 The Problem

Developers and hackathon competitors frequently have dozens of cutting-edge AI skills, plugins, and MCP servers at their disposal—yet during a time-crunched hackathon, tool execution degrades into chaotic, ad-hoc prompting. Context windows overflow, critical verification steps get skipped, and projects end with unstyled UIs or fatal runtime crashes during live judging.

**Sprint System** solves this by enforcing a disciplined, phase-based agentic operating system that orchestrates **21+ plugins, 9 MCP servers, and 22 skills** into an automated, production-ready pipeline.

$$\text{Problem Statement} \longrightarrow \mathbf{5\text{ Hours of Prompting}} \longrightarrow \text{Global Hackathon Winning Submission}$$

---

## 🏗️ The 6-Phase Pipeline

```mermaid
flowchart LR
    P1["Phase 1: Discover<br/>(~30m)<br/>Spec & Moat"] --> P2["Phase 2: Backend<br/>(~60m)<br/>API & AI Engine"]
    P2 --> P3["Phase 3: Frontend<br/>(~75m)<br/>Visual Swarm Build"]
    P3 --> P4["Phase 4: Polish<br/>(~45m)<br/>UI/UX Pro Max"]
    P4 --> P5["Phase 5: Audit<br/>(~45m)<br/>Security & QA"]
    P5 --> P6["Phase 6: Launch<br/>(~45m)<br/>Deploy & 60s Video"]

    SO["⚡ sprint-orchestrator<br/>(Master Coordinator)"] -.->|Maintains State| SPRINT[("SPRINT.md")]
    SO -.-> P1
    SO -.-> P2
    SO -.-> P3
    SO -.-> P4
    SO -.-> P5
    SO -.-> P6
```

---

## ⏱️ Time Budget & Phase Breakdown

| Phase | Duration | Core Goal | Key Deliverables |
|---|---|---|---|
| **Phase 1: `phase-discover`** | ~30 min | Problem Scoping & Moat | `docs/SPEC.md`, winning hook, OpenAPI schema, Mermaid ERD |
| **Phase 2: `phase-backend`** | ~60 min | Core Engine & Data Layer | Async FastAPI, SQLite/Postgres persistence, Gemini API/RAG, passing pytest suite |
| **Phase 3: `phase-frontend`** | ~75 min | Visual Swarm Assembly | Hot-reloaded UI assembly via `live-swarm-coding` with parallel agent cursors |
| **Phase 4: `phase-polish`** | ~45 min | Beautification & Aesthetics | OLED Dark / Glassmorphic styling, typography scale, Phosphor icons, microcopy |
| **Phase 5: `phase-audit`** | ~45 min | Security & Verification | OWASP scan (`security-auditor`), Playwright E2E smoke tests, 0 console errors |
| **Phase 6: `phase-launch`** | ~45 min | Judge-Ready Demo Pack | Live production URL, 60s `brag` demo video, Swagger UI, killer `README.md` |

---

## 🗺️ Complete Toolchain Master Matrix

The system dynamically activates the right tools based on the current phase:

```mermaid
flowchart TD
    subgraph P1 ["Phase 1: Discover & Spec"]
        t1["Plugins: superpowers, context7, google-developer-knowledge, gdocs<br/>MCPs: mobbin, StitchMCP, github-mcp-server, graphify<br/>Skills: api-design-principles, mermaid-expert, openapi-spec-generation"]
    end

    subgraph P2 ["Phase 2: Backend, AI & Data"]
        t2["Plugins: gemini-api, google-antigravity-sdk, data-agent-kit, firebase, postman, google_maps<br/>MCPs: sqlite, fetch, docker, firebase-mcp-server<br/>Skills: fastapi-pro, rag-implementation, prompt-engineering, async-python, sql-optimization, python-testing, uv"]
    end

    subgraph P3 ["Phase 3: Visual Swarm & Frontend"]
        t3["Plugins: browser-code-verifier, chrome-devtools, android-cli, flutter, modern-web-guidance<br/>MCPs: StitchMCP<br/>Skills: live-swarm-coding, react-state-management, react-modernization, mobile-developer"]
    end

    subgraph P4 ["Phase 4: UI/UX Beautification"]
        t4["Plugins: modern-web-guidance, indian-gov-ui-skills (GIGW/UX4G)<br/>MCPs: mobbin, StitchMCP<br/>Skills: ui-ux-pro-max, tailwind-design-system, ui-visual-validator"]
    end

    subgraph P5 ["Phase 5: Security & QA Audit"]
        t5["Plugins: coderabbit, sentry, chrome-devtools, indian-gov-ui-skills (WCAG)<br/>MCPs: playwright, graphify<br/>Skills: security-auditor, e2e-testing-patterns, superpowers (debug)"]
    end

    subgraph P6 ["Phase 6: Pitch & Production Launch"]
        t6["Plugins: brag (video), vercel-plugin, railway, firebase, postman, gdocs<br/>MCPs: github-mcp-server<br/>Skills: brag, openapi-spec-generation, git-advanced-workflows, mermaid-expert"]
    end

    P1 --> P2 --> P3 --> P4 --> P5 --> P6
```

---

## 🎨 The Multi-Agent Visual Swarm (`live-swarm-coding`)

Includes a standalone visual engine (`skills/live-swarm-coding/resources/swarm-overlay.js`) delivering the viral **`pen.dev` multiplayer canvas aesthetic** directly over your live React/HTML browser window:

* 🟣 **Agent Orion**: Layout, Flexbox, & Grid hierarchy.
* 🟢 **Agent Lyra**: Glassmorphic styling, Tailwind colors, & gradients.
* 🟠 **Agent Echo**: Reactive state, event listeners, & hooks.
* 🔵 **Agent Nova**: Real-time WCAG accessibility validator.
* **Selection Bounding Boxes**: Dashed, animated outline boxes that snap around components being actively edited.
* **Code Streamers**: Floating syntax-highlighted pills displaying diffs in real time.

---

## 🚀 Quickstart & Installation

### Option 1: In Google Antigravity
Clone or copy the `skills/` directory into your global Antigravity config:

```powershell
git clone https://github.com/VihaanR/sprint-system.git
Copy-Item -Path "sprint-system\skills\*" -Destination "$HOME\.gemini\config\skills\" -Recurse -Force
```

To kick off a project:
> **"Start sprint for [Your Hackathon Project Idea]"**

### Option 2: In Claude Code / Cursor / Codex
Copy the `skills/` folders to your agent skills directory (`~/.claude/skills/` or `~/.agents/skills/`):

```bash
cp -r sprint-system/skills/* ~/.agents/skills/
```

---

## 📋 The `SPRINT.md` Checkpoint Workflow

Every project initializes a root `SPRINT.md` tracking file. The system enforces **Fast-Gated Autonomy**:

1. Subagents execute the current phase autonomously.
2. The orchestrator updates `SPRINT.md` with a 3-bullet summary of completed deliverables.
3. The agent pauses for your 1-click confirmation before moving to the next phase:
   > *"Phase 2 complete. All 6 endpoints verified via fetch MCP. Proceed to Phase 3 (Frontend)?"*

---

## 📄 License

MIT License. Crafted for builders, hackers, and autonomous software engineers.
