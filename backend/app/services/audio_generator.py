import asyncio
import base64
import io
from typing import Any, List

from elevenlabs.types import DialogueInput
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from app.dependencies import get_supabase, get_elevenlabs, elevenlabs_semaphore
from app.services.dialogue_mapper import map_dialogue_for_page
from app.services.chunker import smart_chunk
from app.config import get_settings

settings = get_settings()


def _to_dialogue_inputs(inputs: List[dict]) -> List[DialogueInput]:
    """Convert mapper output dicts to ElevenLabs DialogueInput models."""
    dialogue: List[DialogueInput] = []
    for inp in inputs:
        text = (inp.get("text") or "").strip()
        voice_id = (inp.get("voice_id") or "").strip()
        if text and voice_id:
            dialogue.append(DialogueInput(text=text, voice_id=voice_id))
    return dialogue


@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    retry=retry_if_exception_type(Exception),
    reraise=True,
)
async def _call_elevenlabs_dialogue(inputs: List[dict]) -> Any:
    """Call ElevenLabs Text-to-Dialogue with timestamps. Retries on errors."""
    elevenlabs = get_elevenlabs()
    if not hasattr(elevenlabs, "text_to_dialogue"):
        raise RuntimeError(
            "ElevenLabs SDK is too old for Text-to-Dialogue. "
            "Install elevenlabs>=2.47.0 (pip install -U 'elevenlabs>=2.47.0')."
        )

    dialogue_inputs = _to_dialogue_inputs(inputs)
    if not dialogue_inputs:
        raise ValueError("No valid dialogue inputs (text + voice_id required)")

    async with elevenlabs_semaphore:
        return await asyncio.to_thread(
            elevenlabs.text_to_dialogue.convert_with_timestamps,
            inputs=dialogue_inputs,
            output_format="mp3_44100_128",
        )


def _extract_audio_bytes(result: Any) -> bytes:
    """Extract MP3 bytes from various ElevenLabs response shapes."""
    for attr in ("audio_base64", "audio_base_64"):
        value = getattr(result, attr, None)
        if value:
            return base64.b64decode(value)

    if hasattr(result, "audio") and result.audio:
        audio = result.audio
        if isinstance(audio, (bytes, bytearray)):
            return bytes(audio)
        if isinstance(audio, str):
            try:
                return base64.b64decode(audio)
            except Exception:
                return b""
        try:
            return b"".join(audio)
        except Exception:
            return b""

    try:
        return b"".join(result)  # type: ignore
    except Exception:
        return b""


def _extract_alignment(result: Any) -> dict:
    """Pull alignment/timestamps off the result if present."""
    alignment = getattr(result, "alignment", None) or getattr(
        result, "normalized_alignment", None
    )
    if not alignment:
        return {}

    characters = getattr(alignment, "characters", None) or []
    starts = getattr(alignment, "character_start_times_seconds", None) or []
    ends = getattr(alignment, "character_end_times_seconds", None) or []

    return {
        "characters": list(characters),
        "character_start_times": list(starts),
        "character_end_times": list(ends),
    }


async def generate_page_audio(story_id: str, page_number: int) -> dict:
    """Full pipeline: map dialogue -> chunk -> generate -> upload -> save."""
    supabase = get_supabase()

    page_result = (
        supabase.table("story_pages")
        .select("*")
        .eq("story_id", story_id)
        .eq("page_number", page_number)
        .execute()
    )
    if not page_result.data:
        raise ValueError(f"Page {page_number} not found for story {story_id}")

    page = page_result.data[0]

    if page["status"] == "ready" and page.get("audio_url"):
        return {
            "status": "ready",
            "audio_url": page["audio_url"],
            "timestamps_json": page.get("timestamps_json"),
        }

    supabase.table("story_pages").update({"status": "generating"}).eq("id", page["id"]).execute()

    try:
        dialogue_inputs = await map_dialogue_for_page(story_id, page_number)
        chunks = smart_chunk(
            dialogue_inputs,
            max_chars=settings.elevenlabs_max_chars_per_request,
        )

        all_audio = io.BytesIO()
        all_timestamps: List[dict] = []
        total_offset = 0.0

        for i, chunk_inputs in enumerate(chunks):
            result = await _call_elevenlabs_dialogue(chunk_inputs)
            chunk_audio = _extract_audio_bytes(result)
            if chunk_audio:
                all_audio.write(chunk_audio)

            alignment = _extract_alignment(result)
            if alignment.get("characters"):
                shifted = {
                    "chunk_index": i,
                    "characters": alignment["characters"],
                    "character_start_times": [
                        t + total_offset for t in alignment["character_start_times"]
                    ],
                    "character_end_times": [
                        t + total_offset for t in alignment["character_end_times"]
                    ],
                }
                all_timestamps.append(shifted)

                if alignment["character_end_times"]:
                    total_offset = max(alignment["character_end_times"]) + 0.0

        audio_bytes = all_audio.getvalue()
        if not audio_bytes:
            raise RuntimeError("ElevenLabs returned no audio data")

        file_path = f"{story_id}/page_{page_number:03d}.mp3"

        try:
            supabase.storage.from_("story-audio").upload(
                path=file_path,
                file=audio_bytes,
                file_options={"content-type": "audio/mpeg", "upsert": "true"},
            )
        except Exception as e:
            err_msg = str(e).lower()
            if "exists" in err_msg or "duplicate" in err_msg:
                supabase.storage.from_("story-audio").update(
                    path=file_path,
                    file=audio_bytes,
                    file_options={"content-type": "audio/mpeg"},
                )
            else:
                raise

        audio_url = supabase.storage.from_("story-audio").get_public_url(file_path)
        if isinstance(audio_url, str):
            audio_url = audio_url.rstrip("?")

        char_count = sum(len(inp["text"]) for inp in dialogue_inputs)

        supabase.table("story_pages").update({
            "status": "ready",
            "dialogue_json": dialogue_inputs,
            "audio_url": audio_url,
            "timestamps_json": all_timestamps,
            "char_count": char_count,
            "generated_at": "now()",
        }).eq("id", page["id"]).execute()

        return {
            "status": "ready",
            "audio_url": audio_url,
            "timestamps_json": all_timestamps,
        }

    except Exception as e:
        supabase.table("story_pages").update({
            "status": "failed",
            "error_message": str(e)[:500],
        }).eq("id", page["id"]).execute()
        raise
