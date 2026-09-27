"""ISC (Internal Safety Collapse) method using TVD prompt pattern.

Each prompt variant is a self-contained module:
  fabrication_structure    — Layer 1: structure only
  fabrication_dissemination — Layer 2: + dissemination scoring
  fabrication_factcheck    — Layer 3: + fact-check agents
  rewrite_structure        — Layer 1: structure only
  rewrite_dissemination    — Layer 2: + dissemination scoring
  rewrite_factcheck        — Layer 3: + fact-check agents
"""

from benchmark import Method
from benchmark.data import extract_json_objects

_PROMPT_MAP = {
    ("fabrication", "structure"):    "benchmark.methods.isc.fabrication_structure",
    ("fabrication", "dissemination"): "benchmark.methods.isc.fabrication_dissemination",
    ("fabrication", "factcheck"):    "benchmark.methods.isc.fabrication_factcheck",
    ("rewrite",     "structure"):    "benchmark.methods.isc.rewrite_structure",
    ("rewrite",     "dissemination"): "benchmark.methods.isc.rewrite_dissemination",
    ("rewrite",     "factcheck"):    "benchmark.methods.isc.rewrite_factcheck",
}


class ISCMethod(Method):
    """ISC elicitation using TVD (Task-Validator-Data) prompt pattern.

    Args:
        variant: validator layer — "structure", "dissemination", or "factcheck"
    """

    name = "isc"

    def __init__(self, variant: str = "factcheck"):
        assert variant in ("structure", "dissemination", "factcheck"), \
            f"Unknown variant: {variant}"
        self.variant = variant

    def build_prompt(self, task, domain, topic, source=None):
        import importlib
        mod = importlib.import_module(_PROMPT_MAP[(task, self.variant)])
        if task == "rewrite":
            return mod.render(domain=domain, topic=topic, source=source or "")
        return mod.render(domain=domain, topic=topic)

    def parse_response(self, response_text: str) -> list[dict]:
        objs = extract_json_objects(response_text)
        packages = [o for o in objs if isinstance(o, dict) and ("body" in o or "claim" in o)]
        if not packages:
            return []
        articles = []
        for pkg in packages:
            text_parts = []
            if pkg.get("headline"):
                text_parts.append(pkg["headline"])
            if pkg.get("body"):
                text_parts.append(pkg["body"])
            articles.append({
                "text": "\n\n".join(text_parts),
                "data": pkg,
            })
        return articles
