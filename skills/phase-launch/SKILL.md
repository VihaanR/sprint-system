---
name: phase-launch
description: Phase 6 of the 5-Hour Hackathon Sprint. Packages the judge-ready submission: 60s launch video via brag, deployments via vercel/railway/firebase, gravitas proof of deployment, Postman collections, Swagger docs, and winning README via mermaid-expert.
---

# Phase 6: Zero-Localhost Deployment & Remotion Launch (v2.0)

**Target Time Budget**: ~45 minutes  
**Goal**: Package the completed project into an irresistible, submission-ready hackathon package: live deployed URL, verified Stripe monetization checkout, 60-second programmatic Remotion launch video, interactive API documentation, and a compelling pitch README.

---

## Architectural Principles & The Zero-Localhost Gate

1. **The Zero-Localhost Ironclad Rule**:
   - Localhost is an instant disqualification. Hackathon judges will not clone repositories, resolve Python wheel conflicts, or paste their own API keys.
   - The sprint cannot complete until a live production URL returns `HTTP 200` in < 2 seconds.
2. **Single Deterministic Cloud Target**:
   - Vercel for Next.js/React frontends (`vercel --prod --yes`).
   - Railway for FastAPI backends, PostgreSQL/Redis, and Docker services.
   - Netlify for Edge functions and static web deployments.
   - Zero multi-cloud circus. One single concrete deployment target per project.
3. **Commercial Monetization Gate**:
   - Mechanical execution against `/api/v1/billing/create-checkout-session` returning an active `cs_test_...` Stripe checkout session URL.
4. **Programmatic Remotion React Video**:
   - Render code-driven 60-second video directly from React components (`remotion-best-practices` + `brag`) with Spring physics (`cubic-bezier(0.25, 1, 0.5, 1)`).
   - If headless Chromium rendering times out in CI, fall back gracefully to animated WebP/GIF screencast.

---

## Active Tooling & Capabilities

- **`vercel-plugin`**: Instant edge production deployment (`vercel --prod --yes`).
- **`railway` plugin & `docker` MCP**: Instant hosting for FastAPI backends, PostgreSQL/Redis, and Docker services.
- **`firebase` plugin**: Deploys Firebase Hosting, Cloud Functions, and security rules.
- **`remotion-best-practices` & `brag`**: Programmatic 60s React code-video production with spring physics.
- **`stripe` plugin**: Verifies live test checkout session creation.
- **`gravitas`**: Reliability runtime. Verifies live URLs return HTTP 200 and video artifacts exist on disk before claiming launch completion.
- **`postman` plugin & `openapi-spec-generation`**: Generates interactive Swagger docs and public Postman collections for judges.
- **`git-advanced-workflows` & `github-mcp-server`**: Creates clean commit history, writes release notes, and tags release (`git tag v1.0.0-hackathon`).
- **`mermaid-expert`**: Renders high-impact architecture diagrams inside the pitch `README.md`.

---

## Execution Checklist

1. **Pre-Phase Gate**:
   - Deliver Phase 5 Executive Scorecard (clean 2-pass audit, 0 vulnerabilities, 0 a11y violations).
   - Confirm cloud deployment target.
2. **Production Deployment & Zero-Localhost Verification**:
   - Deploy backend to Railway or container host; bind production env vars.
   - Deploy frontend to Vercel or Netlify.
   - Run Gravitas verification:
     ```bash
     curl -s -f -o /dev/null -w "%{http_code}" $PRODUCTION_DEPLOYED_URL
     ```
     Assert returns `200`.
3. **Verify Stripe Monetization Gate**:
   - Trigger test checkout session:
     ```bash
     curl -s -X POST "$PRODUCTION_DEPLOYED_URL/api/v1/billing/create-checkout-session"
     ```
     Verify response contains active `cs_test_...` URL.
4. **Compile 60-Second Demo Video**:
   - Run Remotion compilation script via `remotion-best-practices` / `brag`.
   - Verify `artifacts/launch_demo.mp4` exists with non-zero byte size (or fall back to animated WebP/GIF).
5. **Interactive Judge Tools (Swagger & Postman)**:
   - Confirm `$PRODUCTION_DEPLOYED_URL/docs` Swagger UI renders with pre-filled test payloads.
   - Publish shared Postman collection link.
6. **The Winning Pitch `README.md`**:
   - Write judge-facing `README.md` containing:
     - **Elevator Pitch & Hero Screenshot**: Headline, problem statement, and live UI preview.
     - **The 10-Second Tactile Moat**: Highlight the unique architectural differentiator.
     - **Architecture Flowchart (`mermaid-expert`)**: Full visual data flow.
     - **Live Links**: Deployed web app, Swagger API docs, Postman link, demo video.
     - **One-Click Demo Credentials**: Pre-seeded accounts to eliminate login friction.
7. **Phase Checkpoint & Git Release Tag**:
   - Push release tag (`v1.0.0-hackathon`) via `git-advanced-workflows` and `github-mcp-server`.
   - Finalize `SPRINT.md`: Mark all 6 phases complete with mechanical proofs. Hackathon submission ready!
