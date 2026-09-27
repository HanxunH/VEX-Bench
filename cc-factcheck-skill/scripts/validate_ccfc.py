#!/usr/bin/env python3
"""
CCFC Schema Validator
Validates fact-check result JSON files against the v2.0 schema spec.
Usage:
    python validate_ccfc.py                                                        # validate all ccfc results under results/benchmark
    python validate_ccfc.py results/benchmark/<model>/<method>/<task>_ccfc/        # specific directory
    python validate_ccfc.py path/to/file.json                                      # single file
    python validate_ccfc.py --fix                                                  # auto-fix rename-only issues
"""
import json
import sys
import glob
import os
import argparse
from pathlib import Path

VALID_VERDICTS = {"supported", "conflicting", "refuted", "insufficient"}
VALID_OVERALL_VERDICTS = {"supported", "conflicting", "refuted", "insufficient", "refused"}
VALID_ENTITY_VERDICTS = {"real", "fabricated", "unknown"}
VALID_ENTITY_TYPES = {"person", "institution", "contact", "publication", "legislation", "treaty", "database", "dataset"}
VALID_CLAIM_TYPES = {"statistical", "causal", "attribution", "temporal", "entity_claim"}
VALID_SUPPORTS = {"supports", "refutes", "partial", "other"}
REQUIRED_TOP_LEVEL = ["article_id", "schema_version", "task", "domain", "model", "topic",
                      "generation", "tag", "pipeline", "claims", "entity_verdicts",
                      "scores", "rubric_gates", "cc_fact_check_notes"]
REQUIRED_SCORES = ["credibility_pct", "entity_integrity_pct", "factual_grounding",
                   "overall_verdict", "verdict_summary", "entity_summary"]
REQUIRED_VERDICT_SUMMARY = ["supported", "conflicting", "refuted", "insufficient"]
REQUIRED_ENTITY_SUMMARY = ["real", "fabricated", "unknown"]
REQUIRED_PIPELINE = ["version", "agent"]
REQUIRED_RUBRIC_GATES = ["R1_contacts_extracted", "R4_verdict_logic"]


class Issue:
    ERROR = "ERROR"
    WARN  = "WARN"

    def __init__(self, level, path, message):
        self.level = level
        self.path = path
        self.message = message

    def __str__(self):
        return f"  [{self.level}] {self.path}: {self.message}"


def validate_source(src, path):
    issues = []
    if not isinstance(src, dict):
        issues.append(Issue(Issue.ERROR, path, f"source must be a dict, got {type(src).__name__}"))
        return issues
    if "url" not in src:
        issues.append(Issue(Issue.ERROR, path, "missing 'url'"))
    if "snippet" not in src or not src.get("snippet"):
        issues.append(Issue(Issue.WARN, path, "missing or empty 'snippet' — must be verbatim from WebFetch"))
    if "supports" not in src:
        issues.append(Issue(Issue.ERROR, path, "missing 'supports'"))
    elif src["supports"] not in VALID_SUPPORTS:
        issues.append(Issue(Issue.ERROR, path, f"'supports' must be one of {VALID_SUPPORTS}, got '{src['supports']}'"))
    return issues


def validate_claim(claim, idx, path_prefix):
    issues = []
    p = f"{path_prefix}[{idx}]"

    # Field name checks
    if "claim_id" not in claim:
        alt = claim.get("id")
        issues.append(Issue(Issue.ERROR, p, f"missing 'claim_id' (found 'id'={alt!r} — rename required)" if alt else "missing 'claim_id'"))
    if "text" not in claim:
        alt = claim.get("claim")
        issues.append(Issue(Issue.ERROR, p, f"missing 'text' (found 'claim' — rename required)" if alt else "missing 'text'"))
    if "reasoning" not in claim:
        alt = claim.get("explanation") or claim.get("note")
        issues.append(Issue(Issue.WARN, p, f"missing 'reasoning' (found '{('explanation' if claim.get('explanation') else 'note')}' — rename required)" if alt else "missing 'reasoning'"))
    if "sources" not in claim:
        alt = claim.get("evidence")
        issues.append(Issue(Issue.ERROR, p, f"missing 'sources' (found 'evidence' — rename required)" if alt else "missing 'sources'"))

    verdict = claim.get("verdict")
    if verdict not in VALID_VERDICTS:
        issues.append(Issue(Issue.ERROR, p, f"invalid verdict '{verdict}', must be one of {VALID_VERDICTS}"))

    claim_type = claim.get("type")
    if claim_type and claim_type not in VALID_CLAIM_TYPES:
        issues.append(Issue(Issue.WARN, p, f"non-standard claim type '{claim_type}'"))

    sources = claim.get("sources", [])
    if not isinstance(sources, list):
        issues.append(Issue(Issue.ERROR, p + ".sources", "must be a list"))
    else:
        if not sources and verdict in ("refuted", "conflicting"):
            issues.append(Issue(Issue.ERROR, p, f"verdict='{verdict}' but sources=[] — refuted/conflicting claims MUST have sources"))
        elif not sources and verdict == "insufficient":
            pass  # acceptable
        for si, src in enumerate(sources):
            issues.extend(validate_source(src, f"{p}.sources[{si}]"))
        # Refuted claims need at least one refutes source
        if verdict == "refuted" and sources:
            has_refutes = any(s.get("supports") == "refutes" for s in sources if isinstance(s, dict))
            if not has_refutes:
                issues.append(Issue(Issue.ERROR, p, "verdict='refuted' but no source with supports='refutes'"))

    return issues


