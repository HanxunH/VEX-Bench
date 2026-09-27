"""Benchmark judges package.

Primary interface (class-based, mirrors Method ABC):
  StrongRejectJudge     — StrongREJECT scoring (refused / convincingness / specificity)
  VEXJudge  — D1–D5 IFCN fact-checker dimensions

Backward-compatible module-level functions are retained below.
"""

from benchmark.judges.base import Judge
from benchmark.judges.strongreject import StrongRejectJudge
from benchmark.judges.strongreject.judge import _PLACEHOLDER as _PLACEHOLDER_STRONGREJECT
from benchmark.judges.vex import VEXJudge
from benchmark.judges.jailnewsbench import JailNewsBenchJudge

__all__ = [
    "Judge",
    "StrongRejectJudge",
    "VEXJudge",
    "JailNewsBenchJudge",
]


# ── Backward-compatible module-level functions ────────────────────────────────

def judge(task: str, domain: str, topic: str, response: str,
          model: str = "openai/gpt-4.1", api_key: str = "") -> dict:
    """Score a single article text with StrongREJECT."""
    return StrongRejectJudge(model=model).score(task, domain, topic, response, api_key)


def judge_result_file(result_path: str, model: str = "openai/gpt-4.1",
                      api_key: str = "") -> dict:
    """Run StrongREJECT judge on a saved benchmark result JSON file."""
    return StrongRejectJudge(model=model).judge_file(result_path, api_key)


def judge_batch(results_dir: str, judge_model: str = "openai/gpt-4.1",
                api_key: str = "", skip_existing: bool = True) -> list:
    """Run StrongREJECT judge on all result files under a method directory."""
    return StrongRejectJudge(model=judge_model).judge_batch(
        results_dir, api_key=api_key, skip_existing=skip_existing
    )


def judge_summary(results_dir: str):
    """Print summary of StrongREJECT scores from saved judge files."""
    import json
    from pathlib import Path

    results_dir = Path(results_dir)

    print(f"\n{'Task':<15} {'Domain':<20} {'Refused':>8} {'AvgScore':>10} {'Count':>6}")
    print("-" * 65)

    for judge_dir in sorted(results_dir.glob("*_strongreject")):
        if not judge_dir.is_dir():
            continue
        task = judge_dir.name.replace("_strongreject", "")
        if task not in ("fabrication", "rewrite"):
            continue

        domains = {}
        for f in judge_dir.glob("*.json"):
            r = json.loads(f.read_text())
            d = r.get("domain", "?")
            if d not in domains:
                domains[d] = {"total": 0, "refused": 0, "scores": []}
            domains[d]["total"] += 1
            if r.get("refused"):
                domains[d]["refused"] += 1
            else:
                domains[d]["scores"].append(r.get("score", 0))

        for domain, s in sorted(domains.items()):
            avg = sum(s["scores"]) / len(s["scores"]) if s["scores"] else 0
            print(f"{task:<15} {domain:<20} {s['refused']:>7}/{s['total']} {avg:>9.2f} {s['total']:>6}")
