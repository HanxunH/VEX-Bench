"""
run_openrouter.py — Query OpenRouter with VEX-Bench task prompts.

Usage examples
--------------
# Single task, single model, default render (health domain, all attrs on)
python run_openrouter.py \
    --task false_evidence_construction \
    --model meta-llama/llama-4-maverick \
    --out results/

# Specific domain + attribute profile
python run_openrouter.py \
    --task misleading_rewrite \
    --model openai/gpt-4o \
    --domain finance \
    --authority-format expert \
    --emotional-appeal outrage \
    --out results/

# Sweep all 5 domains for one task across multiple models
python run_openrouter.py \
    --task authority_style_packaging \
    --model openai/gpt-4o anthropic/claude-sonnet-4-5 google/gemini-2.0-flash-001 \
    --sweep-domains \
    --out results/

# Run all 4 tasks, all 5 domains, one model
python run_openrouter.py \
    --task all \
    --model openai/gpt-4o \
    --sweep-domains \
    --out results/

Environment
-----------
  OPENROUTER_API_KEY   required
  OPENROUTER_BASE_URL  optional (default: https://openrouter.ai/api/v1)
"""

from __future__ import annotations

import argparse
import importlib
import json
import os
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

# ── Constants ─────────────────────────────────────────────────────────────────

TASKS = [
    "false_evidence_construction",
    "misleading_rewrite",
    "authority_style_packaging",
    "persuasion_campaign_assistance",
    "fabrication",
    "fabrication_a",
    "fabrication_b",
    "fabrication_c",
    "fabrication_d",
    "rewrite",
    "rewrite_a",
    "rewrite_b",
    "rewrite_c",
    "rewrite_d",
    "extraction",
]

VALID_DOMAINS           = ["health", "politics", "public_safety", "finance", "identity_groups", "environment"]
VALID_AUTHORITY_FORMATS = ["none", "news", "official", "expert"]
VALID_EMOTIONAL_APPEALS = ["none", "fear", "outrage"]

OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

# ── OpenRouter client ──────────────────────────────────────────────────────────

def query_openrouter(
    prompt: str,
    model: str,
    api_key: str,
    temperature: float = 0.7,
    max_tokens: int = 4096,
    retries: int = 5,
    retry_delay: float = 5.0,
    reasoning_effort: str | None = None,
) -> dict:
    """Send a chat completion request to OpenRouter. Returns the full API response."""
    url = f"{OPENROUTER_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if reasoning_effort:
        payload["reasoning"] = {"effort": reasoning_effort}

    for attempt in range(1, retries + 1):
        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=120)
            resp.raise_for_status()
            return resp.json()
        except requests.HTTPError as e:
            status = e.response.status_code if e.response is not None else "?"
            if status == 429 or (isinstance(status, int) and status >= 500):
                if attempt < retries:
                    # Qwen via Alibaba is extra sensitive to bursty request ramps.
                    # Use slower backoff for qwen/* models.
                    qwen_multiplier = 2.5 if str(model).startswith("qwen/") else 1.0
                    wait = retry_delay * attempt * qwen_multiplier
                    print(f"  [warn] HTTP {status} — retrying in {wait:.1f}s (attempt {attempt}/{retries})")
                    time.sleep(wait)
                    continue
            raise
        except requests.RequestException as e:
            if attempt < retries:
                print(f"  [warn] Request error: {e} — retrying in {retry_delay}s")
                time.sleep(retry_delay)
                continue
            raise

    raise RuntimeError(f"Failed after {retries} attempts")


def extract_response_text(api_response: dict) -> str:
    """Extract the assistant message text from an OpenRouter response.

    Returns `content` only. Never falls back to `reasoning` — for reasoning
    models, the reasoning field contains internal planning text (not the
    intended answer), so surfacing it as content would pollute downstream
    JSON extraction with thought fragments.
    """
    try:
        msg = api_response["choices"][0]["message"]
        return msg.get("content") or ""
    except (KeyError, IndexError):
        return ""



# ── Task loader ───────────────────────────────────────────────────────────────

def load_task_module(task_name: str):
    """Import a task module from tasks/{task_name}/task_input.py."""
    tasks_dir = Path(__file__).parent / "tasks"
    sys.path.insert(0, str(tasks_dir.parent))
    try:
        module = importlib.import_module(f"tasks.{task_name}.task_input")
    except ModuleNotFoundError as e:
        raise SystemExit(f"[error] Cannot import task '{task_name}': {e}")
    return module



# ── Result I/O ────────────────────────────────────────────────────────────────

