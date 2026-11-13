#!/usr/bin/env python3
"""
Sprint System v2.0 - Market Trend RAG & Discovery Engine
Polls Hacker News (Show HN / AI), GitHub Trending (MCPs / Agent Skills),
and synthesizes external market intelligence into actionable sprint enhancements.
Zero external dependencies (uses Python standard library).
"""

import sys
import os
import json
import urllib.request
import urllib.parse
from datetime import datetime

# Phase classification keywords for RAG relevance mapping
PHASE_TAXONOMY = {
    "phase-01-discover": [
        "spec", "planning", "prd", "architecture", "discovery", "moat",
        "diagram", "mermaid", "brainstorm", "user research", "competitor"
    ],
    "phase-02-backend": [
        "fastapi", "rag", "database", "sqlite", "vector", "embedding",
        "llm", "inference", "gemini", "llama", "auth", "stripe", "billing", "api"
    ],
    "phase-03-frontend": [
        "react", "nextjs", "tailwind", "ui", "component", "dialog", "popover",
        "container queries", "streaming", "chat sdk", "web", "frontend", "svelte"
    ],
    "phase-04-polish": [
        "motion", "animation", "gsap", "remotion", "easing", "glassmorphism",
        "anti-slop", "typography", "design system", "micro-interaction", "theme"
    ],
    "phase-05-audit": [
        "security", "audit", "owasp", "linter", "ast", "testing", "pytest",
        "playwright", "telemetry", "sentry", "memory leak", "chaos"
    ],
    "phase-06-launch": [
        "deploy", "vercel", "railway", "netlify", "docker", "video", "demo",
        "pitch", "readme", "launch", "export", "showcase"
    ]
}

BANNED_SLOP_KEYWORDS = [
    "wrapper", "airtable clone", "simple wrapper for gpt", "boilerplate template"
]

def fetch_json(url: str, headers: dict = None) -> dict:
    default_headers = {
        "User-Agent": "SprintSystem-MarketRAG/2.0 (Autonomous Agent Engine)"
    }
    if headers:
        default_headers.update(headers)
    req = urllib.request.Request(url, headers=default_headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"[WARN] Failed fetching {url}: {e}", file=sys.stderr)
        return {}

def harvest_hacker_news() -> list:
    print("[ACTION] Querying Hacker News Algolia API for trending AI & agent tools...")
    url = (
        "https://hn.algolia.com/api/v1/search?"
        "tags=show_hn&query=ai+agent+framework+tool"
        "&hitsPerPage=25"
    )
    data = fetch_json(url)
    items = []
    for hit in data.get("hits", []):
        title = hit.get("title", "")
        url_link = hit.get("url") or f"https://news.ycombinator.com/item?id={hit.get('objectID')}"
        points = hit.get("points") or 0
        comments = hit.get("num_comments") or 0
        text = hit.get("story_text") or ""
        
        # Filter obvious slop
        if any(banned in title.lower() for banned in BANNED_SLOP_KEYWORDS):
            continue
            
        items.append({
            "source": "Hacker News (Show HN)",
            "title": title,
            "url": url_link,
            "score": points,
            "comments": comments,
            "summary": text[:240].strip() if text else "Show HN Community Launch"
        })
    return items

def harvest_github_trending() -> list:
    print("[ACTION] Querying GitHub API for trending MCP servers, agent skills, and UI engines...")
    url = (
        "https://api.github.com/search/repositories?"
        "q=mcp-server+OR+agentic+OR+ai-skills+stars:>20"
        "&sort=updated&order=desc&per_page=20"
    )
    data = fetch_json(url)
    items = []
    for repo in data.get("items", []):
        name = repo.get("full_name", "")
        desc = repo.get("description") or ""
        url_link = repo.get("html_url", "")
        stars = repo.get("stargazers_count", 0)
        topics = repo.get("topics", [])
        
        items.append({
            "source": "GitHub Trending / Recent",
            "title": name,
            "url": url_link,
            "score": stars,
            "comments": repo.get("forks_count", 0),
            "summary": (desc + " " + " ".join(topics))[:240].strip()
        })
    return items

