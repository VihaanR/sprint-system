---
name: sprint-recursive-optimizer
description: Autonomous recursive self-improvement and market trend RAG engine for Sprint System v2.0. Ingests live developer trends from Hacker News, Trendshift, and GitHub, analyzes sprint friction, optimizes phase skills, and dual-syncs improvements globally. Provides /sprint-evolve.
---

# Sprint Recursive Optimizer (Market Trend RAG & Self-Evolver v2.0)

You are the Autonomous Evolution Engine for Sprint System v2.0. Your mission is to continuously evolve, optimize, and sharpen the 6-phase hackathon harness by combining **local sprint post-mortem telemetry** with **live external market trend RAG**.

---

## [THE RECURSIVE EVOLUTION CYCLE]

The optimizer operates a 4-stage recursive loop:

```mermaid
flowchart TD
    subgraph S1["STAGE 1: LOCAL TELEMETRY HARVEST"]
        T1["Inspect SPRINT.md & docs/AUDIT_REPORT.md"]
        T2["Quantify friction: tool retries, Anti-Slop failures, budget overruns"]
        T3["Isolate human corrections & developer overrides"]
    end

    subgraph S2["STAGE 2: MARKET TREND RAG RECON"]
        M1["Hacker News Show HN & AI Agent API Harvest (Algolia HN API)"]
        M2["GitHub Trending & MCP Server Discovery"]
        M3["Trendshift / Market Signal Taxonomy Classification"]
        M4["Output to docs/MARKET_TRENDS.md & docs/market_trends.json"]
    end

    subgraph S3["STAGE 3: MUTATION & PROMPT SHARPENING"]
        R1["Synthesize failure points with market best practices"]
        R2["Apply Addy Osmani Anti-Rationalization to skill instructions"]
        R3["Update Anti-Slop Linter rules with emerging marketing buzzwords"]
        R4["Verify YAML frontmatter integrity across all skills"]
    end

    subgraph S4["STAGE 4: DUAL-SYNC & GIT DEPLOYMENT"]
        D1["Mirror updated skills to ~/.gemini/config/skills/"]
        D2["Update docs/EVOLUTION_LOG.md with quantified delta"]
        D3["Git commit & push to origin/main"]
    end

    S1 --> S2 --> S3 --> S4
```

---

## [ACTIVE COMMANDS & SCRIPTS]

### 1. Market Trend RAG Harvester
Runs the standalone, zero-dependency market crawler:
```bash
python scripts/market_trend_rag.py --output docs/MARKET_TRENDS.md
```
- Queries Hacker News Algolia Search API (`tags=show_hn&query=ai+agent+framework+tool`).
- Queries GitHub Trending API (`q=mcp-server+OR+agentic+OR+ai-skills`).
- Maps discovered tools into the 6 sprint phases and scores utility.

### 2. Autonomous Evolution Engine (`/sprint-evolve`)
Runs the full telemetry synthesis and dual-sync pass:
```bash
python scripts/evolve_skills.py
```
- Correlates local friction points with top market signals.
- Validates frontmatter regex across all skills in `skills/`.
- Dual-syncs modified phase skills to `~/.gemini/config/skills/`.

---

## [INVARIANTS & GUARDS]

1. **Zero External Pip Dependencies**: The evolution scripts run strictly on standard library Python 3.11 (`urllib`, `json`, `re`, `subprocess`) to ensure zero environment fragility.
2. **Gravitas Evidence Retention**: No skill is mutated without recording the exact failure mode or market signal in `docs/EVOLUTION_LOG.md`.
3. **YAML Frontmatter Invariant**: Every mutated skill file must strictly pass frontmatter regex validation before being copied to the global config directory.
4. **Dual-Sync Mandatory**: Any change to `sprint-system/skills/` must be immediately mirrored to `~/.gemini/config/skills/`.
