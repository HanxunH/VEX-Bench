"""Run one or more benchmark judges on result files.

Usage:
    # Run all 3 judges on a single method directory
    python -m benchmark.run_judges \\
        --results-dir results/benchmark/anthropic__claude-sonnet-4/isc \\
        --judges all

    # Recursive: auto-discover all method dirs under a parent
    python -m benchmark.run_judges \\
        --results-dir results/benchmark \\
        --recursive --judges vex --vex-suffix _vex_gpt52

    # Per-judge model override
    python -m benchmark.run_judges \\
        --results-dir results/benchmark/... \\
        --judges vex,jnb \\
        --vex-model anthropic/claude-opus-4-7 \\
        --jnb-model openai/gpt-4.1

The VEX judge auto-picks the matching prompt file based on model
(via benchmark.judges.vex.vex_evaluator._prompt_path_for).
"""

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env", override=True)

from benchmark.judges.base import Judge
from benchmark.judges.vex.judge import VEXJudge
from benchmark.judges.jailnewsbench.judge import JailNewsBenchJudge
from benchmark.judges.strongreject.judge import StrongRejectJudge


JUDGES = {
    "vex": ("VEX", VEXJudge),
    "jnb": ("JailNewsBench", JailNewsBenchJudge),
    "sr": ("StrongREJECT", StrongRejectJudge),
}


def _resolve_judges(spec: str) -> list:
    if spec == "all":
        return list(JUDGES.keys())
    keys = [s.strip() for s in spec.split(",") if s.strip()]
    unknown = [k for k in keys if k not in JUDGES]
    if unknown:
        sys.exit(f"[error] Unknown judge(s): {unknown}. Available: {list(JUDGES.keys())}")
    return keys


def _model_for(judge_key: str, args) -> str:
    override = getattr(args, f"{judge_key}_model", None)
    return override or args.model


def _suffix_for(judge_key: str, args):
    return getattr(args, f"{judge_key}_suffix", None)


def _build_judge(key: str, model: str, suffix):
    _, cls = JUDGES[key]
    if key == "vex" and suffix:
        return cls(model=model, suffix=suffix)
    return cls(model=model)


def _discover_method_dirs(parent: Path) -> list:
    """Return all sub-directories under parent (2 levels deep) that contain
    a fabrication/ or rewrite/ sub-folder."""
    method_dirs = []
    for model_dir in sorted(parent.iterdir()):
        if not model_dir.is_dir():
            continue
        for method_dir in sorted(model_dir.iterdir()):
            if not method_dir.is_dir():
                continue
            if any((method_dir / t).is_dir() for t in Judge.VALID_TASKS):
                method_dirs.append(method_dir)
    return method_dirs


def main():
    parser = argparse.ArgumentParser(
        description="Run benchmark judges on result JSONs.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--results-dir", required=True,
                        help="Method directory (or parent if --recursive)")
    parser.add_argument("--recursive", action="store_true",
                        help="Treat --results-dir as parent; auto-discover method dirs 2 levels deep")
    parser.add_argument("--judges", default="all",
                        help="Comma-separated judge keys: vex,jnb,sr (or 'all'). Default: all")
    parser.add_argument("--model", default="openai/gpt-5.2",
                        help="Default judge model (default: openai/gpt-5.2)")
    parser.add_argument("--vex-model", default=None,
                        help="Override model for vex judge")
    parser.add_argument("--jnb-model", default=None,
                        help="Override model for jailnewsbench judge")
    parser.add_argument("--sr-model", default=None,
                        help="Override model for strongreject judge")
    parser.add_argument("--vex-suffix", default=None,
                        help="Override VEX output folder suffix (default: _vex)")
    parser.add_argument("--skip-existing", action="store_true", default=True,
                        help="Skip already-scored files (default: True)")
    parser.add_argument("--no-skip", dest="skip_existing", action="store_false",
                        help="Re-score even if judge output exists")
    parser.add_argument("--api-key", default=None,
                        help="OpenRouter API key (default: $OPENROUTER_API_KEY)")
    args = parser.parse_args()

    api_key = args.api_key or os.getenv("OPENROUTER_API_KEY", "")
    if not api_key:
        sys.exit("[error] OPENROUTER_API_KEY not set (use --api-key or .env)")

    results_dir = Path(args.results_dir)
    if not results_dir.exists():
        sys.exit(f"[error] results-dir not found: {results_dir}")

    if args.recursive:
        method_dirs = _discover_method_dirs(results_dir)
        if not method_dirs:
            sys.exit(f"[error] no method dirs found under {results_dir}")
    else:
        method_dirs = [results_dir]

    keys = _resolve_judges(args.judges)
    print(f"[run_judges] parent: {results_dir}")
    print(f"[run_judges] {'recursive:' if args.recursive else 'single:'} {len(method_dirs)} method dir(s)")
    print(f"[run_judges] judges: {', '.join(keys)}")

    for k in keys:
        name, _ = JUDGES[k]
        model = _model_for(k, args)
        suffix = _suffix_for(k, args)
        suffix_note = f" suffix={suffix}" if suffix else ""
        print(f"\n===== {name} (model={model}{suffix_note}) =====")
        judge = _build_judge(k, model, suffix)

        total = 0
        for md in method_dirs:
            print(f"\n--- {md} ---")
            records = judge.judge_batch(
                str(md),
                api_key=api_key,
                skip_existing=args.skip_existing,
            )
            total += len(records)
        print(f"\n[{name}] processed {total} files across {len(method_dirs)} dir(s)")


if __name__ == "__main__":
    main()
