# SPRINT.md: Hackathon Execution Tracker

## Project Overview
* **Project Name**: [Your Project Name]
* **Elevator Pitch**: [One-sentence hook]
* **Target Hackathon**: [Hackathon Name / Tracks]
* **Sprint Start Time**: [Timestamp]
* **Target Time Budget**: 5 Hours (Max 1 Day)
* **Status**: [ACTIVE] In Progress (Phase 1)

---

## Sprint Checklist

- [ ] **Phase 1: Discover & Spec** (~30 min, floor 25 min)
  - [ ] 15+ answered user questions + 5+ challenge rounds (`.sprint/discover-log.json`)
  - [ ] Pre-flight: `router-smoke.mjs --require antigravity` + service/key checks (`.sprint/preflight.json`)
  - [ ] User-asks ledger (`.sprint/user-asks.json`) + `PRODUCT.md` + `DESIGN.md`
  - [ ] Mermaid architecture/ERD in `SPRINT.md`, golden fixture (`fixtures/*golden*`), frozen schema
  *Deliverable*: `PRODUCT.md` + `DESIGN.md` + `SPRINT.md` + golden fixture + frozen schema

- [ ] **Phase 2: Core Engine & Backend** (~60 min, floor 55 min)
  - [ ] 15+ answered user questions; core domain/scientific logic written by Opus (CEO)
  - [ ] Mechanical slices dispatched by Sonnet `builder`s via `ab-route.js`; `<= 450` core LOC
  - [ ] `.env.example` → `.env` live-key check; `DEMO_MODE=offline` + `pytest` exit 0
  *Deliverable*: Verified running API + passing `pytest`

- [ ] **Phase 3: Frontend Assembly** (~75 min, floor 70 min)
  - [ ] 15+ answered user questions; `.sprint/impeccable.ok` preflight before UI edits
  - [ ] Sonnet `builder`s dispatch UI slices via `ab-route.js` in `route-*` worktrees
  - [ ] Auditor human-click walkthrough + `axeViolations: 0` (`.sprint/phase3-proof.json`)
  - [ ] Browser showcase (`.sprint/showcase-frontend.json`) + P3 design gate (critique, desktop + `375`px screens, loaded fonts, real `<title>`, custom `favicon.svg`)
  *Deliverable*: Working, verified frontend + `.sprint/phase3-proof.json`

- [ ] **Phase 4: Beautification & Polish** (~45 min, floor 40 min)
  - [ ] 15+ answered user questions; `impeccable` critique/polish + user-approved logo
  - [ ] Browser showcase (`.sprint/showcase-polish.json`) + P4 design gate (critique, desktop + `375`px screens, loaded fonts, real `<title>`, custom `favicon.svg`)
  *Deliverable*: Polished UI + approved logo

- [ ] **Phase 5: Ironclad Audit & Verification** (~45 min, floor 40 min)
  - [ ] 15+ answered user questions + open user-asks check (`.sprint/user-asks.json`)
  - [ ] 2-pass audit (`pytest`, security scan, `/ponytail-review`, Playwright E2E, 0 console/404/a11y errors)
  *Deliverable*: `docs/AUDIT_REPORT.md` (clean security & QA pass)

- [ ] **Phase 6: Judge-Ready Pitch & Launch** (~45 min, floor 40 min)
  - [ ] 15+ answered user questions + live production URL (HTTP 200 in `< 2s`)
  - [ ] `brag` 15-25s demo video (`gates.videoDurationSec`); Stripe `cs_test_` only if `gates.stripeEnabled`
  - [ ] Swagger (`/docs`), Postman collection, claim-verified `README.md`, `.sprint/launch-proof.json`
  *Deliverable*: Live URL + 15-25s video + `.sprint/launch-proof.json`

---

## Active Phase Checkpoint Log
*(Updated automatically by `sprint-orchestrator`)*
