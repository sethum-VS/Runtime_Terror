import asyncio
import json

from app.dependencies import get_gemini, get_supabase
from app.services.voice_service import (
    get_cached_voices,
    build_voice_catalog_for_llm,
    create_voice_from_design,
)

# Default fallback voice when Voice Design fails (premade ElevenLabs voice "George")
DEFAULT_FALLBACK_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"


CHARACTER_PROFILER_PROMPT = """You are a voice casting director for an audiobook production.

Given a list of story characters and a voice library catalog, assign the best voice to each character.

CHARACTERS FROM STORY:
{characters_json}

AVAILABLE VOICE LIBRARY (from our database):
{voice_catalog}

FOR EACH CHARACTER, decide:
A) "library_match" - if a voice in the catalog fits well, use its VOICE_ID
B) "voice_design" - if no good match exists, write a Voice Design prompt

Voice Design prompts MUST be 20-1000 characters and follow this structure:
"A [age descriptor] [gender] voice with a [tone quality] tone. [Speaking pace]. [Distinctive quality]. [Character trait reflected in voice]."

GOOD Voice Design prompt examples:
- "A massive evil ogre speaking at a quick pace. He has a silly and resonant tone."
- "A young curious girl, around 8 years old. Bright, energetic, and slightly mischievous. She speaks quickly with wonder in her voice."
- "An elderly wise woman with a calm, measured pace. Warm and comforting, like a grandmother telling stories by the fireplace."

OUTPUT (valid JSON only, no markdown):
{
  "assignments": [
    {
      "character_id": "char_001",
      "name": "Character Name",
      "voice_strategy": "library_match",
      "library_voice_id": "actual_voice_id_from_catalog",
      "voice_design_prompt": null,
      "reason": "Why this voice fits"
    },
    {
      "character_id": "char_002",
      "name": "Character Name",
      "voice_strategy": "voice_design",
      "library_voice_id": null,
      "voice_design_prompt": "A young boy with a squeaky, excited voice...",
      "reason": "No matching child voice in library"
    }
  ]
}

RULES:
- Always assign a narrator voice (clear, warm, theatrical narrator from library if possible).
- Voice Design prompts must be 20-1000 characters.
- Match character personality to voice qualities.
- Prefer library_match when a good fit exists (saves API calls).
- Distinct characters should get distinct voices.
"""


async def profile_characters_and_assign_voices(story_id: str):
    """Profile characters, match/create voices, save voice_id to DB per character."""
    supabase = get_supabase()

    chars_result = supabase.table("characters").select("*").eq("story_id", story_id).execute()
    characters = chars_result.data or []
    if not characters:
        raise ValueError("No characters found for story")

    voices = await get_cached_voices()
    if not voices:
        # Voice library not cached -- attempt to cache now
        from app.services.voice_service import cache_voice_library
        try:
            await cache_voice_library()
            voices = await get_cached_voices()
        except Exception as e:
            print(f"[profiler] Could not refresh voice library: {e}")

    catalog = build_voice_catalog_for_llm(voices)

    chars_for_prompt = [
        {
            "character_id": c["character_id"],
            "name": c["name"],
            "description": c.get("description", ""),
            "role": c.get("role", "supporting"),
            "speaking_style": c.get("speaking_style", "neutral"),
            "estimated_age": c.get("estimated_age", "adult"),
            "gender": c.get("gender", "other"),
        }
        for c in characters
    ]

    prompt = (
        CHARACTER_PROFILER_PROMPT
        .replace("{characters_json}", json.dumps(chars_for_prompt, indent=2))
        .replace("{voice_catalog}", catalog or "(empty - use voice_design for all characters)")
    )

    gemini = get_gemini()
    response = await asyncio.to_thread(
        gemini.generate_content,
        prompt,
        generation_config={
            "temperature": 0.2,
            "response_mime_type": "application/json",
        },
    )

    try:
        result = json.loads(response.text)
    except json.JSONDecodeError as e:
        raise ValueError(f"Profiler returned invalid JSON: {e}")

    valid_voice_ids = {v["voice_id"] for v in voices}

    for assignment in result.get("assignments", []):
        char_id = assignment.get("character_id")
        if not char_id:
            continue

        voice_id = None
        strategy = assignment.get("voice_strategy")

        if strategy == "library_match":
            candidate = assignment.get("library_voice_id")
            if candidate and candidate in valid_voice_ids:
                voice_id = candidate
            else:
                # Fallback if LLM hallucinated a voice_id
                voice_id = DEFAULT_FALLBACK_VOICE_ID
                strategy = "library_match"

        elif strategy == "voice_design":
            design_prompt = assignment.get("voice_design_prompt") or ""
            sample = _get_sample_dialogue(story_id, char_id, assignment.get("name", "Character"))
            try:
                voice_id = await create_voice_from_design(
                    name=assignment.get("name", "VoiceTale Character"),
                    prompt=design_prompt,
                    sample_text=sample,
                )
            except Exception as e:
                print(f"[profiler] Voice Design failed for {assignment.get('name')}: {e}")
                voice_id = DEFAULT_FALLBACK_VOICE_ID
                strategy = "library_match"

        else:
            voice_id = DEFAULT_FALLBACK_VOICE_ID
            strategy = "library_match"

        supabase.table("characters").update({
            "voice_strategy": strategy,
            "voice_id": voice_id,
            "voice_design_prompt": assignment.get("voice_design_prompt"),
        }).eq("story_id", story_id).eq("character_id", char_id).execute()

    # Ensure every character has a voice_id (assign default if LLM missed any)
    chars_after = supabase.table("characters").select("*").eq("story_id", story_id).execute()
    for c in (chars_after.data or []):
        if not c.get("voice_id"):
            supabase.table("characters").update({
                "voice_strategy": "library_match",
                "voice_id": DEFAULT_FALLBACK_VOICE_ID,
            }).eq("id", c["id"]).execute()


def _get_sample_dialogue(story_id: str, char_id: str, fallback_name: str) -> str:
    """Pull a sample dialogue line for Voice Design preview."""
    supabase = get_supabase()
    pages = (
        supabase.table("story_pages")
        .select("raw_segments")
        .eq("story_id", story_id)
        .order("page_number")
        .limit(5)
        .execute()
    )
    for page in (pages.data or []):
        for seg in (page.get("raw_segments") or []):
            if seg.get("character_id") == char_id and seg.get("type") == "dialogue":
                text = (seg.get("text") or "").strip()
                if len(text) >= 30:
                    return text[:500]

    return (
        f"Hello, my name is {fallback_name}. "
        "Let me tell you a tale of wonder, mystery, and adventure that begins long ago."
    )
