# Sprint 1 post-mortem: what could have been better

Sources: four independent Opus 5.5 reviews, all read-only, each covering one area:

- delegation and routing
- sprint process
- product correctness
- verification, tooling and launch

They worked from the session transcript, the router (`~/.claude/bin/ab-route.js`), its logs (`~/.agent-bridge/route-logs/20261125*`, `tasks/*/status.md`), the opencode config, the phase skills and the repo. The main session cross-checked their claims and corrected two of them (see the end).

## Top 10, ranked by impact

| # | Issue | Cost | Fix next time |
|---|---|---|---|
| 1 | Phase skills not loaded for Phases 1–3 (`phase-discover`, `-backend`, `-frontend`) | Half the sprint ran on Claude's own plan; the user had to step in | First action of every phase: `Skill(phase-<name>)`. The plan indexes the phase skills, it doesn't replace them |
| 2 | Core domain risks found mid-sprint by side agents, not in Discover: no read clean-up, an 85% cutoff with legal tags, single-marker reference gaps | Three rework rounds after the backend was built | Discover includes a domain checklist plus one domain-expert review agent, before the API contract is frozen |
| 3 | The demo fixture hid the bugs: reads cut from four markers at once with perfect qualities | The app looked right while being wrong on exactly what judges would probe | A realistic single-assay fixture (MiFish-U, Phred decay, primer remnants, off-target reads) and golden expected outputs on day one |
| 4 | agy never started (`status.md` stuck at "Waiting for the agent to start…"), and was re-dispatched after `--reset` without diagnosis | About 12–18 min waiting on an executor that never launched; the retry broke "one failed attempt is enough" | After the first stall, a 2-minute transport check (`AB_DIRECT=1 agy -p "say ok"`), then fix it or drop agy for the sprint |
| 5 | Claude edited the main checkout while router jobs A and C ran, which triggered the isolation-breach check | Both runs ended `isolation-breach`; outputs had to be pulled out by hand | Claude's direct work goes in its own worktree whenever router write jobs are running |
| 6 | The demo-import path was verified with Playwright injecting file paths, not the way a human would do it | A P0 demo bug reached the user ("i cant import demo") | Gate: walk the exact click path in claude-in-chrome, with a screenshot, before any "try it" message |
| 7 | Delegated backend shipped O(n²) clustering (about 30 min on the demo) and global-identity matching (everything unassigned) | Caught only because Claude timed a real run | Briefs carry measurable acceptance: "demo < 10 s, ≥ 10/12 species assigned". Claude keeps core scientific logic, as the user's CLAUDE.md says |
| 8 | Job B sent to `--class bulk` (free models only), with all three jobs drawing on one exhausted free-quota pool | Job B fell back to Claude, while it was editing the main checkout (#5) | `ab-route.js --status` before fanning out; stagger jobs; small data jobs go in Claude's own worktree |
| 9 | `freellmapi/auto` ("opencode auto") exists in `~/.config/opencode/opencode.json` but no router chain uses it | When the pinned freellmapi models were tripped, auto-routing might have found a backend with quota (unverified) | Add `freellmapi/auto` as a chain step after the pinned models |
| 10 | No time boxes, no per-phase scorecards, and ad-hoc "Step N of 5" status on a 6-phase sprint | Drift stayed invisible until the user asked | Status line `Phase N/6 (name), time left`; a 5-line scorecard and the user's go at each phase end |

---

## 1. Delegation and routing

1. **agy transport failure, retried twice.**
   - Evidence: all three agy tasks (`d75d`, `5bfb`, `9a86`) froze at `progress: 0 … Waiting for the agent to start`. Each route log stops after `transport cli`. The router's agy stall window is 6 min (`STALL_BY_EXECUTOR.antigravity = 360000`).
   - The user's quota screenshot showed agy itself was healthy, so the agent-bridge CLI launch failed.
   - Router fix: if `status.md` still says "Waiting for the agent to start" after about 60 s, fail fast.
2. **Isolation breaches caused by Claude.**
   - The router snapshots `git status --porcelain` of the main repo before and after a write run (`ab-route.js` ~L329).
   - Claude's Job B edits to `data/` and `scripts/` tripped it for both A and C.
3. **The wrong class for Job B.**
   - The `bulk` chain is three free models with no agy.
   - At dispatch, kimi reported "All models exhausted … Soonest reset ~24h" and qwen3-coder returned 429.
   - deepseek-v4.1-flash-free was the only model left, and A and C were falling back to it at the same moment.
4. **`freellmapi/auto` never used.** It is configured with `auto-route` but no chain references it. Every chain pins kimi, qwen3-coder or opencode deepseek.
5. **Briefs too large for free executors.**
   - Whole-backend and whole-frontend jobs.
   - Free models spend their first minutes re-reading the repo.
   - Core science (clustering, matching thresholds) went to an executor, against the user's own rule.
6. **Stall budget spent one step at a time.**
   - `HARD_TIMEOUT_MS = 480000`, plus 120 s stalls for each free model.
   - A 4-step `large` chain can take more than 15 min before returning `exhausted`.
   - In a 5-hour sprint, cap each job at about 10 min of wall clock, then implement directly.

## 2. Sprint process and phase skills

1. **Phase skills skipped (P1–3).** The session's own memory note records it: "Claude planned with the same phase names but never loaded the phase skills."
2. **Discover deliverables never produced.**
   - Missing: an OpenAPI spec file, an ERD, `docs/ARCHITECTURE_TREE.md`, the edge-case sidecar in `SPRINT.md`, and the interactive gate.
   - `phase-audit` later checks for "zero circular imports in `docs/ARCHITECTURE_TREE.md`", a file that doesn't exist.
3. **No scorecards or gates.**
   - Every phase skill's pre-phase gate needs the previous phase's Executive Scorecard and a `SPRINT.md` update. Only Phases 4–6 had them.
   - Phase 4 began with a scorecard for Phase 3 written late, at the user's prompt.
4. **Mislabelled progress.**
   - "Step 1–4 of 5" on a 6-phase sprint, with "Step 3 of 5 done" repeated three times.
   - The user had to ask "what phase did you complete?".
   - This breaks the user's ADHD rule 5 (restate state each turn).
5. **The 5 h budget came from the user, not the skills.** Every phase skill says "5-Hour Hackathon Sprint" with a per-phase budget; read it before planning.
6. **Failures not costed in time.** When router jobs failed, the cost of falling back ("adds ~N min") was never stated.

## 3. Product and technical correctness

### Found late
1. **The demo fixture hid three domain gaps:** clean-up, the cutoff and marker coverage.
2. **No Discover checklist** for:
   - species cutoffs per rank
   - one marker per run
   - primer coverage per taxon group (MiFish misses crocodilians)
   - Chao1 once singletons are filtered
   - legal status only at species rank
3. **The delegated backend's O(n²) clustering and global identity** were fixed with banded semi-global alignment and a k-mer prefilter (`reference.py`, `cluster.py`, `align.py`).
4. **The README overclaimed:**
   - CMLRE/ZSI integration
   - Golden Mahseer as Schedule I
   - the Gharial as detectable

   All three were fixed before launch. Do a claims pass before deploy, where every claim cites a test, a data row or a "not yet".
5. **Tests followed the code, not the biology.** Add property tests (identity is symmetric and lies in [0,1]; a read that is a substring of a reference scores 1.0) and golden tests on real amplicons.

### Still open in the code and data
| # | Issue | Where | Suggested fix |
|---|---|---|---|
| a | The 97% species cutoff is a COI-style value. For ~170 bp MiFish reads the convention is about 98.5–99%, and congeners can be identical | `reference.py` `SPECIES_IDENTITY_DEFAULT`, applied to every marker | Per-marker default: MiFish 0.985, COI 0.97; and a tie rule (equal best hits to two species → genus) |
| b | `UNASSIGNED_IDENTITY` (0.85) sets both the order-rank cutoff and the alignment band | `reference.py` ~L21, ~L149 | Separate constants |
| c | The `markers` column in `taxa.csv` means "fetched", not "detectable by the assay". The Gharial says `12S;COI` but cannot be detected with MiFish; leftover `cytb` records aren't listed | `data/taxa.csv`, `data/indotaxa.fasta` | Rename to `fetched_markers`, or drop unlisted `cytb` records; detectability already comes from `undetectable_taxa` |
| d | Uncertain legal statuses (e.g. *Tor putitora* WPA) show as `none`, as if confirmed | `taxa.csv`, UI badges | Add an `unverified` state and show it in the UI |
| e | Chao1 switches between the classic and bias-corrected forms depending on doubletons | `diversity.py` ~L31–38 | Use the bias-corrected form throughout |
| f | A run tagged `MiFish` searches only the 25 `MiFish` records. That is intended, because partial 12S records containing the region were already cut into them. But when a species' MiFish record is missing, its full 12S records are never tried | `reference.py` marker filter | Fallback: if a taxon has no record for the run's marker, try in-silico PCR on its other 12S records at query time |

## 4. Verification, tooling and launch

1. **Human-path verification came late.**
   - claude-in-chrome was used only after the user complained.
   - The stale "Backend offline" badge (health checked once at load) also reached the user.
   - Both are now in memory (`verify-like-a-real-user.md`).
2. **Windows shell friction:**
   - Python heredocs in Git Bash mangled `\n` and failed about 7 patch scripts, each costing a retry.
   - CRLF warnings on every commit.
   - Fix: use the Edit tool or a script file, and add `.gitattributes` (`* text=auto eol=lf`).
3. **Port 8000 reserved** (Hyper-V excluded range). Found only when the server failed to start. Many restarts were by hand, with no `--reload`.
4. **Cloud logins on the critical path.**
   - The Vercel login happened in the final hour.
   - `vercel link` silently connected the GitHub repo (pushes now deploy) and wrote a `VERCEL_OIDC_TOKEN` to `.env.local`.
5. **Skill conflict settled mid-phase:** brag says 15–25 s, phase-launch says 60 s.
6. **Accessibility only in Phase 5.** The axe/contrast fixes (heatmap 4.25:1, EN badge 3.59:1) could have been caught at the end of Phase 3.
7. **Stripe:** skipping it was right for this product, but it should be decided in Phase 1 and recorded in `SPRINT.md`.
8. **Output length:** several status replies ran long against the user's ADHD rules (lists over 5 items, recaps).

## Preflight checklist for the next sprint (about 10 minutes)

1. `Skill(phase-discover)` first. Read every phase skill's time budget and set per-phase time boxes.
2. Settle skill conflicts (video length, Stripe yes or no) and record them in `SPRINT.md`.
3. Logins: `npx vercel login`, `gh auth status`, plus Railway if it is used. Run `vercel link` deliberately and review what it creates.
4. Ports: run `netsh interface ipv4 show excludedportrange protocol=tcp` and pick a free API port. Start `uvicorn --reload` as a background task.
5. Repo hygiene: `.gitattributes` (LF), and `.env*` in `.gitignore` and `.vercelignore`.
6. Router:
   - check `ab-route.js --status`
   - run a 2-minute agy smoke test
   - confirm `freellmapi/auto` is in a chain
   - do Claude's own edits in a separate worktree
7. A realistic demo fixture and golden outputs before any pipeline code. One domain-review agent on the design.
8. Each phase ends with: a claude-in-chrome human-path walk with a screenshot, an axe pass, a 5-line scorecard, and the user's go.

## What went well

- The API contract and mock run were committed before parallel jobs, so A and C could proceed independently.
- Claude timed real runs instead of trusting delegated reports, which caught the 30-minute clustering and the all-unassigned matching.
- Side-agent notes were acted on. Rank-aware naming, "possible protected, confirm", and the per-run undetectable list made the app honest.
- In-silico PCR built MiFish references for 25 taxa from real NCBI mitogenomes and partial 12S records.
- Phases 4–6 followed the skills:
  - `impeccable`, `indian-gov-web-ui`, `ponytail-review`, `code-review` and `/verify`
  - 0 axe violations
  - a live deploy that returns 200 in under 1 s
  - a 60 s video (−14.8 LUFS)
  - tag `v1.0.0-hackathon`
- Lessons were saved as memory notes with "how to apply" lines.

## Corrections to the reviews

- **"Job A's results were thrown away by the breach."** Not quite. Job A's worktree diff was reviewed, applied to the main checkout and then fixed. Only Job C's worktree was empty, because agy stalled and deepseek did nothing before the breach.
- **"MiFish runs skip the 12S records" (open item f).** This is by design. Partial 12S records that span the MiFish region were cut into `MiFish` records by `scripts/fetch_reference.py`. The real gap is narrower: no fallback at query time for taxa without a `MiFish` record.
