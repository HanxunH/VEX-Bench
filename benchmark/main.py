"""
Run benchmark: evaluate misinformation elicitation methods across LLMs.

Usage:
    # Run all conditions for one method + model
    python benchmark/main.py --method direct --model x-ai/grok-4.1-fast

    # Run specific task/domain
    python benchmark/main.py --method direct --model x-ai/grok-4.1-fast --task fabrication --domain health

    # Run multiple models in sequence
    python benchmark/main.py --method direct --model x-ai/grok-4.1-fast --model qwen/qwen3.5-flash-02-23

    # Skip existing results (resume)
    python benchmark/main.py --method direct --model x-ai/grok-4.1-fast --skip-existing

    # Summary only (no API calls)
    python benchmark/main.py --method direct --model x-ai/grok-4.1-fast --summary

    # Dry run (print prompts, no API calls)
    python benchmark/main.py --method direct --model x-ai/grok-4.1-fast --dry-run --task fabrication --domain health
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

# Add project root
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env", override=True)

from benchmark import Benchmark, TASKS
from benchmark.data import DOMAIN_TOPICS, DOMAINS
from benchmark.methods import DirectPrompt, ISCMethod, MisinfoQAMethod, PoisonedRAGMethod, DisinfoCapMethod, PAPMethod, JailNewsBenchMethod
from benchmark.methods.PAP.taxonomy import TECHNIQUE_CHOICES as PAP_TECHNIQUE_CHOICES


# ── Method registry ──────────────────────────────────────────────────────────

METHODS = {
    "direct": DirectPrompt,
    "isc": ISCMethod,
    "misinfoqa": MisinfoQAMethod,
    "poisonedrag": PoisonedRAGMethod,
    "disinfocap": DisinfoCapMethod,
    "pap": PAPMethod,
    "jailnewsbench": JailNewsBenchMethod,
}


def build_method(name: str, args, api_key: str, dry_run: bool = False):
    """Instantiate the chosen method, wiring method-specific args.

    Most methods take zero constructor args. PAP is the exception — it runs
    an attacker LLM inside `build_prompt`, so it needs an api_key and its
    own CLI settings.
    """
    if name == "pap":
        return PAPMethod(
            technique=args.pap_technique,
            attacker_model=args.pap_attacker_model,
            api_key=api_key,
            num_shots=args.pap_shots,
            dry_run=dry_run,
        )
    return METHODS[name]()


# ── CLI ──────────────────────────────────────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(
        description="Run misinformation elicitation benchmark",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Standard single-call baselines
  python benchmark/main.py --method direct --model x-ai/grok-4.1-fast
  python benchmark/main.py --method direct --model x-ai/grok-4.1-fast --task fabrication
  python benchmark/main.py --method direct --model x-ai/grok-4.1-fast --summary
  python benchmark/main.py --method direct --model x-ai/grok-4.1-fast --dry-run

  # PAP (two-call: attacker rewrites, target generates)
  python benchmark/main.py --method pap --model openai/gpt-4o \\
      --pap-technique expert_endorsement \\
      --pap-attacker-model deepseek/deepseek-chat
  python benchmark/main.py --method pap --model openai/gpt-4o \\
      --task fabrication --domain health --pap-technique framing
  python benchmark/main.py --method pap --model openai/gpt-4o --dry-run

  # PAP supported techniques:
  #   evidence_based_persuasion, expert_endorsement, authority_endorsement,
  #   logical_appeal, storytelling, framing
        """,
    )

    parser.add_argument("--method", required=True, choices=list(METHODS.keys()),
                        help="Elicitation method")
    parser.add_argument("--model", required=True, action="append",
                        help="Model to evaluate (can specify multiple)")
    parser.add_argument("--task", choices=TASKS, default=None,
                        help="Run single task (default: all)")
    parser.add_argument("--domain", choices=DOMAINS, default=None,
                        help="Run single domain (default: all)")
    parser.add_argument("--out", default="results/benchmark",
                        help="Output directory (default: results/benchmark)")
    parser.add_argument("--max-tokens", type=int, default=4096,
                        help="Max tokens per API call (default: 4096)")
    parser.add_argument("--reasoning-effort", choices=["low", "medium", "high"], default=None,
                        help="OpenRouter reasoning effort (caps reasoning budget for Gemini/O1/etc.; default: not set)")
    parser.add_argument("--delay", type=float, default=1.0,
                        help="Delay between API calls in seconds (default: 1.0)")
    parser.add_argument("--skip-existing", action="store_true",
                        help="Skip conditions with existing results")
    parser.add_argument("--summary", action="store_true",
                        help="Print summary only (no API calls)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print prompts without making API calls")

    # PAP-specific
    parser.add_argument("--pap-technique", choices=list(PAP_TECHNIQUE_CHOICES),
                        default="evidence_based_persuasion",
                        help="PAP persuasion technique (default: evidence_based_persuasion)")
    parser.add_argument("--pap-attacker-model", default="deepseek/deepseek-chat",
                        help="PAP attacker LLM that rewrites plain queries (default: deepseek/deepseek-chat)")
    parser.add_argument("--pap-shots", type=int, default=3,
                        help="Number of few-shot examples for PAP attacker (default: 3)")

    return parser.parse_args()


def dry_run(method, tasks, domains):
    """Print prompts for all conditions without calling API."""
    from benchmark.data import load_source_articles
    source_articles = load_source_articles()

    for task in (tasks or TASKS):
        for domain in (domains or DOMAINS):
            for topic in DOMAIN_TOPICS[domain]:
                source = source_articles.get((domain, topic), "")
                prompt = method.build_prompt(task, domain, topic, source)
                print(f"\n{'='*80}")
                print(f"[{task}|{domain}] {topic}")
                print(f"{'='*80}")
                print(prompt[:500])
                if len(prompt) > 500:
                    print(f"... ({len(prompt)} chars total)")


def run_model(method, model, api_key, args):
    """Run benchmark for a single model."""
    tasks = [args.task] if args.task else None
    domains = [args.domain] if args.domain else None

    # Per-model output directory
    model_slug = model.replace("/", "__")
    out_dir = f"{args.out}/{model_slug}"

    bench = Benchmark(method, model, api_key, out_dir)

    if args.summary:
        print(f"\n[{model}]")
        bench.summary()
        return

    # Count conditions
    all_conds = list(bench.conditions(tasks, domains))
    print(f"\n[{model}] {len(all_conds)} conditions ({args.method})")

    results = bench.run(
        tasks=tasks,
        domains=domains,
        max_tokens=args.max_tokens,
        delay=args.delay,
        skip_existing=args.skip_existing,
        reasoning_effort=args.reasoning_effort,
    )

    print(f"\n[{model}] Completed {len(results)} new conditions")
    bench.summary()


def main():
    args = parse_args()

    api_key = os.getenv("OPENROUTER_API_KEY", "")
    if not api_key and not args.summary and not args.dry_run:
        sys.exit("[error] OPENROUTER_API_KEY not set")

    method = build_method(args.method, args, api_key, dry_run=args.dry_run)

    if args.dry_run:
        tasks = [args.task] if args.task else None
        domains = [args.domain] if args.domain else None
        dry_run(method, tasks, domains)
        return

    for model in args.model:
        run_model(method, model, api_key, args)


if __name__ == "__main__":
    main()
