"""Abstract base class for benchmark judges."""

import json
from abc import ABC, abstractmethod
from pathlib import Path


class Judge(ABC):
    """Base class for benchmark judges.

    Mirrors the Method ABC pattern:
      - ``name``   — short identifier (e.g. "strongreject", "vex")
      - ``suffix``  — output folder suffix  (e.g. "_strongreject", "_vex")
      - ``judge_file()``  — abstract: score one result JSON, return a score dict
      - ``judge_batch()`` — concrete: iterate a method directory, call judge_file()

    Subclasses only need to implement ``judge_file()``.
    The shared ``judge_batch()`` loop handles folder creation, skip logic,
    metadata stamping, and JSON output.
    """

    name: str = "base"
    suffix: str = "_judge"

    VALID_TASKS = {"fabrication", "rewrite"}

    @abstractmethod
    def judge_file(self, result_path: str, api_key: str = "") -> dict:
        """Score a single benchmark result JSON file.

        Args:
            result_path: Path to the raw result JSON produced by benchmark/main.py.
            api_key:     OpenRouter API key.

        Returns:
            A flat dict of scores.  Must include at least the keys that
            ``judge_batch()`` will stamp with metadata before saving.
        """
        ...

    def judge_batch(self, results_dir: str, api_key: str = "",
                    skip_existing: bool = True) -> list:
        """Run the judge on every result file under a method directory.

        Saves one judge JSON per article in a sibling folder named
        ``{task}{self.suffix}`` (e.g. ``fabrication_strongreject``).

        Args:
            results_dir:   Path to a method directory, e.g.
                           ``results/benchmark/anthropic__claude-sonnet-4/isc``
            api_key:       OpenRouter API key.
            skip_existing: Skip files that already have a judge output.

        Returns:
            List of result dicts (one per processed file).
        """
        results_dir = Path(results_dir)
        all_results = []

        for task_dir in sorted(results_dir.iterdir()):
            if not task_dir.is_dir() or task_dir.name not in self.VALID_TASKS:
                continue
            task = task_dir.name

            out_dir = results_dir / f"{task}{self.suffix}"
            out_dir.mkdir(parents=True, exist_ok=True)

            for f in sorted(task_dir.glob("*.json")):
                out_file = out_dir / f.name
                if skip_existing and out_file.exists():
                    continue

                try:
                    raw = json.loads(f.read_text(encoding="utf-8"))
                except Exception:
                    raw = {}

                result = self.judge_file(str(f), api_key=api_key)
                result["file"] = f.name
                result["task"] = raw.get("task", task)
                result["domain"] = raw.get("domain", "")
                result["topic"] = raw.get("topic", "")
                result["method"] = raw.get("method", "")
                result["model"] = raw.get("model", "")

                out_file.write_text(json.dumps(result, indent=2, ensure_ascii=False))
                all_results.append(result)
                self._log(task, f.stem, result)

        return all_results

    def _log(self, task: str, stem: str, result: dict) -> None:
        """Log a judged result. Override for custom status messages."""
        print(f"[{self.name}] {task}|{stem[:40]} → judged")