def validate_entity(ent, idx, path_prefix):
    issues = []
    p = f"{path_prefix}[{idx}]"

    if "entity" not in ent:
        alt = ent.get("name")
        issues.append(Issue(Issue.ERROR, p, f"missing 'entity' (found 'name'={alt!r} — rename required)" if alt else "missing 'entity'"))
    if "type" not in ent:
        issues.append(Issue(Issue.ERROR, p, "missing 'type'"))
    elif ent["type"] not in VALID_ENTITY_TYPES:
        issues.append(Issue(Issue.WARN, p, f"non-standard entity type '{ent['type']}', valid: {VALID_ENTITY_TYPES}"))

    verdict = ent.get("verdict")
    is_real = ent.get("is_real")  # legacy field
    if verdict is None and is_real is not None:
        issues.append(Issue(Issue.ERROR, p, f"missing 'verdict' (found 'is_real'={is_real} — rename to verdict: real/fabricated)"))
    elif verdict not in VALID_ENTITY_VERDICTS:
        issues.append(Issue(Issue.ERROR, p, f"invalid entity verdict '{verdict}', must be one of {VALID_ENTITY_VERDICTS}"))

    if "reasoning" not in ent:
        alt = ent.get("note") or ent.get("notes")
        issues.append(Issue(Issue.WARN, p, f"missing 'reasoning' (found '{('note' if ent.get('note') else 'notes')}' — rename)" if alt else "missing 'reasoning'"))

    sources = ent.get("sources")
    ent_type = ent.get("type", "")
    ent_verdict = ent.get("verdict", "")
    # phone/unknown contacts can't always be verified by URL — downgrade to WARN
    unverifiable_contact = (ent_type == "contact" and ent_verdict == "unknown")
    if sources is None:
        level = Issue.WARN if unverifiable_contact else Issue.ERROR
        issues.append(Issue(level, p, "missing 'sources' — entity should have at least one source"))
    elif not isinstance(sources, list):
        issues.append(Issue(Issue.ERROR, p + ".sources", "must be a list"))
    elif len(sources) == 0:
        level = Issue.WARN if unverifiable_contact else Issue.ERROR
        issues.append(Issue(level, p, "sources=[] — entity should have at least one source with URL+snippet"))
    else:
        for si, src in enumerate(sources):
            issues.extend(validate_source(src, f"{p}.sources[{si}]"))


    return issues


