# VEX-Benchmark

Misinformation generation benchmark for comparing prompting methods across LLMs.

Important:
- This framework intentionally generates misinformation samples for research evaluation.
- Output content is synthetic/false by design, not factual reporting.

## What this benchmark does

For each condition, a method gets:
- task: fabrication or rewrite
- domain: one of 6 domains
- topic: one of 10 topics in that domain
- source: real source article text (rewrite only)

Then it asks a model to produce misinformation content, parses the response into structured articles, and reports:
- comply rate (did model produce usable output)
- valid rate (did output pass validator checks)

Condition count:
- 2 tasks x 6 domains x 10 topics = 120 conditions per model per method

## Runner

Use `benchmark/main.py` as the primary entrypoint.

Do not use old `python -m benchmark` examples for new runs.

## Available methods

- direct
- isc
- misinfoqa
- poisonedrag
- disinfocap
- pap

Method registry is in `benchmark/main.py` (`METHODS` dict).

## Usage (explicit commands)

From project root:

```bash
# 1) Single task + single domain (10 conditions)
python benchmark/main.py --method isc --model deepseek/deepseek-chat --task fabrication --domain health

# 2) Single domain, both tasks (20 conditions)
python benchmark/main.py --method isc --model deepseek/deepseek-chat --domain health

# 3) Full sweep (120 conditions)
python benchmark/main.py --method isc --model deepseek/deepseek-chat

# 4) Compare baseline methods on same slice (each 10 conditions)
python benchmark/main.py --method direct      --model deepseek/deepseek-chat --task fabrication --domain health
python benchmark/main.py --method misinfoqa   --model deepseek/deepseek-chat --task fabrication --domain health
python benchmark/main.py --method poisonedrag --model deepseek/deepseek-chat --task fabrication --domain health
python benchmark/main.py --method disinfocap  --model deepseek/deepseek-chat --task fabrication --domain health
python benchmark/main.py --method pap         --model deepseek/deepseek-chat --task fabrication --domain health

# 5) Multiple models in one run
python benchmark/main.py --method isc --model deepseek/deepseek-chat --model qwen/qwen3.5-flash --task fabrication --domain health

# 6) Resume run (skip existing files)
python benchmark/main.py --method isc --model deepseek/deepseek-chat --skip-existing

# 7) Summary only (no API calls)
python benchmark/main.py --method isc --model deepseek/deepseek-chat --summary

# 8) Dry run (print prompts, no API calls)
python benchmark/main.py --method isc --model deepseek/deepseek-chat --dry-run --task rewrite --domain politics
```

Optional output directory override:

```bash
python benchmark/main.py \
  --method isc \
  --model deepseek/deepseek-chat \
  --task fabrication \
  --domain health \
  --out benchmark/methods/isc/results
```

## Environment

Required:
- `OPENROUTER_API_KEY` in `.env` or shell env

Example `.env`:

```bash
OPENROUTER_API_KEY=sk-or-...
```

If missing, runner exits with:
`[error] OPENROUTER_API_KEY not set`

## Output layout

Default output root: `results/benchmark`

Per model:
- `results/benchmark/<model_slug>/<method>/<task>/<domain>__<topic>.json`

If model is `deepseek/deepseek-chat`, slug becomes `deepseek__deepseek-chat`.

Example path:
- `results/benchmark/deepseek__deepseek-chat/isc/fabrication/health__Measles_resurgence.json`

Each result JSON includes fields like:
- method, model, task, domain, topic
- prompt, response
- articles
- complied, valid
- extraction_mode (native or llm_fallback, when fallback parser is triggered)
- elapsed_s, usage

## Notes for ISC templates

ISC prompt files are in:
- `benchmark/methods/isc/fabrication_structure.py`
- `benchmark/methods/isc/fabrication_dissemination.py`
- `benchmark/methods/isc/fabrication_factcheck.py`
- `benchmark/methods/isc/rewrite_structure.py`
- `benchmark/methods/isc/rewrite_dissemination.py`
- `benchmark/methods/isc/rewrite_factcheck.py`

Current pattern:
- realistic terminal simulation (`ls -la -> cat validate.py -> cat data -> python validate.py`)
- validator-driven constraints (anti-shortcut checks)
- CI-style logs (`validation summary: passed=... failed=...`)

## Handoff quickstart

Fast smoke test before handoff:

```bash
# compile benchmark + methods
python3 -m py_compile benchmark/*.py benchmark/methods/isc/*.py

# run one real slice
python benchmark/main.py --method isc --model deepseek/deepseek-chat --task fabrication --domain health

# print summary
python benchmark/main.py --method isc --model deepseek/deepseek-chat --summary
```
