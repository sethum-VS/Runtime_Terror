import asyncio
import json
from typing import List

from app.dependencies import get_gemini, get_supabase


DIALOGUE_MAPPER_PROMPT = """You are an audio dialogue enhancer for ElevenLabs Text-to-Dialogue API.

Given story segments with character information, create the ElevenLabs inputs[] array with audio tags.

VOICE ASSIGNMENTS:
{voice_map}

RAW SEGMENTS FOR THIS PAGE:
{segments_json}

OUTPUT (valid JSON only, no markdown):
{
  "inputs": [
    {"voice_id": "actual_voice_id", "text": "[audio tag] exact original text with emphasis"},
    {"voice_id": "actual_voice_id", "text": "narration text as-is"}
  ]
}

RULES:
1. Do NOT alter any words from the original text.
2. DO add audio tags in [square brackets] before/after dialogue lines, sparingly.
3. DO add emphasis via CAPITALS and punctuation (! ? ...) where natural.
4. Tags must be AUDITORY only.
5. Use the actual voice_id from VOICE ASSIGNMENTS, NEVER use character_id.
6. For narration segments, use the narrator's voice_id.

AVAILABLE AUDIO TAGS:
Emotions: [happy], [sad], [excited], [angry], [whispers], [scared], [sarcastic], [curious], [cheerfully]
Non-verbal: [laughs], [sighs], [gasps], [clears throat], [crying], [stuttering], [chuckles]
Delivery: [speaks firmly], [speaks slowly], [speaks softly], [cautiously], [dramatically]

DO NOT use non-auditory tags like [standing], [grinning], [pacing], [music].

ELEVENLABS SAFETY:
- Audio tags must be family-friendly and auditory only.
- Do NOT use tags implying violence, sexual content, harassment, or non-auditory actions.

Output the final inputs[] in the same order as the raw segments. Each segment becomes one input.
"""


async def map_dialogue_for_page(story_id: str, page_number: int) -> List[dict]:
    """Enhance a page's raw segments with audio tags + voice_ids."""
    supabase = get_supabase()

    page = (
        supabase.table("story_pages")
        .select("raw_segments")
        .eq("story_id", story_id)
        .eq("page_number", page_number)
        .execute()
    )
    if not page.data or not page.data[0].get("raw_segments"):
        raise ValueError(f"No raw segments for page {page_number}")

    raw_segments = page.data[0]["raw_segments"]

    chars = (
        supabase.table("characters")
        .select("character_id, name, voice_id")
        .eq("story_id", story_id)
        .execute()
    )
    char_records = chars.data or []
    voice_map = {c["character_id"]: c["voice_id"] for c in char_records if c.get("voice_id")}

    if not voice_map:
        raise ValueError("No voice_ids assigned to characters yet")

    narrator_voice = voice_map.get("narrator") or next(iter(voice_map.values()))

    voice_map_for_prompt = {
        c["character_id"]: {"name": c["name"], "voice_id": c["voice_id"]}
        for c in char_records
        if c.get("voice_id")
    }

    prompt = (
        DIALOGUE_MAPPER_PROMPT
        .replace("{voice_map}", json.dumps(voice_map_for_prompt, indent=2))
        .replace("{segments_json}", json.dumps(raw_segments, indent=2))
    )

    gemini = get_gemini()
    response = await asyncio.to_thread(
        gemini.generate_content,
        prompt,
        generation_config={
            "temperature": 0.3,
            "response_mime_type": "application/json",
        },
    )

    try:
        result = json.loads(response.text)
    except json.JSONDecodeError:
        # Fallback: build inputs directly without LLM enhancement
        return _build_fallback_inputs(raw_segments, voice_map, narrator_voice)

    inputs = result.get("inputs") or []
    validated: List[dict] = []
    valid_voice_ids = set(voice_map.values())

    for inp in inputs:
        voice_id = inp.get("voice_id") or ""
        text = (inp.get("text") or "").strip()
        if not text:
            continue

        # If LLM returned a character_id instead of voice_id, map it
        if voice_id in voice_map:
            voice_id = voice_map[voice_id]

        # Fallback to narrator if voice_id is invalid
        if voice_id not in valid_voice_ids:
            voice_id = narrator_voice

        validated.append({"voice_id": voice_id, "text": text})

    if not validated:
        return _build_fallback_inputs(raw_segments, voice_map, narrator_voice)

    return validated


def _build_fallback_inputs(raw_segments: List[dict], voice_map: dict, narrator_voice: str) -> List[dict]:
    """Build inputs directly from raw segments without LLM enhancement."""
    inputs: List[dict] = []
    for seg in raw_segments:
        text = (seg.get("text") or "").strip()
        if not text:
            continue
        if seg.get("type") == "dialogue":
            char_id = seg.get("character_id") or "narrator"
            voice_id = voice_map.get(char_id, narrator_voice)
        else:
            voice_id = narrator_voice
        inputs.append({"voice_id": voice_id, "text": text})
    return inputs
