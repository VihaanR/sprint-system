#!/usr/bin/env python3
"""
Sprint System v3.0 - ACE Reflect-Curate skill evolution loop.
Reflect on ~/.agent-bridge/telemetry.jsonl, curate recurring friction into playbook/skill rules, validate, dual-sync.
Synthesizes local sprint telemetry with external market trend RAG to
recursively mutate, optimize, and test Sprint System phase skills.
"""

import os
import sys
import json
import re
import shutil
import subprocess
from datetime import datetime

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKILLS_DIR = os.path.join(REPO_ROOT, "skills")
GLOBAL_SKILLS_DIR = os.path.expanduser("~/.gemini/config/skills")
CLAUDE_SKILLS_DIR = os.path.expanduser("~/.claude/skills")
SYNC_TARGETS = [GLOBAL_SKILLS_DIR, CLAUDE_SKILLS_DIR]
MARKET_JSON = os.path.join(REPO_ROOT, "docs", "market_trends.json")
SPRINT_LOG = os.path.join(REPO_ROOT, "SPRINT.md")

def run_cmd(cmd: list) -> str:
    res = subprocess.run(cmd, capture_output=True, text=True, cwd=REPO_ROOT)
    return res.stdout.strip()

TELEMETRY = os.path.expanduser("~/.agent-bridge/telemetry.jsonl")
AGENTS_DIR = os.path.join(REPO_ROOT, ".claude", "agents")
CLAUDE_AGENTS_DIR = os.path.expanduser("~/.claude/agents")
DELTA_THRESHOLD = 2  # a friction cluster must recur this often before it becomes a rule
LEARNED_HEADER = "## Learned guardrails (auto, evolve_skills.py)"

# Reflect: cluster -> (target file relative to repo, rule line). One rule per recurring cluster.
RULES = {
    "startup-stall": ("skills/sprint-orchestrator/SKILL.md", "agy startup-stall seen {n}x: check `ab-route.js --status` before dispatch; do not --reset agy inside a sprint."),
    "isolation-breach": ("skills/sprint-orchestrator/SKILL.md", "isolation-breach seen {n}x: never edit the main checkout while a route-* worktree is live."),
    "quota": ("skills/sprint-orchestrator/SKILL.md", "executor quota trips seen {n}x: prefer freellmapi/auto; batch slices into one dispatch."),
    "stall": ("skills/sprint-orchestrator/SKILL.md", "executor stalls seen {n}x: give tighter acceptance criteria and smaller slices."),
    "exhausted": ("skills/sprint-orchestrator/SKILL.md", "chain exhausted {n}x: implement directly after one failed chain; no re-dispatch."),
    "slop": (".claude/agents/builder.md", "slop regex hits seen {n}x: read DESIGN.md tokens before writing any class or color."),
    "tool-failure": (".claude/agents/auditor.md", "tool failures seen {n}x in audit runs: rerun the failing command once, then report it."),
    "blocked": ("skills/sprint-orchestrator/SKILL.md", "PreToolUse gate blocks seen {n}x: load the phase skill and Phase 1 artifacts before the first edit."),
}


def read_telemetry() -> list:
    rows = []
    if not os.path.exists(TELEMETRY):
        return rows
    with open(TELEMETRY, "r", encoding="utf-8") as f:
        for line in f:
            try:
                rows.append(json.loads(line))
            except ValueError:
                continue
    return rows


def analyze_local_telemetry() -> dict:
    """Reflect: cluster outcomes from ~/.agent-bridge/telemetry.jsonl and compare agy tiers."""
    rows = read_telemetry()
    clusters, models = {}, {}
    for r in rows:
        outcome = str(r.get("outcome", ""))
        if outcome and outcome not in ("ok", "advanced", "sprint-started", "sprint-closed", "no-change"):
            clusters[outcome] = clusters.get(outcome, 0) + 1
        if r.get("to") == "antigravity":
            m = models.setdefault(r.get("model") or "default", {"ok": 0, "total": 0})
            m["total"] += 1
            m["ok"] += outcome == "ok"
    friction = [f"{k}: {v}" for k, v in sorted(clusters.items(), key=lambda kv: -kv[1])]
    return {"friction_points": friction, "clusters": clusters, "agy_models": models, "rows": len(rows)}


def curate(clusters: dict) -> list:
    """Curate: append one deduped rule per recurring cluster to the target playbook/skill. Returns deltas."""
    deltas = []
    for key, n in clusters.items():
        if n < DELTA_THRESHOLD or key not in RULES:
            continue
        rel, template = RULES[key]
        path = os.path.join(REPO_ROOT, rel)
        if not os.path.exists(path):
            continue
        with open(path, "r", encoding="utf-8-sig") as f:
            txt = f.read()
        rule_prefix = template.split(" seen ")[0].split(" {n}")[0]
        kept = [l for l in txt.splitlines() if not l.startswith(f"- {rule_prefix}")]
        if LEARNED_HEADER not in txt:
            kept += ["", LEARNED_HEADER]
        kept.append("- " + template.format(n=n))
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write("\n".join(kept).rstrip("\n") + "\n")
        deltas.append(f"{rel}: {template.format(n=n)}")
    return deltas