def _topic_slug(topic: str, domain: str) -> str:
    """Return a short deterministic slug for a topic (t00–t09 if in pool, else truncated words)."""
    from benchmark.data import DOMAIN_TOPICS
    pool = DOMAIN_TOPICS.get(domain, [])
    try:
        return f"t{pool.index(topic):02d}"
    except ValueError:
        slug = "_".join(topic.lower().split()[:3])[:20]
        return f"t_{slug}"


def result_path(out_dir: Path, task: str, model: str, domain: str, attrs: dict) -> Path:
    """Deterministic output file path for a (task, model, domain, attrs) tuple."""
    model_slug = model.replace("/", "__")
    if attrs.get("free_attrs"):
        attr_slug = "free"
    else:
        attr_slug  = (
            f"q{int(attrs['quote'])}"
            f"n{int(attrs['numeric_claim'])}"
            f"af{attrs['authority_format'][0]}"
            f"ea{attrs['emotional_appeal'][0]}"
            f"cta{int(attrs['call_to_action'])}"
            f"ma{int(attrs['multi_asset'])}"
        )
    topic = attrs.get("topic")
    fmt   = attrs.get("format")
    fmt_slug = f"__{fmt}" if fmt else ""
    tag   = f"__{attrs['tag']}" if attrs.get("tag") else ""
    if attrs.get("batch_topics"):
        fname = f"{task}__{domain}__tall{fmt_slug}__{attr_slug}__{model_slug}{tag}.json"
    elif topic:
        ts    = _topic_slug(topic, domain)
        fname = f"{task}__{domain}__{ts}{fmt_slug}__{attr_slug}__{model_slug}{tag}.json"
    else:
        fname = f"{task}__{domain}{fmt_slug}__{attr_slug}__{model_slug}{tag}.json"
    return out_dir / task / fname


def save_result(path: Path, record: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(record, indent=2, ensure_ascii=False))


def load_result(path: Path) -> dict | None:
    if path.exists():
        return json.loads(path.read_text())
    return None


def _pick_random_anchor(out_dir: Path, task: str, domain: str) -> dict | None:
    """Return a randomly chosen article data dict from existing results for (task, domain)."""
    candidates = []
    task_dir = out_dir / task
    if task_dir.exists():
        for f in task_dir.glob(f"{task}__{domain}__*.json"):
            try:
                rec = json.loads(f.read_text())
                arts = rec.get("article", [])
                if isinstance(arts, list):
                    for a in arts:
                        if isinstance(a, dict) and a.get("data") and "body" in a.get("data", {}):
                            candidates.append(a["data"])
            except Exception:
                continue
    if not candidates:
        print("  [anchor] No existing results found — using default anchor")
        return None
    chosen = random.choice(candidates)
    print(f"  [anchor] Using existing result as anchor: {chosen.get('topic','?')[:60]} [{chosen.get('authority_format','?')}]")
    return chosen


# ── Core run logic ────────────────────────────────────────────────────────────

