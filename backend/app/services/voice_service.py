import asyncio
from typing import List

from app.dependencies import get_supabase, get_elevenlabs


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
                # `labels` is a dict-like; copy primitive values only
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


async def create_voice_from_design(name: str, prompt: str, sample_text: str) -> str:
    """Generate previews + create a permanent voice. Returns voice_id."""
    elevenlabs = get_elevenlabs()

    sample = sample_text.strip()
    if len(sample) < 100:
        sample = (sample + " " + ("This is a sample line for the voice preview. " * 5)).strip()
    sample = sample[:1000]

    description = prompt.strip()
    if len(description) < 20:
        description = (description + " A clear, expressive narrator voice.")[:1000]
    if len(description) > 1000:
        description = description[:1000]

    previews = await asyncio.to_thread(
        elevenlabs.text_to_voice.create_previews,
        voice_description=description,
        text=sample,
    )

    if not previews or not getattr(previews, "previews", None):
        raise RuntimeError("Voice Design returned no previews")

    voice = await asyncio.to_thread(
        elevenlabs.text_to_voice.create_voice_from_preview,
        voice_name=name[:80] or "VoiceTale Character",
        voice_description=description,
        generated_voice_id=previews.previews[0].generated_voice_id,
    )

    return voice.voice_id
