# VEX-Bench: Benchmarking Verification Complexity of LLM-Generated Misinformation

VEX-Bench evaluates what LLMs produce after misinformation-elicitation prompts, not only whether they comply. It scores five dimensions of verification burden—checkability, harm significance, source credibility signals, imposter legitimacy, and verification cost—across 7 models, 7 methods, 2 tasks, and 60 topics (5,880 conditions).

[Paper](https://openreview.net/forum?id=xYPvwioYRg) · [Interactive results](https://hanxunh.github.io/VEX-Bench/) · [Dataset](https://huggingface.co/datasets/hanxunh/VEX-Bench)

## Run the code

From the repository root:

```bash
pip install -r requirements.txt

# Inspect prompts without an API key or model call.
python benchmark/main.py --method direct --model openai/gpt-5.4 \
    --task fabrication --domain health --dry-run

# Generation and judging require OPENROUTER_API_KEY in the environment or .env.
python benchmark/main.py --method direct --model openai/gpt-5.4 \
    --task fabrication --domain health
python -m benchmark.run_judges --results-dir results/benchmark \
    --recursive --judges all
```

Generation writes to `results/benchmark/<model_slug>/<method>/<task>/<domain>__<topic>.json` (`/` becomes `__` in the model ID). For `rewrite`, `benchmark/source_articles.json` supplies URLs only; fetch each source article and add its `original_text` before running it. The CC-Factcheck workflow is in [`cc-factcheck-skill/`](cc-factcheck-skill/).

## Content Warning

This paper contains synthetic examples of potentially harmful content, including misinformation and persuasive narratives, generated solely for AI Safety research purposes. All prompts and instructions are constructed in controlled settings and are de-identified, excluding references to specific persons, institutions, or countries. Model-generated responses may nevertheless include references to real or fictional entities. Such references are studied as part of the model outputs and, where relevant to our analysis, are fact-checked and annotated for veracity. These materials are included solely for scientific analysis and do not reflect the authors’ views.

## Citation

```bibtex
@inproceedings{huang2026vexbench,
  title={VEX-Bench: Benchmarking Verification Complexity of LLM-Generated Misinformation},
  author={Huang, Hanxun and Wu, Yutao and Wang, Qizhou and Montaña-Niño, Silvia and Li, Yige and Zheng, Xiang and Doyuran, Elif Buse and Matich, Phoebe and Liu, Xiao and Ma, Xingjun and Erfani, Sarah and Leckie, Christopher},
  booktitle={The Fortieth Annual Conference on Neural Information Processing Systems Evaluations and Datasets Track},
  year={2026},
  url={https://openreview.net/forum?id=xYPvwioYRg}
}
```
