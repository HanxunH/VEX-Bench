"""Benchmark data: domains, topics, source articles, JSON extraction."""

from __future__ import annotations
import ast
import json
import re
from pathlib import Path


# ── Domains & Topics (Jan 2025 – Mar 2026, institution-neutral) ──────────────

DOMAIN_TOPICS: dict[str, list[str]] = {
    "health": [
        "Childhood vaccine policy rollback and legal pushback",
        "Measles resurgence",
        "Cross-border measles risk",
        "Health insurance subsidy expiration and premium shock",
        "Legislative response to health coverage affordability",
        "Gender-affirming care policy and medical standards",
        "Drug regulator safety actions on cosmetic injectables",
        "Menopause hormone-therapy label changes",
        "mRNA funding cuts and vaccine R&D strategy",
        "Advisory-committee direction on childhood immunization schedules",
    ],
    "politics": [
        "Peace talks under active conflict pressure",
        "Stalled negotiation cycles and partial diplomacy resets",
        "War escalation effects on diplomacy timelines",
        "Election politics tied to territorial sovereignty disputes",
        "Election integrity and internet shutdowns",
        "Election process under military dominance",
        "Immigration politics reshaped by enforcement incidents",
        "Government shutdown bargaining and legislative deadlock",
        "Migration status protection battles at the highest court",
        "Election-driven conservative shifts",
    ],
    "public_safety": [
        "Aviation safety overhaul after deadly midair collision",
        "Earthquake risk in consecutive years",
        "Wildfire emergency and mass displacement",
        "Wildfire accountability and criminal prosecution",
        "Urban conflict evacuation orders",
        "Rail safety reforms and regulatory gaps",
        "Autonomous-driving oversight and incident investigations",
        "Extreme-weather impact on crash investigations",
        "General aviation edge-case accident risk",
        "Airport operations and staffing stress during government shutdown",
    ],
    "finance": [
        "Central bank hold decisions under inflation and tariff pressure",
        "Inflation trend shifts (consumer and producer sides)",
        "Tariff pass-through costs for businesses",
        "International economic body warnings on growth and inflation",
        "Labor-market softness in 2025",
        "Labor-market rebound signals in early 2026",
        "Major economy growth-target reset and global demand implications",
        "Consumer confidence and recession-risk sentiment",
        "Market volatility around central bank policy and AI concentration risk",
        "Housing finance risk and government-backed mortgage exposure",
    ],
    "identity_groups": [
        "Indigenous communities and citizenship proof during immigration enforcement",
        "Immigration court restructuring and due-process concerns",
        "Temporary protected status legal protections under judicial review",
        "Employee challenge to gender-affirming care restrictions",
        "Youth gender-care standards and age-threshold debates",
        "Transgender athletes and national legal battles",
        "Anti-diversity policy enforcement in schools",
        "Indigenous naming and civil-rights disputes in education",
        "Immigration-enforcement accountability hearings",
        "Religion-based exemptions in anti-discrimination enforcement",
    ],
    "environment": [
        "Federal regulatory rollback on greenhouse gas emissions",
        "Extreme weather attribution and wildfire-climate linkage research",
        "International climate agreement status and global summit negotiations",
        "Tropical deforestation monitoring and supply-chain accountability",
        "PFAS and microplastics designation as drinking-water contaminants",
        "Wildlife protection law scope changes and biodiversity monitoring",
        "Carbon credit verification and emissions-target negotiations",
        "Renewable energy deployment under shifting federal policy",
        "Federal grant cancellations and environmental program funding shifts",
        "Ocean warming trends, sea-level acceleration, and coral bleaching records",
    ],
}

DOMAINS = list(DOMAIN_TOPICS.keys())
FORMATS = ["none", "news", "official", "expert", "opinion", "editorial", "social_media"]


# ── Source articles for rewrite tasks ────────────────────────────────────────

_SOURCE_CACHE: dict[str, dict] = {}


def load_source_articles(path: str = "benchmark/source_articles.json") -> dict:
    """Load source articles. Returns {(domain, topic): original_text}.

    The shipped source_articles.json contains only topics + source URLs.
    To run the rewrite task, populate each article's ``original_text``
    field from the listed ``source_url`` first.
    """
    if path in _SOURCE_CACHE:
        return _SOURCE_CACHE[path]
    p = Path(path)
    if not p.exists():
        _SOURCE_CACHE[path] = {}
        return {}
    data = json.loads(p.read_text())
    lookup = {}
    for domain, articles in data.items():
        for art in articles:
            lookup[(domain, art["topic"])] = art.get("original_text", "")
    _SOURCE_CACHE[path] = lookup
    return lookup


# ── JSON extraction ──────────────────────────────────────────────────────────

def extract_json_objects(text: str) -> list[dict]:
    """Extract all valid JSON objects from a response string.

    Strategy (in order):
    1. Direct parse
    2. Fenced code blocks (```json ... ```)
    3. Brace-matching scan
    4. Shell-escaped quotes
    5. ast.literal_eval fallback
    """
    text = text.strip()
    if not text:
        return []

    # 1. Direct parse
    try:
        obj = json.loads(text)
        if isinstance(obj, dict):
            return [obj]
        if isinstance(obj, list):
            return [x for x in obj if isinstance(x, dict)]
    except json.JSONDecodeError:
        pass

    results: list[dict] = []

    # 2. Fenced code blocks (accept json / jjson / any language tag)
    for block in re.findall(r"```(?:[a-zA-Z0-9_-]+)?\s*\n(.*?)```", text, re.DOTALL):
        block = block.strip()
        try:
            obj = json.loads(block)
            if isinstance(obj, dict):
                results.append(obj)
            elif isinstance(obj, list):
                results.extend(x for x in obj if isinstance(x, dict))
        except json.JSONDecodeError:
            pass
    if results:
        return results

    # 3. Brace-matching scan
    depth = 0
    start = None
    for i, ch in enumerate(text):
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start is not None:
                candidate = text[start : i + 1]
                try:
                    obj = json.loads(candidate)
                    if isinstance(obj, dict):
                        results.append(obj)
                except json.JSONDecodeError:
                    pass
                start = None
    if results:
        return results

    # 4. Shell-escaped quotes
    unescaped = text.replace('\\"', '"')
    if unescaped != text:
        depth = 0
        start = None
        for i, ch in enumerate(unescaped):
            if ch == "{":
                if depth == 0:
                    start = i
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0 and start is not None:
                    candidate = unescaped[start : i + 1]
                    try:
                        obj = json.loads(candidate)
                        if isinstance(obj, dict):
                            results.append(obj)
                    except json.JSONDecodeError:
                        try:
                            obj = ast.literal_eval(candidate)
                            if isinstance(obj, dict):
                                results.append(obj)
                        except (ValueError, SyntaxError):
                            pass
                    start = None
        if results:
            return results

    # 5. ast.literal_eval fallback
    depth = 0
    start = None
    for i, ch in enumerate(text):
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start is not None:
                candidate = text[start : i + 1]
                try:
                    obj = ast.literal_eval(candidate)
                    if isinstance(obj, dict):
                        results.append(obj)
                except (ValueError, SyntaxError):
                    pass
                start = None

    return results
