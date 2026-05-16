import re
from typing import Optional

# Neutral fallbacks when ElevenLabs blocks generation
SAFE_VOICE_DESCRIPTION = (
    "A clear, warm adult narrator voice with a steady pace and friendly tone. "
    "Suitable for audiobook storytelling."
)
SAFE_PREVIEW_TEXT = (
    "Hello, I am here to tell you a story. The evening was calm, "
    "and every word carried warmth and clarity."
)
SAFE_VOICE_NAME = "VoiceTale Narrator"

# Terms that often trigger ElevenLabs safety classifiers in Voice Design
_BLOCKED_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\b(randy|seductive|sensual|erotic|sexy|nude|naked)\b", re.I), "expressive"),
    (re.compile(r"\b(affair|lover|seduce|make love|orgasm)\b", re.I), "warm"),
    (re.compile(r"\b(tramp|slut|whore)\b", re.I), "lively"),
    (re.compile(r"\b(kill|murder|blood|weapon|torture|violent)\b", re.I), "strong"),
    (re.compile(r"\b(child(?:ren)?|kid|minor|underage)\b", re.I), "young"),
    (re.compile(r"\b(twin|twins)\b", re.I), "paired"),
    (re.compile(r"\b(pregnant|pregnancy)\b", re.I), "gentle"),
    (re.compile(r"\b(evil|demon|satan)\b", re.I), "deep"),
]

_ACOUSTIC_PREFIX = (
    "A clear audiobook voice. "
)


def sanitize_voice_description(prompt: str) -> str:
    """Strip risky terms and ensure acoustic-only framing for Voice Design."""
    text = (prompt or "").strip()
    for pattern, replacement in _BLOCKED_PATTERNS:
        text = pattern.sub(replacement, text)
    # Drop plot-like clauses after colons/dashes when very long
    if len(text) > 200 and not text.lower().startswith("a "):
        text = _ACOUSTIC_PREFIX + text
    elif not text.lower().startswith(("a ", "an ")):
        text = _ACOUSTIC_PREFIX + text
    if len(text) < 20:
        text = (text + " " + SAFE_VOICE_DESCRIPTION).strip()
    if len(text) > 1000:
        text = text[:1000]
    return text


def build_safe_preview_text(
    role: str = "supporting",
    estimated_age: str = "adult",
    gender: str = "other",
) -> str:
    """Return neutral preview text for Voice Design (never raw story dialogue)."""
    age_phrase = {
        "child": "young and bright",
        "teen": "youthful and clear",
        "young_adult": "warm and confident",
        "adult": "steady and expressive",
        "elderly": "calm and measured",
    }.get(estimated_age, "steady and expressive")

    if role == "narrator":
        return (
            "Welcome to this story. I will guide you through each scene "
            "with a clear, warm tone and steady pacing."
        )

    gender_phrase = {
        "male": "speaker",
        "female": "speaker",
    }.get(gender, "speaker")

    return (
        f"Hello. I am a {age_phrase} {gender_phrase} in this audiobook. "
        "Let me share this passage with clarity, warmth, and gentle expression."
    )


def sanitize_voice_name(name: str, character_id: Optional[str] = None) -> str:
    """Use a generic voice name if the character name may confuse safety filters."""
    raw = (name or "").strip()
    if not raw:
        return SAFE_VOICE_NAME
    lowered = raw.lower()
    risky_tokens = ("twin", "child", "lover", "affair", "narrator's", "seduc")
    if any(tok in lowered for tok in risky_tokens):
        suffix = (character_id or "character").replace("_", "-")
        return f"VoiceTale {suffix}"[:80]
    return raw[:80]


def is_blocked_generation_error(exc: BaseException) -> bool:
    """Detect ElevenLabs 403 blocked_generation from SDK exceptions."""
    status = getattr(exc, "status_code", None)
    if status == 403:
        body = getattr(exc, "body", None)
        if isinstance(body, dict):
            detail = body.get("detail") or {}
            if isinstance(detail, dict) and detail.get("status") == "blocked_generation":
                return True
        msg = str(exc).lower()
        if "blocked_generation" in msg or "safety guidelines" in msg:
            return True
    return "blocked_generation" in str(exc).lower()