def classify_and_score(item: dict) -> dict:
    combined_text = (item["title"] + " " + item["summary"]).lower()
    phase_scores = {}
    
    for phase, keywords in PHASE_TAXONOMY.items():
        score = sum(1 for kw in keywords if kw in combined_text)
        if score > 0:
            phase_scores[phase] = score
            
    if phase_scores:
        best_phase = max(phase_scores, key=phase_scores.get)
    else:
        best_phase = "phase-01-discover"
        
    item["target_phase"] = best_phase
    item["relevance_score"] = max(phase_scores.values()) if phase_scores else 1
    return item

def generate_market_report(items: list, output_path: str):
    print(f"[ACTION] Generating Market Trend RAG Report at {output_path}...")
    by_phase = {}
    for item in items:
        p = item["target_phase"]
        by_phase.setdefault(p, []).append(item)
        
    lines = [
        "# [MARKET TREND RAG REPORT: EMERGING TOOLS & SKILLS]",
        f"**Generated**: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%SZ')}",
        f"**Total Signals Scanned**: {len(items)} items from Hacker News & GitHub",
        "",
        "---",
        "",
        "## [HIGH-VALUE SIGNALS BY SPRINT PHASE]",
        ""
    ]
    
    phase_titles = {
        "phase-01-discover": "Phase 1: Discover (Spec, Moats & Contracts)",
        "phase-02-backend": "Phase 2: Backend (Monolith, RAG, Inference & Billing)",
        "phase-03-frontend": "Phase 3: Frontend (Zero-Slop UI & Layout Engines)",
        "phase-04-polish": "Phase 4: Polish (Motion, Spatial Depth & Anti-Slop)",
        "phase-05-audit": "Phase 5: Audit (Zero-Trust Security, Testing & Telemetry)",
        "phase-06-launch": "Phase 6: Launch (Zero-Localhost Deploy & Video Demos)"
    }
    
    for phase_key, title in phase_titles.items():
        phase_items = by_phase.get(phase_key, [])
        lines.append(f"### {title}")
        if not phase_items:
            lines.append("*No new critical market anomalies detected for this phase.*")
            lines.append("")
            continue
            
        # Sort by signal score (stars / HN points)
        sorted_items = sorted(phase_items, key=lambda x: x["score"], reverse=True)[:4]
        for it in sorted_items:
            lines.append(f"- **[{it['title']}]({it['url']})** (`{it['source']}` | Score: {it['score']})")
            lines.append(f"  *Summary*: {it['summary']}")
            lines.append(f"  *Sprint Adaptation Action*: Evaluate integration as an on-demand plugin or Phase checklist rule.")
        lines.append("")
        
    lines.append("---")
    lines.append("## [AUTONOMOUS SKILL EVOLUTION RECOMMENDATIONS]")
    lines.append("1. **Frontend / Agentic UI**: Keep monitoring trending headless UI primitives and container query toolkits.")
    lines.append("2. **Local Model Routing**: Evaluate new local MoE / quantized backends via zero-code `OPENAI_BASE_URL` redirection.")
    lines.append("3. **Anti-Slop Linter**: Continuously append newly emerging AI marketing clichés to `anti-slop/no-banned-lexicon`.")
    lines.append("")
    
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"[DONE] Market Trend RAG report generated successfully ({len(lines)} lines).")

def main():
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output_path = os.path.join(repo_root, "docs", "MARKET_TRENDS.md")
    if len(sys.argv) > 2 and sys.argv[1] == "--output":
        output_path = sys.argv[2]
        
    hn_items = harvest_hacker_news()
    gh_items = harvest_github_trending()
    all_items = [classify_and_score(it) for it in (hn_items + gh_items)]
    
    generate_market_report(all_items, output_path)
    
    # Save raw json for programmatic consumption
    json_path = os.path.join(repo_root, "docs", "market_trends.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(all_items, f, indent=2)
    print(f"[DONE] Raw JSON saved to {json_path}.")

if __name__ == "__main__":
    main()
