---
name: caveman
description: Extreme token compression protocol and low-token emergency operating mode. Slashes conversational overhead by 65-75% to preserve context windows and accelerate response latency. Provides /caveman. Inspired by juliusbrussee/caveman.
---

# Caveman: Extreme Token Compression Engine

Caveman is a token-saving communication protocol designed to preserve context headroom and eliminate conversational overhead during high-velocity development sprints.

> **"Why say lot word when few word do trick."**

---

## [COMPRESSION TIERS]

### Tier 1: `caveman lite` (Conversational Minimalist)
- Drop all greeting filler, polite hedging, and conversational padding.
- Retain complete grammatical sentences, but eliminate adjectives and adverbs.
- Deliver code snippets, terminal commands, and error explanations directly.
- Token reduction: **~35-45%**.

### Tier 2: `caveman full` (Telegraphic High-Density)
- Drop auxiliary verbs, articles (a, an, the), and connecting pleasantries.
- Use telegraphic fragments, bullet points, and key-value lines.
- Example:
  * *Standard*: "I have identified the failing unit test in the test suite and updated the mock configuration to resolve the issue."
  * *Caveman Full*: "Found failing test. Mock config wrong. Fixed. Tests pass: 14/14."
- Token reduction: **~60-70%**.

### Tier 3: `caveman ultra` (Raw Machine Mode)
- Zero natural language commentary.
- Output contains only:
  1. Monospace tag (`[ACTION]`, `[DIFF]`, `[VERIFY]`, `[EXIT: 0]`).
  2. Executable bash/PowerShell command block.
  3. Raw code diff block.
  4. Observed terminal assertion count.
- Token reduction: **~75-85%**.

---

## [SLASH COMMANDS]

- `/caveman lite` -> Activate Tier 1 compression.
- `/caveman full` -> Activate Tier 2 telegraphic mode.
- `/caveman ultra` -> Activate Tier 3 raw machine mode.
- `/caveman off` -> Deactivate Caveman; revert to standard `i-have-adhd` formatting.

---

## [AUTOMATIC PROACTIVE TRIGGER RULES]

`sprint-orchestrator` monitors session state and recommends `/caveman full`:
1. When session context consumption exceeds 70% of available window.
2. During iterative test/debug loops (e.g. 3 consecutive test runs with failing assertions).
3. When hitting platform model rate limits or quota warnings.
