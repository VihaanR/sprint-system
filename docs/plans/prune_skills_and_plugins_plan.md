# Implementation Plan: Prune Redundant Skills & Clean Token Overhead (Updated)

## Goal Description
Every installed skill and plugin injects metadata into the agent's system prompt on **every single interaction turn**. In the current session, the context budget limit for skills was exceeded, causing Antigravity to silently truncate and exclude 50+ skills.

This updated plan **keeps `indian-gov-ui-skills` completely untouched** per your requirement, while targeting pure redundancies, duplicate copies, and platform mismatches across your skills folders to eliminate context truncation.

---

## User Decisions Applied

> [!NOTE]
> * **`indian-gov-ui-skills`**: **KEPT INTACT**. All statutory GIGW 3.0, DBIM v3.0, UX4G, and accessibility rules remain active.
> * **`flutter` Plugin**: Kept untouched.
> * **Active MCP Servers**: All existing tools (`sqlite`, `fetch`, `docker`, `github-mcp-server`, `StitchMCP`, `mobbin`, `firebase-mcp-server`, `graphify`) remain fully configured.

---

## Proposed Changes

### Component 1: Global Skills (`~/.gemini/config/skills/`)
Remove exact duplicates and redundant sub-skills whose capabilities are already 100% covered by primary skills:

#### [DELETE] `C:\Users\Vihaan\.gemini\config\skills\brag-slim`
* **Reason**: Redundant duplicate of `brag`.

#### [DELETE] `C:\Users\Vihaan\.gemini\config\skills\fastapi-templates`
* **Reason**: Redundant subset of `fastapi-pro` (which already handles project templates, routers, and scaffolding).

#### [DELETE] `C:\Users\Vihaan\.gemini\config\skills\sql-pro`
* **Reason**: Redundant with `sql-optimization-patterns` and `fastapi-pro`'s SQLAlchemy models.

#### [DELETE] `C:\Users\Vihaan\.gemini\config\skills\ui-styling`
* **Reason**: Redundant; fully covered by `ui-ux-pro-max` and `tailwind-design-system`.

#### [DELETE] `C:\Users\Vihaan\.gemini\config\skills\design-system`
* **Reason**: Redundant; `ui-ux-pro-max` generates complete design systems via `--design-system`.

---

### Component 2: Cross-Agent Skills (`~/.agents/skills/`)
Remove platform mismatches, hyperframes triplicates, and 6 duplicate animation micro-skills:

#### [DELETE] Platform Mismatches (macOS/iOS on Windows)
* `C:\Users\Vihaan\.agents\skills\write-swift`
* `C:\Users\Vihaan\.agents\skills\apple-design`
* `C:\Users\Vihaan\.agents\skills\animate-expo`

#### [DELETE] Redundant Animation Clutter (6 of 7 micro-skills)
* `C:\Users\Vihaan\.agents\skills\animate`
* `C:\Users\Vihaan\.agents\skills\animation-vocabulary`
* `C:\Users\Vihaan\.agents\skills\find-animation-opportunities`
* `C:\Users\Vihaan\.agents\skills\improve-animations`
* `C:\Users\Vihaan\.agents\skills\review-animations`
*(Kept: `animation-performance`, alongside `ui-ux-pro-max` motion presets)*

#### [DELETE] Hyperframes Triplication
* `C:\Users\Vihaan\.agents\skills\hyperframes-cli`
* `C:\Users\Vihaan\.agents\skills\hyperframes-registry`
* `C:\Users\Vihaan\.agents\skills\hyperframes`
*(Covered by the primary `brag` plugin)*

#### [DELETE] Redundant Subsets & Duplicates in `.agents/skills`
* `C:\Users\Vihaan\.agents\skills\fastapi-templates`
* `C:\Users\Vihaan\.agents\skills\sql-pro`
* `C:\Users\Vihaan\.agents\skills\ui-styling`
* `C:\Users\Vihaan\.agents\skills\design-system`
* `C:\Users\Vihaan\.agents\skills\break-ui`
* `C:\Users\Vihaan\.agents\skills\pick-ui-library`
* `C:\Users\Vihaan\.agents\skills\emil-design-eng`

---

## Token & Context Budget Impact

* **Skills Removed**: 22 redundant entries.
* **Token Savings**: ~2,200–2,800 prompt tokens saved per turn.
* **Result**: Restores headroom under the Antigravity context budget so primary skills (`ui-ux-pro-max`, `live-swarm-coding`, `fastapi-pro`, `security-auditor`) are no longer dropped or truncated.

---

## Verification Plan

### Automated Verification
Run PowerShell directory checks to verify that pruned folders are removed cleanly and primary skills remain healthy:
```powershell
Get-ChildItem "C:\Users\Vihaan\.gemini\config\skills" | Select-Object Name
Get-ChildItem "C:\Users\Vihaan\.agents\skills" | Select-Object Name
```

### Manual Verification
Confirm that Antigravity prompt budget no longer displays truncated skill warnings.