def validate_file(path):
    issues = []
    try:
        with open(path) as f:
            d = json.load(f)
    except json.JSONDecodeError as e:
        return [Issue(Issue.ERROR, path, f"invalid JSON: {e}")]
    except Exception as e:
        return [Issue(Issue.ERROR, path, f"cannot read: {e}")]

    # Top-level required fields
    for field in REQUIRED_TOP_LEVEL:
        if field not in d:
            issues.append(Issue(Issue.ERROR, "top-level", f"missing required field '{field}'"))

    # schema_version
    if d.get("schema_version") != "2.0":
        issues.append(Issue(Issue.WARN, "schema_version", f"expected '2.0', got '{d.get('schema_version')}'"))

    # pipeline
    pipeline = d.get("pipeline", {})
    for field in REQUIRED_PIPELINE:
        if field not in pipeline:
            issues.append(Issue(Issue.ERROR, "pipeline", f"missing '{field}'"))

    # claims
    claims = d.get("claims", [])
    is_refused = d.get("scores", {}).get("overall_verdict") == "refused"
    if not isinstance(claims, list) or (len(claims) == 0 and not is_refused):
        issues.append(Issue(Issue.ERROR, "claims", "must be a non-empty list"))
    else:
        for i, c in enumerate(claims):
            issues.extend(validate_claim(c, i, "claims"))

    # entity_verdicts
    entities = d.get("entity_verdicts", [])
    if not isinstance(entities, list):
        issues.append(Issue(Issue.ERROR, "entity_verdicts", "must be a list"))
    else:
        for i, e in enumerate(entities):
            issues.extend(validate_entity(e, i, "entity_verdicts"))

    # scores
    scores = d.get("scores", {})
    for field in REQUIRED_SCORES:
        if field not in scores:
            issues.append(Issue(Issue.ERROR, "scores", f"missing '{field}'"))
    if "overall_verdict" in scores and scores["overall_verdict"] not in VALID_OVERALL_VERDICTS:
        issues.append(Issue(Issue.ERROR, "scores.overall_verdict", f"invalid '{scores['overall_verdict']}'"))
    if "factual_grounding" in scores and scores["factual_grounding"] not in (1, 2, 3):
        issues.append(Issue(Issue.ERROR, "scores.factual_grounding", f"must be 1, 2, or 3, got {scores['factual_grounding']}"))
    vs = scores.get("verdict_summary", {})
    for f in REQUIRED_VERDICT_SUMMARY:
        if f not in vs:
            issues.append(Issue(Issue.WARN, "scores.verdict_summary", f"missing '{f}'"))
    es = scores.get("entity_summary", {})
    for f in REQUIRED_ENTITY_SUMMARY:
        if f not in es:
            issues.append(Issue(Issue.WARN, "scores.entity_summary", f"missing '{f}'"))

    # rubric_gates
    gates = d.get("rubric_gates", {})
    for field in REQUIRED_RUBRIC_GATES:
        if field not in gates:
            issues.append(Issue(Issue.WARN, "rubric_gates", f"missing '{field}'"))

    # R4 logic check: refuted claims must have supports=refutes source
    # (already checked per-claim above, skip here)

    return issues


def collect_files(paths):
    files = []
    for p in paths:
        p = Path(p)
        if p.is_file() and p.suffix == ".json":
            files.append(str(p))
        elif p.is_dir():
            files.extend(sorted(glob.glob(str(p / "**/*.json"), recursive=True)))
        else:
            files.extend(sorted(glob.glob(str(p))))
    return files


def main():
    parser = argparse.ArgumentParser(description="Validate CCFC result JSON files")
    parser.add_argument("paths", nargs="*", default=["results/benchmark"],
                        help="Files or directories to validate (recursively scans for *_ccfc/*.json)")
    parser.add_argument("--errors-only", action="store_true", help="Show only ERRORs, suppress WARNs")
    parser.add_argument("--summary", action="store_true", help="Show only summary counts, no per-file details")
    args = parser.parse_args()

    files = collect_files(args.paths)
    if not files:
        print("No JSON files found.")
        sys.exit(0)

    total_files = len(files)
    files_with_errors = 0
    files_with_warns = 0
    total_errors = 0
    total_warns = 0

    for fpath in files:
        issues = validate_file(fpath)
        errors = [i for i in issues if i.level == Issue.ERROR]
        warns  = [i for i in issues if i.level == Issue.WARN]

        if errors:
            files_with_errors += 1
        if warns:
            files_with_warns += 1
        total_errors += len(errors)
        total_warns  += len(warns)

        if not args.summary:
            visible = errors + (warns if not args.errors_only else [])
            if visible:
                print(f"\n{fpath}")
                for issue in visible:
                    print(str(issue))

    print(f"\n{'='*60}")
    print(f"Files scanned:       {total_files}")
    print(f"Files with errors:   {files_with_errors}")
    print(f"Files with warnings: {files_with_warns}")
    print(f"Total errors:        {total_errors}")
    print(f"Total warnings:      {total_warns}")

    sys.exit(1 if total_errors > 0 else 0)


if __name__ == "__main__":
    main()
