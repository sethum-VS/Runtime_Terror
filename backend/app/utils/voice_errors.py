"""Classify ElevenLabs Voice Design failures and refine prompts for retries."""

from __future__ import annotations

import re
from enum import Enum

from app.services.voice_safety import SAFE_VOICE_DESCRIPTION, sanitize_voice_description


class VoiceErrorKind(str, Enum):
    BLOCKED = "blocked"
    RATE_LIMIT = "rate_limit"
    INVALID_PROMPT = "invalid_prompt"
    DUPLICATE_NAME = "duplicate_name"
    TIMEOUT = "timeout"
    API_ERROR = "api_error"
    UNKNOWN = "unknown"


def classify_voice_error(exc: BaseException) -> VoiceErrorKind:
    msg = str(exc).lower()
    status = getattr(exc, "status_code", None)

    if status == 429 or "rate limit" in msg or "too many requests" in msg:
        return VoiceErrorKind.RATE_LIMIT
    if status == 408 or "timeout" in msg or "timed out" in msg:
        return VoiceErrorKind.TIMEOUT
    if "blocked_generation" in msg or "safety guidelines" in msg or status == 403:
        return VoiceErrorKind.BLOCKED
    if "duplicate" in msg and "name" in msg:
        return VoiceErrorKind.DUPLICATE_NAME
    if "too short" in msg or "too long" in msg or "invalid" in msg or "voice_description" in msg:
        return VoiceErrorKind.INVALID_PROMPT
    if status and 500 <= int(status) < 600:
        return VoiceErrorKind.API_ERROR
    return VoiceErrorKind.UNKNOWN


def refine_prompt_for_retry(prompt: str, kind: VoiceErrorKind, attempt: int) -> str:
    """Return a safer prompt for the next Voice Design attempt (attempt is 2 or 3)."""
    if attempt >= 3 or kind == VoiceErrorKind.BLOCKED:
        return SAFE_VOICE_DESCRIPTION

    text = sanitize_voice_description(prompt)

    if kind == VoiceErrorKind.INVALID_PROMPT:
        if len(text) < 20:
            text = (
                "A clear adult voice with a warm, steady tone. "
                "Moderate pace, expressive and suitable for audiobook dialogue."
            )
        return text[:1000]

    if kind in (VoiceErrorKind.API_ERROR, VoiceErrorKind.UNKNOWN, VoiceErrorKind.TIMEOUT):
        # Strip adjectives and plot-like phrases; keep acoustic core
        text = re.sub(r"\b(who|whose|because|when|after|before)\b[^.]*\.?", "", text, flags=re.I)
        return sanitize_voice_description(text) or SAFE_VOICE_DESCRIPTION

    return sanitize_voice_description(text)


def retry_voice_name(base_name: str, character_id: str | None, attempt: int) -> str:
    """Unique voice name when ElevenLabs rejects duplicates."""
    suffix = (character_id or "char").replace("_", "-")
    return f"VT-{suffix}-{attempt}"[:80]
