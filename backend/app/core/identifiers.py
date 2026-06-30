import re

# Anchored at the end of the string — the slug prefix in a "{slug}-{uuid}" route param is
# purely cosmetic and never validated, so any text before the UUID is ignored.
_UUID_SUFFIX_RE = re.compile(
    r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


def extract_uuid(identifier: str) -> str | None:
    match = _UUID_SUFFIX_RE.search(identifier)
    return match.group(0) if match else None
