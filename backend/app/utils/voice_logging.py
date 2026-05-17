"""Lightweight logging for voice profiling / design retries."""

from __future__ import annotations

from app.utils.voice_errors import VoiceErrorKind


def log_voice_attempt(
    character_name: str,
    character_id: str | None,
    attempt: int,
    max_attempts: int,
    *,
    success: bool = False,
    error_kind: VoiceErrorKind | None = None,
    detail: str = "",
) -> None:
    cid = character_id or "?"
    if success:
        print(f"[voice] {character_name} ({cid}): voice created on attempt {attempt}/{max_attempts}")
        return
    kind = error_kind.value if error_kind else "unknown"
    extra = f" — {detail[:200]}" if detail else ""
    print(
        f"[voice] {character_name} ({cid}): attempt {attempt}/{max_attempts} failed "
        f"({kind}){extra}"
    )
