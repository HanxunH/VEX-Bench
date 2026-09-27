# VEX-Bench Generation + Judge Outputs

Five JSONL files. Each line is a self-describing record for one
(model, method, task, domain, topic) cell.

| File                 | Records | Size   | Contents                       |
|----------------------|---------|--------|--------------------------------|
| `articles.jsonl`     | 5,880   | 61 MB  | Raw model generations + parsed articles |
| `vex.jsonl`          | 5,880   | 2.4 MB | VEX (D1–D5 dimension scoring)  |
| `jnb.jsonl`          | 5,880   | 2.4 MB | JailNewsBench (8 sub-metrics)  |
| `strongreject.jsonl` | 5,880   | 4.2 MB | StrongREJECT                   |
| `ccfc.jsonl`         | 5,880   | 62 MB  | CC-Factcheck (CCFC pipeline)   |

Every file covers the same 5,880 cells:
**7 models × 7 methods × 2 tasks × 6 domains × 10 topics = 5,880**.

## Common metadata (every record)

```
{
  "model":  <model_slug>,        e.g. "openai__gpt-5.4"
  "method": <method_id>,         "direct" | "isc" | "misinfoqa" | "poisonedrag"
                                 | "disinfocap" | "pap" | "jailnewsbench"
  "task":   <task_id>,           "fabrication" | "rewrite"
  "domain": <domain>,            "health" | "politics" | "public_safety"
                                 | "finance" | "identity_groups" | "environment"
  "topic":  <topic_slug>,
  ...                             # judge-specific fields below
}
```

## Per-file schemas

### `articles.jsonl`

Raw model outputs from `benchmark/main.py`. The rendered prompt is **not**
included (it is deterministic given method + task + domain + topic; re-render
with `python benchmark/main.py --method <m> --model <M> --task <t> --domain <d> --dry-run`).

| Field             | Type        | Meaning                                    |
|-------------------|-------------|--------------------------------------------|
| `response`        | str         | Raw model response (may be a refusal)      |
| `extraction_mode` | str         | `native` (clean JSON) or `llm_fallback`    |
| `articles`        | list        | Parsed articles, each `{text, data}`       |
| `complied`        | bool        | Did the model produce any usable output?   |
| `num_articles`    | int         | Number of parsed articles                  |
| `valid`           | bool        | Did **all** articles pass the validator?   |
| `validations`     | list        | Per-article `{valid, errors, warnings}`    |
| `elapsed_s`       | float       | Wall time of the API call                  |
| `usage`           | dict        | OpenRouter usage block (tokens, cost, …)   |

### `vex.jsonl`

Five 1–5 ordinal scores. See `benchmark/judges/vex/vex_prompt.txt` for the
rubric.

| Field                | Type | Range | Meaning                          |
|----------------------|------|-------|----------------------------------|
| `checkability`       | int  | 1–5   | D1                               |
| `harm`               | int  | 1–5   | D2                               |
| `source_credibility` | int  | 1–5   | D3                               |
| `presentation`       | int  | 1–5   | D4                               |
| `verification_cost`  | int  | 1–5   | D5                               |
| `overall_reasoning`  | str  |       | judge's free-text justification  |
| `parse_ok`           | bool |       | whether scores parsed cleanly    |
| `judge_model`        | str  |       | LLM used to score (default GPT-5.2) |

### `jnb.jsonl`

Eight 0–4 ordinal sub-metrics from the JailNewsBench rubric, plus `avg_score`.

```
faithfulness, verifiability, adherence, scope, scale,
formality,    subjectivity,  agitativeness, avg_score
```

### `strongreject.jsonl`

| Field            | Type        | Meaning                            |
|------------------|-------------|------------------------------------|
| `refused`        | bool        | True if model refused the request  |
| `convincingness` | int / null  | 1–5 (null if refused)              |
| `specificity`    | int / null  | 1–5 (null if refused)              |
| `score`          | float       | combined StrongREJECT score [0,1]  |
| `reasoning`      | str         | judge rationale                    |

### `ccfc.jsonl`

Per-claim and per-entity fact-check verdicts. Each row carries:

```
{
  "article_id":      "<domain>__<topic>",
  "schema_version":  "v2.0",
  "claims":          [{ "claim_id", "text", "verdict", "sources": [...], ... }],
  "entity_verdicts": [{ "entity",   "type", "verdict", "sources": [...], ... }],
  "scores": {
    "credibility_pct":      <float>,
    "entity_integrity_pct": <float>,
    "factual_grounding":    1 | 2 | 3,
    "overall_verdict":      "supported" | "conflicting" | "refuted"
                            | "insufficient" | "refused",
    "verdict_summary": { "supported": <int>, "conflicting": <int>,
                         "refuted":   <int>, "insufficient": <int> },
    "entity_summary":  { "real": <int>, "fabricated": <int>, "unknown": <int> }
  },
  "rubric_gates":  { "R1_contacts_extracted": {...}, "R4_verdict_logic": {...} },
  "pipeline_stats": { "web_searches", "web_fetches",
                      "estimated_input_tokens", "estimated_output_tokens",
                      "estimated_llm_cost_usd", "estimated_search_cost_usd", ... },
  "cc_fact_check_notes": "<analyst summary>"
}
```

See `cc-factcheck-skill/SKILL.md` for the pipeline that produced these.

## Loading

Plain Python:
```python
import json
with open("datasets/vex.jsonl") as f:
    records = [json.loads(line) for line in f]
```

Pandas:
```python
import pandas as pd
df = pd.read_json("datasets/vex.jsonl", lines=True)
```

HuggingFace `datasets`:
```python
from datasets import load_dataset
ds = load_dataset("json", data_files="datasets/vex.jsonl")
```

## Reconstructing the original directory layout

The harness in `benchmark/` writes outputs to
`results/benchmark/<model>/<method>/<task>_<judge_suffix>/<domain>__<topic>.json`.
Each row in these JSONL files contains the full metadata needed to
reconstruct that path. A short example:

```python
import json, pathlib
out = pathlib.Path("results/benchmark")
suffix = {"articles": "", "vex": "_cw_gpt52_v25", "jnb": "_jnb",
          "strongreject": "_strongreject", "ccfc": "_ccfc"}
for judge in suffix:
    for line in open(f"datasets/{judge}.jsonl"):
        r = json.loads(line)
        path = (out / r["model"] / r["method"]
                / f"{r['task']}{suffix[judge]}"
                / f"{r['domain']}__{r['topic']}.json")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(r, indent=2, ensure_ascii=False))
```

## Preparing a Hugging Face review snapshot

The JSONL files above are raw benchmark exports. Do not upload this directory
unchanged: rewrite records include `articles[].data.original_text`, and CCFC
evidence sources include fetched snippets.

From `VEX-Bench-dev/`, run
`python prepare_hf_release.py <empty-output-dir> --repo-id <owner>/VEX-Bench`.
The script leaves these raw exports untouched and writes a Hub dataset card,
updated Croissant hashes, and five JSONL files for private review. Every
rewrite article record gets `source_url` in place of `original_text`; long
verbatim source passages copied into outputs are marked as omitted. CCFC
claim/entity source entries become URL strings. Variable-shape nested fields
are serialized as JSON strings for the Hugging Face viewer; decode them with
`json.loads`. Inspect the generated card and privacy/licensing risks before
making the private repository public.
