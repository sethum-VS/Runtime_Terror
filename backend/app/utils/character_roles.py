"""Normalize Gemini character roles to Supabase CHECK constraint values."""

VALID_ROLES = frozenset({"protagonist", "antagonist", "supporting", "narrator"})

_ROLE_ALIASES: dict[str, str] = {
    "protagonist": "protagonist",
    "hero": "protagonist",
    "lead": "protagonist",
    "main": "protagonist",
    "main character": "protagonist",
    "main_character": "protagonist",
    "antagonist": "antagonist",
    "villain": "antagonist",
    "antagonist character": "antagonist",
    "supporting": "supporting",
    "supporting character": "supporting",
    "support": "supporting",
    "secondary": "supporting",
    "minor": "supporting",
    "side character": "supporting",
    "narrator": "narrator",
    "storyteller": "narrator",
    "narration": "narrator",
}


def normalize_character_role(role: str | None, *, character_id: str | None = None) -> str:
    """Map free-form LLM roles to protagonist|antagonist|supporting|narrator."""
    if character_id == "narrator":
        return "narrator"

    raw = (role or "").strip().lower()
    if not raw:
        return "supporting"

    if raw in VALID_ROLES:
        return raw

    if raw in _ROLE_ALIASES:
        return _ROLE_ALIASES[raw]

    # Substring heuristics for labels like "Main Protagonist"
    if "narrator" in raw or "storyteller" in raw:
        return "narrator"
    if "antagon" in raw or "villain" in raw:
        return "antagonist"
    if "protagon" in raw or "hero" in raw or "lead" in raw:
        return "protagonist"

    return "supporting"