def run_one(
    task: str,
    model: str,
    attrs: dict,
    out_dir: Path,
    api_key: str,
    temperature: float,
    max_tokens: int,
    skip_existing: bool,
    dry_run: bool,
) -> dict:
    domain = attrs["domain"]
    path   = result_path(out_dir, task, model, domain, attrs)

    if skip_existing and path.exists():
        print(f"  [skip] {path.name}")
        return load_result(path)

    mod    = load_task_module(task)
    prompt = mod.render(**attrs)

    if dry_run:
        print(f"  [dry-run] Would query {model} | task={task} domain={domain}")
        print(f"  Prompt preview: {prompt[:120].replace(chr(10),' ')}...")
        return {}

    print(f"  Querying {model} | task={task} domain={domain} attrs={_attr_summary(attrs)}")
    t0 = time.time()
    api_resp = query_openrouter(
        prompt=prompt,
        model=model,
        api_key=api_key,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    elapsed = time.time() - t0
    response_text = extract_response_text(api_resp)

    # Extract articles and stamp each with run-level attrs
    _fallback_query = mod.query(attrs)
    _meta = {
        "task":   task,
        "domain": domain,
        "model":  model,
        "attrs":  attrs,
    }
    raw_articles = mod.extract_article(response_text)
    if isinstance(raw_articles, list):
        # Cap extraction to expected article count
        if attrs.get("batch_topics"):
            from benchmark.data import DOMAIN_TOPICS
            expected = len(DOMAIN_TOPICS.get(domain, []))
        else:
            expected = attrs.get("num_articles", 2)
        raw_articles = raw_articles[:expected]

        articles = []
        for a in raw_articles:
            if isinstance(a, dict):
                # Use model-generated query if present, else fall back
                jq = a.get("data", {}).get("query") or _fallback_query
                articles.append({**a, **_meta, "query": jq})
            else:
                articles.append({"text": a, **_meta, "query": _fallback_query})
    else:
        articles = raw_articles  # fallback string

    record = {
        "task":    task,
        "domain":  domain,
        "model":   model,
        "attrs":   attrs,
        "tag":     attrs.get("tag", ""),
        "prompt":  prompt,
        "response":        response_text,
        "article":         articles,
        "usage":           api_resp.get("usage", {}),
        "elapsed_s":       round(elapsed, 2),
        "timestamp":       datetime.now(timezone.utc).isoformat(),
        "api_response":    api_resp,
    }

    save_result(path, record)
    tokens = api_resp.get("usage", {}).get("completion_tokens", "?")
    print(f"  [ok] {elapsed:.1f}s | {tokens} tokens → {path.name}")
    return record


def _attr_summary(attrs: dict) -> str:
    a = attrs
    return (
        f"q={a['quote']} n={a['numeric_claim']} "
        f"af={a['authority_format']} ea={a['emotional_appeal']} "
        f"cta={a['call_to_action']} ma={a['multi_asset']}"
    )


# ── CLI ───────────────────────────────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Run VEX-Bench tasks against OpenRouter models.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    # Task selection
    p.add_argument(
        "--task", nargs="+", required=True,
        help=f"Task name(s) or 'all'. Options: {', '.join(TASKS)}",
    )

    # Model selection
    p.add_argument(
        "--model", nargs="+", required=True,
        help="OpenRouter model ID(s), e.g. openai/gpt-4o anthropic/claude-sonnet-4-5",
    )

    # Domain
    p.add_argument(
        "--domain", default="health", choices=VALID_DOMAINS,
        help="Domain for the task prompt (default: health)",
    )
    p.add_argument(
        "--sweep-domains", action="store_true",
        help="Run all 5 domains instead of just --domain",
    )

    # Attribute flags
    p.add_argument("--no-quote",         dest="quote",         action="store_false", default=True)
    p.add_argument("--no-numeric-claim", dest="numeric_claim", action="store_false", default=True)
    p.add_argument(
        "--authority-format", default="official", choices=VALID_AUTHORITY_FORMATS,
        help="authority_format attribute (default: official)",
    )
    p.add_argument(
        "--emotional-appeal", default="fear", choices=VALID_EMOTIONAL_APPEALS,
        help="emotional_appeal attribute (default: fear)",
    )
    p.add_argument("--no-call-to-action", dest="call_to_action", action="store_false", default=True)
    p.add_argument("--no-multi-asset",    dest="multi_asset",    action="store_false", default=True)
    p.add_argument("--num-articles",      type=int, default=1,
                   help="Number of articles to generate per run (default: 2)")
    p.add_argument("--topic",             type=str, default=None,
                   help="Pin a single topic (must match a DOMAIN_TOPICS entry)")
    p.add_argument("--format",            type=str, default=None, dest="content_format",
                   help="Pin a single format (prefilled in placeholder)")
    p.add_argument("--sweep-topics",      action="store_true",
                   help="Iterate over all 10 DOMAIN_TOPICS per domain (adds topic dimension to run matrix)")
    p.add_argument("--sweep-formats",     type=str, nargs="+", default=None,
                   help="Iterate over specified formats (e.g. --sweep-formats news official expert)")
    p.add_argument("--batch-topics",      action="store_true",
                   help="Pack all 10 domain topics into a single API call (task must support batch_topics)")
    p.add_argument("--random-attrs",      action="store_true",
                   help="Randomize the 6 attributes independently for each call")
    p.add_argument("--anchor-from-results", action="store_true",
                   help="Replace the hardcoded anchor with a randomly chosen existing result article")
    p.add_argument("--zero-shot",          action="store_true",
                   help="Omit the anchor/reference example entirely (task must support zero_shot)")
    p.add_argument("--free-attrs",         action="store_true",
                   help="Set all 6 attributes to ??? — model chooses its own strategy")
    p.add_argument("--tag", type=str, default="",
                   help="Label appended to output filename and stored in result (e.g. 'zeroshot', 'v2')")

    # Generation
    p.add_argument("--temperature", type=float, default=0.7)
    p.add_argument("--max-tokens",  type=int,   default=16384)

    # Output / behaviour
    p.add_argument("--out",           default="results", help="Output directory (default: results/)")
    p.add_argument("--skip-existing", action="store_true", help="Skip runs where output file already exists")
    p.add_argument("--dry-run",       action="store_true", help="Print prompts without calling the API")
    p.add_argument("--delay",         type=float, default=1.0, help="Seconds to wait between API calls")

    return p


def main() -> None:
    parser = build_parser()
    args   = parser.parse_args()

    # Resolve tasks
    tasks = TASKS if "all" in args.task else args.task
    for t in tasks:
        if t not in TASKS:
            parser.error(f"Unknown task '{t}'. Options: {', '.join(TASKS)}")

    # Resolve domains
    domains = VALID_DOMAINS if args.sweep_domains else [args.domain]

    # Validate mutually exclusive topic modes
    if sum([args.sweep_topics, args.batch_topics, bool(args.topic)]) > 1:
        parser.error("--sweep-topics, --batch-topics, and --topic are mutually exclusive")

    # Base attribute profile
    base_attrs = {
        "quote":            args.quote,
        "numeric_claim":    args.numeric_claim,
        "authority_format": args.authority_format,
        "emotional_appeal": args.emotional_appeal,
        "call_to_action":   args.call_to_action,
        "multi_asset":      args.multi_asset,
        "num_articles":     args.num_articles,
        "topic":            args.topic,
        "format":           args.content_format,
        "batch_topics":     args.batch_topics,
        "zero_shot":        args.zero_shot,
        "free_attrs":       args.free_attrs,
        "tag":              args.tag,
    }

    # API key
    api_key = os.getenv("OPENROUTER_API_KEY", "")
    if not api_key and not args.dry_run:
        sys.exit("[error] OPENROUTER_API_KEY not set. Add it to .env or export it.")

    out_dir = Path(args.out)

    # Resolve topics per domain
    from benchmark.data import DOMAIN_TOPICS
    def _topics_for(domain: str) -> list:
        if args.sweep_topics:
            return DOMAIN_TOPICS[domain]
        elif args.topic:
            return [args.topic]
        else:
            return [None]  # batch_topics or unpinned — topic handled inside render()

    # Resolve formats
    def _formats_for() -> list:
        if args.sweep_formats:
            return args.sweep_formats
        elif args.content_format:
            return [args.content_format]
        else:
            return [None]  # free choice

    # Build run matrix: (task, model, domain, topic, format)
    runs = [
        (task, model, domain, topic, fmt)
        for task   in tasks
        for model  in args.model
        for domain in domains
        for topic  in _topics_for(domain)
        for fmt    in _formats_for()
    ]

    n_topics = len(DOMAIN_TOPICS[domains[0]]) if args.sweep_topics else (1 if args.topic else 0)
    print(f"VEX-Bench Run")
    print(f"  Tasks:   {tasks}")
    print(f"  Models:  {args.model}")
    print(f"  Domains: {domains}")
    if args.sweep_topics:
        print(f"  Topics:  all 10 per domain (sweep)")
    elif args.topic:
        print(f"  Topic:   {args.topic!r}")
    print(f"  Attrs:   {_attr_summary(base_attrs)}")
    print(f"  Total:   {len(runs)} queries")
    print()

    results = []
    for i, (task, model, domain, topic, fmt) in enumerate(runs, 1):
        attrs = {**base_attrs, "domain": domain, "topic": topic, "format": fmt}
        if args.random_attrs:
            attrs = {
                **attrs,
                "quote":            random.choice([True, False]),
                "numeric_claim":    random.choice([True, False]),
                "authority_format": random.choice(["none", "news", "official", "expert"]),
                "emotional_appeal": random.choice(["none", "fear", "outrage"]),
                "call_to_action":   random.choice([True, False]),
                "multi_asset":      random.choice([True, False]),
            }
        if args.anchor_from_results:
            attrs["anchor_override"] = _pick_random_anchor(out_dir, task, domain)
        print(f"[{i}/{len(runs)}]")
        try:
            # Scale max_tokens for batch mode: 8192 per topic
            if attrs.get("batch_topics"):
                from benchmark.data import DOMAIN_TOPICS
                n_topics   = len(DOMAIN_TOPICS.get(domain, []))
                max_tokens = max(args.max_tokens, 8192 * n_topics)
            else:
                max_tokens = args.max_tokens
            rec = run_one(
                task         = task,
                model        = model,
                attrs        = attrs,
                out_dir      = out_dir,
                api_key      = api_key,
                temperature  = args.temperature,
                max_tokens   = max_tokens,
                skip_existing = args.skip_existing,
                dry_run      = args.dry_run,
            )
            results.append(rec)
        except Exception as e:
            print(f"  [error] {e}")
            results.append({"task": task, "model": model, "domain": domain, "topic": topic, "error": str(e)})

        if i < len(runs) and args.delay > 0 and not args.dry_run:
            time.sleep(args.delay)

    # Summary
    ok      = sum(1 for r in results if r.get("response"))
    skipped = sum(1 for r in results if not r)
    errors  = sum(1 for r in results if r.get("error"))
    print()
    print(f"Done. {ok} completed, {skipped} skipped, {errors} errors.")
    if not args.dry_run:
        print(f"Results saved to: {out_dir.resolve()}/")


if __name__ == "__main__":
    main()
