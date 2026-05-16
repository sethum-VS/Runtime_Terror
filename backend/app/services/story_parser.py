import json
import asyncio

from app.dependencies import get_gemini

STORY_PARSER_PROMPT = """You are a story analysis engine. Analyze the following story text and extract structured data.

OUTPUT FORMAT (valid JSON only, no markdown):
{
  "title": "Story title extracted from text",
  "characters": [
    {
      "character_id": "char_001",
      "name": "Character Name",
      "description": "Physical appearance and personality traits",
      "role": "protagonist|antagonist|supporting|narrator",
      "speaking_style": "formal|casual|childlike|gruff|poetic|etc",
      "estimated_age": "child|teen|young_adult|adult|elderly",
      "gender": "male|female|other"
    }
  ],
  "pages": [
    {
      "page_number": 1,
      "segments": [
        {"type": "narration", "text": "exact original narration text here"},
        {"type": "dialogue", "character_id": "char_001", "text": "exact dialogue text", "emotion": "neutral"}
      ]
    }
  ]
}

CRITICAL RULES:
1. Do NOT change, add, or remove ANY words from the original story text.
2. Preserve the EXACT original text in each segment's "text" field (excluding the surrounding quotation marks for dialogue).
3. Split pages at paragraph or sentence boundaries, NEVER mid-sentence.
4. Each page should contain roughly 800-1000 characters of story text.
5. Every piece of text from the story must appear in exactly one segment.
6. Valid emotions: neutral, happy, sad, angry, scared, excited, whispering, laughing, crying.
7. Always include a "narrator" character with character_id="narrator" for narration segments.
8. Dialogue detection: text inside quotation marks ("...") is dialogue; assign it to the speaking character.
9. If the speaker is unclear, use the previous character or the narrator.

STORY TEXT:
{story_text}
"""


async def parse_story(story_text: str) -> dict:
    """Parse story text into characters and pages using Gemini."""
    if not story_text or not story_text.strip():
        raise ValueError("Story text is empty")

    # Truncate extremely long stories to fit context (Gemini Flash supports 1M tokens, but be safe)
    max_chars = 200_000
    if len(story_text) > max_chars:
        story_text = story_text[:max_chars]

    prompt = STORY_PARSER_PROMPT.replace("{story_text}", story_text)

    gemini = get_gemini()
    response = await asyncio.to_thread(
        gemini.generate_content,
        prompt,
        generation_config={
            "temperature": 0.1,
            "response_mime_type": "application/json",
        },
    )

    try:
        result = json.loads(response.text)
    except json.JSONDecodeError as e:
        raise ValueError(f"LLM returned invalid JSON: {e}. Raw: {response.text[:500]}")

    if "characters" not in result:
        raise ValueError("Missing 'characters' in parser output")
    if "pages" not in result:
        raise ValueError("Missing 'pages' in parser output")
    if not result["pages"]:
        raise ValueError("No pages extracted from story")

    # Ensure narrator is in characters list
    char_ids = {c.get("character_id") for c in result["characters"]}
    if "narrator" not in char_ids:
        result["characters"].insert(0, {
            "character_id": "narrator",
            "name": "Narrator",
            "description": "Warm, theatrical storyteller voice",
            "role": "narrator",
            "speaking_style": "warm",
            "estimated_age": "adult",
            "gender": "other",
        })

    return result
