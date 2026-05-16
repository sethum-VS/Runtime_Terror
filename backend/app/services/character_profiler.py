import asyncio
import json

from app.dependencies import get_gemini, get_supabase
from app.services.voice_service import (
    get_cached_voices,
    build_voice_catalog_for_llm,
    create_voice_from_design,
)
from app.services.voice_safety import build_safe_preview_text

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

Voice Design prompts MUST be 20-1000 characters and describe ONLY acoustic qualities:
"A [age descriptor] [gender] voice with a [tone quality] tone. [Speaking pace]. [Distinctive vocal quality]."

ELEVENLABS VOICE DESIGN SAFETY (required):
- Describe ONLY pitch, pace, tone, warmth, clarity, accent—never plot, relationships, or backstory.
- FORBIDDEN in voice_design_prompt: violence, weapons, threats, sexual or romantic content, slurs,
  hate, self-harm, drugs, impersonation of real people, or sensitive descriptions of minors.
- Do NOT reference story events, character relationships, twins, pregnancy, or provocative traits.
- Prefer library_match whenever any catalog voice is a reasonable fit (saves API calls).
- For narrator role: ALWAYS use library_match with a warm narrator voice from the catalog.

GOOD Voice Design prompt examples:
- "A warm adult female voice with a calm, measured pace and gentle tone. Clear and expressive, suited for audiobook narration."
- "A young adult male voice with a bright, energetic tone. Speaks at a moderate pace with friendly clarity."
- "An elderly male voice with a deep, steady tone. Slow pace, warm and reassuring."

BAD examples (will be blocked):
- "Twin children who sound seductive..." or anything tied to story events or relationships.

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
- Always assign a narrator voice via library_match when possible.
- Voice Design prompts must be 20-1000 characters and acoustic-only.
- Match speaking_style to vocal tone (e.g. gruff -> deeper tone), not story content.
- Prefer library_match when a good fit exists.
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
    char_by_id = {c["character_id"]: c for c in characters}

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
            char_meta = char_by_id.get(char_id, {})
            try:
                voice_id = await create_voice_from_design(
                    name=assignment.get("name", "VoiceTale Character"),
                    prompt=design_prompt,
                    sample_text=build_safe_preview_text(
                        role=char_meta.get("role", "supporting"),
                        estimated_age=char_meta.get("estimated_age", "adult"),
                        gender=char_meta.get("gender", "other"),
                    ),
                    role=char_meta.get("role", "supporting"),
                    estimated_age=char_meta.get("estimated_age", "adult"),
                    gender=char_meta.get("gender", "other"),
                    character_id=char_id,
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


