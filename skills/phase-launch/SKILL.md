---
name: phase-launch
description: Phase 6 of the 5-Hour Hackathon Sprint. Packages the judge-ready submission: 60s launch video via brag, deployments via vercel/railway/firebase, Postman collections, Swagger docs, and winning README via mermaid-expert.
---

# Phase 6: Judge-Ready Pitch & Launch (Deployment & Demo Pack)

**Target Time Budget**: ~45 minutes  
**Goal**: Package the completed project into an irresistible, submission-ready hackathon package: live deployed URL, a 60-second launch video, interactive API documentation, and a compelling pitch README with Mermaid diagrams.

---

## Active Tooling & Capabilities

- **`brag` (Hyperframes)**: Generates a 60-second polished, shareable product launch video directly from the project code.
- **`vercel-plugin`**: Instant production deployment for Next.js/React frontends.
- **`railway` plugin & `docker` MCP**: Instant hosting for FastAPI backends, PostgreSQL/Redis, and Docker services.
- **`firebase` plugin**: Deploys Firebase Hosting, Cloud Functions, and security rules.
- **`postman` plugin & `openapi-spec-generation`**: Generates interactive Swagger docs and public Postman collections for judges.
- **`sentry` plugin**: Tracks the new release deployment and confirms error-free telemetry.
- **`git-advanced-workflows` & `github-mcp-server`**: Creates clean commit history, writes release notes, and tags the release (`git tag v1.0.0-hackathon`).
- **`mermaid-expert`**: Renders high-impact architecture diagrams inside the pitch `README.md`.
- **`gdocs` plugin**: Exports submission links, pitch script, and demo talking points.

---

## Execution Checklist

1. **Production Deployment**:
   - Deploy frontend via `vercel-plugin` or Firebase Hosting.
   - Deploy backend to Railway / container host and bind production environment variables.
   - Confirm the live URL loads with zero errors.
2. **Interactive Judge Tools (Swagger & Postman)**:
   - Verify `/docs` Swagger UI is accessible with pre-filled test payloads.
   - Publish a shared Postman collection link.
3. **60-Second Demo Video (`brag`)**:
   - Run `brag` to generate the Hyperframes launch video summarizing the problem, solution, and live feature walkthrough.
4. **The Winning Pitch `README.md`**:
   - Write a judge-facing `README.md` containing:
     - **Elevator Pitch & Hero Screenshots**: Headline and UI preview.
     - **Problem & Solution**: Why existing solutions fail and how your project solves it.
     - **Architecture Flowchart (`mermaid-expert`)**: Full visual data flow.
     - **Live Demo Links**: Deployed web app, Swagger API docs, Postman link, video demo.
     - **Judge Test Credentials**: Pre-seeded accounts to bypass signup friction.
5. **Phase Checkpoint**:
   - Push release tag (`v1.0.0-hackathon`) via `git-advanced-workflows` and `github-mcp-server`.
   - Finalize `SPRINT.md`: Mark all 6 phases complete. Hackathon submission ready!
