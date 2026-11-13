#!/usr/bin/env python3
"""
Sprint System v2.0 - Market Trend RAG & Discovery Engine
Polls Trendshift (trendshift.io), Hacker News (Show HN / AI), and GitHub Trending,
synthesizing external developer momentum into actionable sprint enhancements.
Zero external dependencies (uses Python standard library).
"""

import sys
import os
import json
import re
import urllib.request
import urllib.parse
from datetime import datetime

# Phase classification keywords for RAG relevance mapping
PHASE_TAXONOMY = {
    "phase-01-discover": [
        "spec", "planning", "prd", "architecture", "discovery", "moat",
        "diagram", "mermaid", "brainstorm", "user research", "competitor",
        "benchmark", "evaluation"
    ],
    "phase-02-backend": [
        "fastapi", "rag", "database", "sqlite", "vector", "embedding",
        "llm", "inference", "gemini", "llama", "auth", "stripe", "billing",
        "api", "backend", "duckdb", "server"
    ],
    "phase-03-frontend": [
        "react", "nextjs", "tailwind", "ui", "component", "dialog", "popover",
        "container queries", "streaming", "chat sdk", "web", "frontend", "svelte",
        "headless", "browser"
    ],
    "phase-04-polish": [
        "motion", "animation", "gsap", "remotion", "easing", "glassmorphism",
        "anti-slop", "typography", "design system", "micro-interaction", "theme",
        "guidance", "svg", "icons"
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
    "wrapper for gpt", "simple wrapper", "airtable clone"
]

def fetch_url(url: str, headers: dict = None) -> str:
    default_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SprintSystem/2.0"
    }
    if headers:
        default_headers.update(headers)
    req = urllib.request.Request(url, headers=default_headers)
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"[WARN] Failed fetching {url}: {e}", file=sys.stderr)
        return ""

def harvest_trendshift() -> list:
    print("[ACTION] Querying Trendshift (trendshift.io) for live momentum rankings...")
    html = fetch_url("https://trendshift.io/")
    items = []
    if not html:
        return items

    scripts = re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.DOTALL)
    for s in scripts:
        try:
            parsed = json.loads(s.strip())
            if isinstance(parsed, dict) and "itemListElement" in parsed:
                for entry in parsed["itemListElement"]:
                    pos = entry.get("position", 99)
                    repo = entry.get("item", {})
                    name = repo.get("name") or ""
                    desc = repo.get("description") or "Trending on Trendshift"
                    url_link = repo.get("codeRepository") or repo.get("url") or f"https://github.com/{name}"
                    lang = repo.get("programmingLanguage") or "Code"
                    
                    if not name:
                        continue
                    if any(banned in name.lower() for banned in BANNED_SLOP_KEYWORDS):
                        continue

                    # Momentum score scaled inversely with rank position
                    momentum_score = max(10, 1000 - (pos * 35))
                    items.append({
                        "source": "Trendshift.io (Momentum Leader)",
                        "title": f"{name} [{lang}]",
                        "url": url_link,
                        "score": momentum_score,
                        "rank": pos,
                        "summary": desc[:240].strip()
                    })
        except Exception as e:
            print(f"[WARN] Error parsing Trendshift JSON-LD: {e}", file=sys.stderr)

    print(f"[DONE] Trendshift harvested: {len(items)} fast-rising momentum repositories.")
    return items

def harvest_hacker_news() -> list:
    print("[ACTION] Querying Hacker News Algolia API for trending AI & agent tools...")
    url = (
        "https://hn.algolia.com/api/v1/search?"
        "tags=show_hn&query=ai+agent+framework+tool"
        "&hitsPerPage=20"
    )
    raw = fetch_url(url)
    items = []
    if not raw:
        return items

    try:
        data = json.loads(raw)
        for hit in data.get("hits", []):
            title = hit.get("title", "")
            url_link = hit.get("url") or f"https://news.ycombinator.com/item?id={hit.get('objectID')}"
            points = hit.get("points") or 0
            text = hit.get("story_text") or ""
            
            if any(banned in title.lower() for banned in BANNED_SLOP_KEYWORDS):
                continue
                
            items.append({
                "source": "Hacker News (Show HN)",
                "title": title,
                "url": url_link,
                "score": points,
                "rank": 0,
                "summary": text[:240].strip() if text else "Show HN Community Launch"
            })
    except Exception as e:
        print(f"[WARN] Error parsing HN data: {e}", file=sys.stderr)

    return items

