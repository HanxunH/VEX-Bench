# Agent instructions

This repository contains the VEX-Bench generation harness, elicitation methods, VEX/JailNewsBench/StrongREJECT judges, and the CC-Factcheck workflow. The scored dataset is hosted at [Hugging Face](https://huggingface.co/datasets/hanxunh/VEX-Bench); the static results site is published separately from the `website` branch.

## Boundaries

- Preserve the two tasks (`fabrication`, `rewrite`), six domains, seven method IDs, and D1–D5 score meanings when changing benchmark behavior. Do not silently change judge prompts or rubric scales.
- Keep `benchmark/source_articles.json` URL-only in commits. Rewrite runs can use fetched source text locally, but do not publish article originals or fetched fact-check excerpts.
- Do not commit `.env`, API keys, local `results/`, raw `datasets/*.jsonl`, or the ignored local release helper `prepare_hf_release.py`.
- Treat model-generated articles and fact-check verdicts as research artifacts, not factual reporting or human ground truth.

## Verification

- Start with a no-network dry run from the repository root: `python benchmark/main.py --method direct --model openai/gpt-5.4 --task fabrication --domain health --dry-run`.
- Generation and `python -m benchmark.run_judges` use OpenRouter and incur API calls. Do not run them merely to verify documentation or a small code edit; obtain the user's approval first.
- When changing a method, parser, or judge, check the affected task/domain path and explain any resulting change to output schema or benchmark comparisons.
- Keep the citation in `CITATION.cff` and `README.md` consistent with the [paper](https://openreview.net/forum?id=xYPvwioYRg).
