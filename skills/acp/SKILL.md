---
name: acp
description: Active Context Pruning (ACP) protocol and memory offload engine. Automatically flushes verbose logs to disk artifacts, compacts conversation history, and prevents context exhaustion. Provides /acp. Inspired by ranxianglei/billion-context.
---

# Active Context Pruning (ACP): Context Compression & Memory Offload

Active Context Pruning (ACP) prevents token degradation, context bloat, and prompt eviction during extended 5-hour hackathon sprints by systematically offloading raw execution traces to disk and condensing conversational memory into structured artifacts.

---

## [THE 4 CORE ACP INVARIANTS]

### Invariant 01: Disk-Offload Over Context Retention
- Never retain hundreds of lines of raw compiler outputs, stack traces, or repetitive terminal polling in the active conversational memory.
- Flush all raw data directly to disk artifacts:
  * Architecture & Specs -> `docs/SPEC.md`, `docs/ARCHITECTURE_TREE.md`
  * Test & Security Evidence -> `docs/AUDIT_REPORT.md`
  * Execution Ledger & Time Budget -> `SPRINT.md`
- Replace raw historical churn with direct clickable markdown links (`file:///...`).

### Invariant 02: Phase-Boundary Scorecard Condensation
- At every phase boundary (e.g. Phase 2 to Phase 3), the agent must prune all preceding conversational chatter.
- Condense the entire phase into a single high-density Executive Scorecard:
  * Time elapsed vs 5-hour target budget.
  * Quantified passing assertions and exit codes (Gravitas verified).
  * Direct file links to modified components.

### Invariant 03: Proactive /compact Gating
- Monitor session turn depth and token runway.
- When conversation length exceeds 25 turns or context utilization exceeds 60%, the agent must proactively recommend or trigger the native `/compact` command to collapse prior turns into Antigravity's hierarchical summary tree (`conversation_summaries.db`).

### Invariant 04: Emergency Compression Escalation
- If context consumption reaches >75% of window limits or API rate limits trigger:
  1. Immediately escalate output format to `caveman full` or `caveman ultra`.
  2. Strip all prose padding, adjectives, and conversational commentary.
  3. Emit raw commands, diffs, and verification assertions only.

---

## [SLASH COMMAND: /acp]

When `/acp` is invoked:
1. **Context Health Check**:
   - Evaluates conversation turn count and current active phase.
2. **Memory Offload & Disk Sync**:
   - Checks if any modified files or test results are uncommitted or unrecorded in `SPRINT.md`.
   - Flushes latest state into `SPRINT.md` and appropriate `docs/` file.
3. **Compaction Recommendation**:
   - Recommends `/compact` to trigger Antigravity's native summarizer if turns > 20.
4. **Token Mode Optimization**:
   - Suggests `/caveman lite` (moderate savings) or `/caveman full` (65-75% savings) based on remaining budget.