def harvest_github_trending() -> list:
    print("[ACTION] Querying GitHub API for trending MCP servers, agent skills, and UI engines...")
    url = (
        "https://api.github.com/search/repositories?"
        "q=mcp-server+OR+agentic+OR+ai-skills+stars:>20"
        "&sort=updated&order=desc&per_page=15"
    )
    raw = fetch_url(url)
    items = []
    if not raw:
        return items

    try:
        data = json.loads(raw)
        for repo in data.get("items", []):
            name = repo.get("full_name", "")
            desc = repo.get("description") or ""
            url_link = repo.get("html_url", "")
            stars = repo.get("stargazers_count", 0)
            topics = repo.get("topics", [])
            
            items.append({
                "source": "GitHub Search (Active Velocity)",
                "title": name,
                "url": url_link,
                "score": stars,
                "rank": 0,
                "summary": (desc + " " + " ".join(topics))[:240].strip()
            })
    except Exception as e:
        print(f"[WARN] Error parsing GitHub data: {e}", file=sys.stderr)

    return items

def harvest_github_agent_skills() -> list:
    print("[ACTION] Querying GitHub API specifically for viral 'agent skills' repositories...")
    url = (
        "https://api.github.com/search/repositories?"
        "q=agent+skills+stars:>50&sort=stars&order=desc&per_page=12"
    )
    raw = fetch_url(url)
    items = []
    if not raw:
        return items

    try:
        data = json.loads(raw)
        for repo in data.get("items", []):
            name = repo.get("full_name", "")
            desc = repo.get("description") or ""
            url_link = repo.get("html_url", "")
            stars = repo.get("stargazers_count", 0)
            topics = repo.get("topics", [])
            
            items.append({
                "source": "GitHub Agent Skills Ecosystem",
                "title": f"Skill: {name}",
                "url": url_link,
                "score": stars,
                "rank": 0,
                "summary": (desc + " " + " ".join(topics))[:240].strip()
            })
    except Exception as e:
        print(f"[WARN] Error parsing Agent Skills data: {e}", file=sys.stderr)

    print(f"[DONE] Harvested {len(items)} top online agent skills repositories.")
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
        f"**Total Signals Scanned**: {len(items)} items from Trendshift.io, Hacker News & GitHub",
        "",
        "---",
        "",
        "## [HIGH-MOMENTUM SIGNALS BY SPRINT PHASE]",
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
            
        # Deduplicate by url and sort by momentum score
        seen = set()
        deduped = []
        for it in phase_items:
            if it["url"] not in seen:
                seen.add(it["url"])
                deduped.append(it)

        sorted_items = sorted(deduped, key=lambda x: x["score"], reverse=True)[:5]
        for it in sorted_items:
            lines.append(f"- **[{it['title']}]({it['url']})** (`{it['source']}` | Momentum Score: {it['score']})")
            lines.append(f"  *Summary*: {it['summary']}")
            lines.append(f"  *Sprint Adaptation Action*: Evaluate integration as an on-demand plugin or Phase checklist rule.")
        lines.append("")
        
    lines.append("---")
    lines.append("## [AUTONOMOUS SKILL EVOLUTION RECOMMENDATIONS]")
    lines.append("1. **Trendshift Momentum Tracking**: Prioritize tools holding Rank #1-#5 on Trendshift (e.g. `vercel-labs/ui`, `modern-web-guidance`).")
    lines.append("2. **Frontend / Agentic UI**: Absorb modern container query and headless browser automation standards.")
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
        
    trendshift_items = harvest_trendshift()
    skills_items = harvest_github_agent_skills()
    hn_items = harvest_hacker_news()
    gh_items = harvest_github_trending()
    all_items = [classify_and_score(it) for it in (trendshift_items + skills_items + hn_items + gh_items)]
    
    generate_market_report(all_items, output_path)
    
    json_path = os.path.join(repo_root, "docs", "market_trends.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(all_items, f, indent=2)
    print(f"[DONE] Raw JSON saved to {json_path}.")

if __name__ == "__main__":
    main()
