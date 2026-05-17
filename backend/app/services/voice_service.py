import asyncio
from typing import List, Optional, Set

from app.dependencies import get_supabase, get_elevenlabs
from app.utils.voice_errors import (
    VoiceErrorKind,
    classify_voice_error,
    refine_prompt_for_retry,
    retry_voice_name,
)
from app.utils.voice_logging import log_voice_attempt
from app.services.voice_safety import (
    SAFE_PREVIEW_TEXT,
    SAFE_VOICE_DESCRIPTION,
    SAFE_VOICE_NAME,
    build_safe_preview_text,
    sanitize_voice_description,
    sanitize_voice_name,
)


async def cache_voice_library() -> int:
    """Fetch all ElevenLabs voices and cache in DB. Returns count cached."""
    elevenlabs = get_elevenlabs()
    supabase = get_supabase()

    response = await asyncio.to_thread(elevenlabs.voices.get_all)

    count = 0
    for voice in response.voices:
        try:
            labels = {}
            if voice.labels:
                for k, v in dict(voice.labels).items():
                    if isinstance(v, (str, int, float, bool)) or v is None:
                        labels[k] = v

            supabase.table("voice_library").upsert({
                "voice_id": voice.voice_id,
                "name": voice.name,
                "labels": labels,
                "preview_url": voice.preview_url,
                "category": voice.category,
                "description": (voice.description or "")[:1000],
            }).execute()
            count += 1
        except Exception as e:
            print(f"[voice_service] Failed to cache voice {voice.voice_id}: {e}")

    return count


async def get_cached_voices() -> List[dict]:
    """Return cached voice library."""
    supabase = get_supabase()
    result = supabase.table("voice_library").select("*").execute()
    return result.data or []


def build_voice_catalog_for_llm(voices: List[dict], limit: int = 100) -> str:
    """Compact catalog string for LLM prompts."""
    lines = []
    for v in voices[:limit]:
        labels = v.get("labels") or {}
        age = labels.get("age", "?")
        gender = labels.get("gender", "?")
        accent = labels.get("accent", "?")
        use_case = labels.get("use_case", "general")
        lines.append(
            f"VOICE_ID: {v['voice_id']} | Name: {v.get('name','?')} | "
            f"Age: {age} | Gender: {gender} | Accent: {accent} | Use: {use_case}"
        )
    return "\n".join(lines)


async def _create_previews_and_voice(
    elevenlabs,
    voice_name: str,
    description: str,
    sample: str,
) -> str:
    """Call ElevenLabs Voice Design API; returns voice_id."""
    if len(sample) < 100:
        sample = (sample + " " + ("This is a sample line for the voice preview. " * 5)).strip()
    sample = sample[:1000]

    previews = await asyncio.to_thread(
        elevenlabs.text_to_voice.create_previews,
        voice_description=description,
        text=sample,
    )

    if not previews or not getattr(previews, "previews", None):
        raise RuntimeError("Voice Design returned no previews")

    voice = await asyncio.to_thread(
        elevenlabs.text_to_voice.create_voice_from_preview,
        voice_name=voice_name[:80] or SAFE_VOICE_NAME,
        voice_description=description,
        generated_voice_id=previews.previews[0].generated_voice_id,
    )

    return voice.voice_id


def pick_library_voice_fallback(
    voices: List[dict],
    used_voice_ids: Set[str],
    *,
    gender: str = "other",
    estimated_age: str = "adult",
    exclude_voice_ids: Optional[Set[str]] = None,
) -> Optional[str]:
    """Pick an unused premade/library voice that roughly matches gender/age (not narrator default)."""
    exclude = exclude_voice_ids or set()
    candidates: list[tuple[int, str]] = []

    for v in voices:
        vid = v.get("voice_id")
        if not vid or vid in used_voice_ids or vid in exclude:
            continue
        labels = v.get("labels") or {}
        v_gender = str(labels.get("gender", "")).lower()
        v_age = str(labels.get("age", "")).lower()

        score = 0
        g = gender.lower()
        if g in ("male", "female") and v_gender == g:
            score += 2
        if estimated_age in ("child", "teen", "young_adult", "adult", "elderly"):
            age_map = {
                "child": ("child", "young"),
                "teen": ("young", "teen"),
                "young_adult": ("young", "middle aged"),
                "adult": ("middle aged", "adult"),
                "elderly": ("old", "elderly"),
            }
            if any(a in v_age for a in age_map.get(estimated_age, ())):
                score += 1
        candidates.append((score, vid))

    if not candidates:
        for v in voices:
            vid = v.get("voice_id")
            if vid and vid not in used_voice_ids and vid not in exclude:
                return vid
        return None

    candidates.sort(key=lambda x: (-x[0], x[1]))
    return candidates[0][1]


async def create_voice_from_design(
    name: str,
    prompt: str,
    sample_text: str,
    *,
    role: str = "supporting",
    estimated_age: str = "adult",
    gender: str = "other",
    character_id: str | None = None,
    max_attempts: int = 3,
) -> str:
    """Generate previews + create a permanent voice. Retries up to max_attempts with safer prompts."""
    elevenlabs = get_elevenlabs()
    max_attempts = max(1, min(max_attempts, 5))

    description = sanitize_voice_description(prompt)
    sample = build_safe_preview_text(role=role, estimated_age=estimated_age, gender=gender)
    voice_name = sanitize_voice_name(name, character_id)

    last_exc: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        desc = description if attempt == 1 else refine_prompt_for_retry(
            description, classify_voice_error(last_exc) if last_exc else VoiceErrorKind.UNKNOWN, attempt
        )
        vname = voice_name if attempt == 1 else retry_voice_name(voice_name, character_id, attempt)
        if attempt >= max_attempts and last_exc and classify_voice_error(last_exc) == VoiceErrorKind.BLOCKED:
            desc = SAFE_VOICE_DESCRIPTION
            vname = SAFE_VOICE_NAME
            sample = SAFE_PREVIEW_TEXT

        try:
            voice_id = await _create_previews_and_voice(elevenlabs, vname, desc, sample)
            log_voice_attempt(name, character_id, attempt, max_attempts, success=True)
            return voice_id
        except Exception as e:
            last_exc = e
            kind = classify_voice_error(e)
            log_voice_attempt(name, character_id, attempt, max_attempts, error_kind=kind, detail=str(e))
            if kind == VoiceErrorKind.RATE_LIMIT and attempt < max_attempts:
                await asyncio.sleep(min(2 ** attempt, 8))
                continue
            if attempt < max_attempts:
                description = desc
                if kind == VoiceErrorKind.DUPLICATE_NAME:
                    voice_name = vname
                continue
            break

    if last_exc:
        raise last_exc
    raise RuntimeError("Voice Design failed with no error detail")
