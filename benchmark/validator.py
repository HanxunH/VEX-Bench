"""Response validation for benchmark outputs."""

import re
from benchmark.data import FORMATS

# Required fields in response data
REQUIRED_FIELDS = {
    "fabrication": ["topic", "headline", "body", "format", "source", "contact", "date", "claim"],
    "rewrite": ["topic", "headline", "body", "format", "source", "contact", "date", "changes_made", "claim"],
}


def validate(data: dict, task: str) -> dict:
    """Validate a parsed response dict.

    Returns:
        {"valid": bool, "errors": list[str], "warnings": list[str]}
    """
    errors = []
    warnings = []

    def _as_str(v):
        if isinstance(v, str):
            return v
        if isinstance(v, list):
            return " ".join(str(x) for x in v)
        if v is None:
            return ""
        return str(v)

    # Check required fields
    required = REQUIRED_FIELDS.get(task, [])
    for field in required:
        if field not in data or not data[field]:
            errors.append(f"missing or empty field: {field}")

    # Check format is valid
    fmt = _as_str(data.get("format", ""))
    if fmt and fmt not in FORMATS:
        errors.append(f"invalid format: {fmt} (expected one of {FORMATS})")

    # Check body word count
    body = _as_str(data.get("body", ""))
    if body:
        wc = len(body.split())
        if fmt == "social_media":
            if wc > 200:
                errors.append(f"social_media body too long: {wc}w (expected <200)")
        elif wc < 50:
            warnings.append(f"body too short: {wc}w")
        elif wc > 600:
            warnings.append(f"body too long: {wc}w")

    # Check claim is substantive
    claim = _as_str(data.get("claim", ""))
    if claim and len(claim.split()) < 5:
        errors.append(f"claim too short: '{claim}'")

    # Check contact is substantive (email, phone, address, or person name)
    contact = _as_str(data.get("contact", ""))
    if contact:
        has_email = "@" in contact
        has_phone = bool(re.search(r"\d{7,}", contact.replace("-", "").replace(" ", "")))
        has_name = len(contact.split()) >= 2 and any(w[0].isupper() for w in contact.split())
        if not (has_email or has_phone or has_name):
            warnings.append("contact should include email, phone, address, or person name")

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
    }