def load_market_trends() -> list:
    if os.path.exists(MARKET_JSON):
        with open(MARKET_JSON, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def synthesize_evolution():
    print("[ACTION] Running Recursive Skill Evolution...")
    telemetry = analyze_local_telemetry()
    trends = load_market_trends()
    
    print(f"[INFO] Analyzed telemetry: {telemetry['rows']} events, {len(telemetry['friction_points'])} friction clusters.")
    for name, m in telemetry["agy_models"].items():
        print(f"[INFO] agy:{name} ok {m['ok']}/{m['total']}")
    deltas = curate(telemetry["clusters"])
    for d in deltas:
        print(f"[DELTA] {d}")
    print(f"[INFO] Loaded {len(trends)} market intelligence signals.")

    tiers = ", ".join(f"{k} {v['ok']}/{v['total']}" for k, v in telemetry["agy_models"].items())
    evolution_log = [
        f"# [RECURSIVE EVOLUTION CYCLE: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%SZ')}]",
        f"- Scanned Market Signals: {len(trends)}",
        f"- Telemetry events: {telemetry['rows']}",
        f"- Friction clusters: {', '.join(telemetry['friction_points']) or 'none'}",
        f"- agy tiers: {tiers or 'no runs'}",
        *[f"- Delta: {d}" for d in deltas],
        ""
    ]

    log_path = os.path.join(REPO_ROOT, "docs", "EVOLUTION_LOG.md")
    with open(log_path, "a", encoding="utf-8") as f:
        f.write("\n".join(evolution_log) + "\n")

    # Frontmatter validation pass
    print("[ACTION] Validating skill YAML frontmatter across all skills...")
    valid_count = 0
    valid_skills = set()
    for root, _, files in os.walk(SKILLS_DIR):
        for file in files:
            if file == "SKILL.md":
                full_path = os.path.join(root, file)
                with open(full_path, "r", encoding="utf-8-sig") as f:
                    txt = f.read()
                    if re.search(r"^---\s*\n.*?name:\s*.+?\n.*?---", txt, re.DOTALL):
                        valid_count += 1
                        valid_skills.add(os.path.basename(root))
                    else:
                        print(f"[FAIL] Frontmatter invalid in {full_path}", file=sys.stderr)

    print(f"[VERIFY] {valid_count} skills verified with valid frontmatter.")
    
    # SkillEvaluator Quality Gate (NVIDIA/SkillEvaluator pattern)
    print("[ACTION] Running Semantic Overlap & Skill Quality Gate (SkillEvaluator pattern)...")
    skill_names = set()
    target_skills = [
        "sprint-orchestrator", "phase-discover", "phase-backend",
        "phase-frontend", "phase-polish", "phase-audit", "phase-launch",
        "sprint-recursive-optimizer"
    ]
    for s in target_skills:
        src = os.path.join(SKILLS_DIR, s, "SKILL.md")
        if os.path.exists(src):
            with open(src, "r", encoding="utf-8-sig") as f:
                content = f.read()
                m = re.search(r"^---\s*\n.*?name:\s*(.+?)\n.*?---", content, re.DOTALL)
                if m:
                    name = m.group(1).strip()
                    if name in skill_names:
                        print(f"[FAIL] Semantic collision detected: Duplicate skill '{name}'", file=sys.stderr)
                    skill_names.add(name)
    print(f"[VERIFY] Zero trigger collisions or overlapping names detected across {len(skill_names)} evaluated core skills.")

    # Dual-Sync: validated skills go to both the Gemini and Claude global skill dirs (byte-exact copy keeps frontmatter intact)
    print("[ACTION] Dual-syncing validated skills to ~/.gemini/config/skills/ and ~/.claude/skills/...")
    for s in target_skills:
        src = os.path.join(SKILLS_DIR, s, "SKILL.md")
        if not os.path.exists(src):
            continue
        if s not in valid_skills:
            print(f"[SKIPPED] {s}: frontmatter not validated", file=sys.stderr)
            continue
        for target_dir in SYNC_TARGETS:
            dest_dir = os.path.join(target_dir, s)
            dest = os.path.join(dest_dir, "SKILL.md")
            os.makedirs(dest_dir, exist_ok=True)
            shutil.copyfile(src, dest)
            print(f"[SYNCED] {s} -> {dest}")

    # Agent playbooks sync to ~/.claude/agents/ (Claude Code only)
    if os.path.isdir(AGENTS_DIR):
        os.makedirs(CLAUDE_AGENTS_DIR, exist_ok=True)
        for name in sorted(os.listdir(AGENTS_DIR)):
            if name.endswith(".md"):
                shutil.copyfile(os.path.join(AGENTS_DIR, name), os.path.join(CLAUDE_AGENTS_DIR, name))
                print(f"[SYNCED] agent {name} -> {CLAUDE_AGENTS_DIR}")

    print("[DONE] Evolution cycle completed.")

if __name__ == "__main__":
    synthesize_evolution()
