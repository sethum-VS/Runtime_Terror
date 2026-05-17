import json
import asyncio
import re

from vertexai.generative_models import GenerationConfig

from app.dependencies import get_gemini
from app.utils.character_roles import normalize_character_role
from app.utils.json_utils import parse_llm_json

STORY_PARSER_PROMPT = """You are a story analysis engine. Analyze the following story text and extract structured data.

OUTPUT: A single JSON object with keys: title, characters, pages.

STRUCTURE:
- title: string
- characters: array of {{ character_id, name, description, role, speaking_style, estimated_age, gender }}
  - role MUST be exactly one of (lowercase): protagonist, antagonist, supporting, narrator
- pages: array of {{ page_number, segments, ambient_setting }}
  - ambient_setting: string (15-30 words) describing a SUBTLE MUSICAL ambient bed for audiobook narration — emotional tone, story genre feel, and instrumentation mood (e.g. soft piano pad, warm strings drone, sparse synth atmosphere). Instrumental only, no vocals, no drums, under dialogue. Example: "Melancholic slow piano and muted strings, intimate Victorian drama, gentle and distant, no percussion"
- segments: array of {{ type, text, character_id?, emotion? }}
  - type is "narration" or "dialogue"
  - For dialogue include character_id and emotion

CRITICAL RULES:
1. Do NOT change, add, or remove ANY words from the original story text in segment "text" fields.
2. Preserve EXACT original wording (no paraphrasing). Escape double quotes inside strings as \\".
3. Split into listening pages (~1500-2000 characters each, max 2200). Do NOT mirror PDF page count.
   A 12,000-character story should produce roughly 6-8 pages, NOT 3-4 huge chunks.
   Split at paragraph boundaries, NEVER mid-sentence.
4. Every piece of story text must appear in exactly one segment.
5. Valid emotions: neutral, happy, sad, angry, scared, excited, whispering, laughing, crying.
6. Always include character_id="narrator" for narration segments.
7. Keep character descriptions under 120 characters (acoustic/personality only, no plot spoilers).
8. Use character_id values like narrator, char_001, char_002 (snake_case, no spaces).
9. Return ONLY valid JSON. No markdown, no comments, no trailing commas.

STORY TEXT:
{story_text}
"""

STORY_PARSE_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "characters": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "character_id": {"type": "string"},
                    "name": {"type": "string"},
                    "description": {"type": "string"},
                    "role": {"type": "string"},
                    "speaking_style": {"type": "string"},
                    "estimated_age": {"type": "string"},
                    "gender": {"type": "string"},
                },
                "required": ["character_id", "name", "role"],
            },
        },
        "pages": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "page_number": {"type": "integer"},
                    "segments": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "type": {"type": "string"},
                                "text": {"type": "string"},
                                "character_id": {"type": "string"},
                                "emotion": {"type": "string"},
                            },
                            "required": ["type", "text"],
                        },
                    },
                    "ambient_setting": {"type": "string"},
                },
                "required": ["page_number", "segments"],
            },
        },
    },
    "required": ["title", "characters", "pages"],
}

PARSE_GENERATION_CONFIG = GenerationConfig(
    temperature=0.1,
    max_output_tokens=65536,
    response_mime_type="application/json",
    response_schema=STORY_PARSE_SCHEMA,
)


async def parse_story(story_text: str) -> dict:
    """Parse story text into characters and pages using Gemini."""
    if not story_text or not story_text.strip():
        raise ValueError("Story text is empty")

    max_chars = 200_000
    if len(story_text) > max_chars:
        story_text = story_text[:max_chars]

    last_error: Exception | None = None
    raw_preview = ""

    for attempt in range(3):
        extra = ""
        if attempt > 0:
            extra = (
                "\n\nREMINDER: Return COMPLETE valid JSON. "
                "Keep descriptions short. Escape quotes in text fields."
            )
        prompt = STORY_PARSER_PROMPT.replace("{story_text}", story_text) + extra

        gemini = get_gemini()
        response = await asyncio.to_thread(
            gemini.generate_content,
            prompt,
            generation_config=PARSE_GENERATION_CONFIG,
        )

        raw_preview = (response.text or "")[:500]
        try:
            result = parse_llm_json(response.text or "")
            return _validate_and_normalize(result)
        except (json.JSONDecodeError, ValueError) as e:
            last_error = e
            print(f"[story_parser] JSON parse attempt {attempt + 1} failed: {e}")

    # Deterministic fallback so short stories still work
    print("[story_parser] Using fallback paragraph parser after LLM JSON failures")
    try:
        return _validate_and_normalize(_fallback_parse(story_text))
    except Exception as fallback_err:
        raise ValueError(
            f"LLM returned invalid JSON: {last_error}. Raw: {raw_preview}"
        ) from fallback_err


def _validate_and_normalize(result: dict) -> dict:
    if "characters" not in result:
        raise ValueError("Missing 'characters' in parser output")
    if "pages" not in result:
        raise ValueError("Missing 'pages' in parser output")
    if not result["pages"]:
        raise ValueError("No pages extracted from story")

    char_ids = {c.get("character_id") for c in result["characters"]}
    if "narrator" not in char_ids:
        result["characters"].insert(0, {
            "character_id": "narrator",
            "name": "Narrator",
            "description": "Warm storyteller voice for narration",
            "role": "narrator",
            "speaking_style": "warm",
            "estimated_age": "adult",
            "gender": "other",
        })

    for char in result["characters"]:
        char["role"] = normalize_character_role(
            char.get("role"),
            character_id=char.get("character_id"),
        )

    # Ensure narration segments reference narrator
    for page in result["pages"]:
        for seg in page.get("segments") or []:
            if seg.get("type") == "narration" and not seg.get("character_id"):
                seg["character_id"] = "narrator"
            if seg.get("type") == "dialogue" and not seg.get("emotion"):
                seg["emotion"] = "neutral"

    result["pages"] = _rebudget_pages_if_needed(result["pages"])
    return result


TARGET_PAGE_CHARS = 1750
MAX_PAGE_CHARS = 2200


def _page_char_count(page: dict) -> int:
    return sum(len(seg.get("text", "")) for seg in page.get("segments") or [])


def _rebudget_pages_if_needed(pages: list[dict]) -> list[dict]:
    """Re-split when the LLM returns too few oversized pages (common with long stories)."""
    if not pages:
        return pages

    total_chars = sum(_page_char_count(p) for p in pages)
    if total_chars < 500:
        return pages

    avg_chars = total_chars / len(pages)
    expected_pages = max(1, round(total_chars / TARGET_PAGE_CHARS))
    too_few_pages = len(pages) < expected_pages * 0.6
    pages_too_long = avg_chars > MAX_PAGE_CHARS or any(
        _page_char_count(p) > MAX_PAGE_CHARS for p in pages
    )

    if not too_few_pages and not pages_too_long:
        return pages

    print(
        f"[story_parser] Re-splitting {len(pages)} pages "
        f"(avg {int(avg_chars)} chars) -> target ~{expected_pages} pages"
    )

    flat_segments: list[dict] = []
    for page in pages:
        for seg in page.get("segments") or []:
            text = (seg.get("text") or "").strip()
            if text:
                flat_segments.append(dict(seg))

    if not flat_segments:
        return pages

    new_pages: list[dict] = []
    bucket: list[dict] = []
    char_count = 0
    page_num = 1

    for seg in flat_segments:
        text_len = len(seg.get("text", ""))
        if char_count + text_len > TARGET_PAGE_CHARS and bucket:
            new_pages.append({
                "page_number": page_num,
                "segments": bucket,
                "ambient_setting": "",
            })
            page_num += 1
            bucket = []
            char_count = 0
        bucket.append(seg)
        char_count += text_len

    if bucket:
        new_pages.append({
            "page_number": page_num,
            "segments": bucket,
            "ambient_setting": "",
        })

    for i, page in enumerate(new_pages, start=1):
        page["page_number"] = i

    return new_pages


def _fallback_parse(story_text: str) -> dict:
    """Rule-based parser when LLM JSON fails. Preserves full text, splits by paragraphs."""
    if story_text.lstrip().startswith("%PDF"):
        raise ValueError("Story text is not valid markdown")

    lines = story_text.strip().splitlines()
    title = "Untitled Story"
    body_start = 0
    for i, line in enumerate(lines):
        stripped = line.strip().strip('"').strip()
        if not stripped or stripped.startswith("--") or stripped.isdigit():
            continue
        if len(stripped) < 120 and not stripped.lower().startswith("jeffrey"):
            title = stripped
            body_start = i + 1
            break
        if stripped.lower().startswith("jeffrey"):
            body_start = i + 1
            continue

    body = "\n".join(lines[body_start:]).strip()
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip()]
    if not paragraphs:
        paragraphs = [body] if body else [story_text.strip()]

    characters = [
        {
            "character_id": "narrator",
            "name": "Narrator",
            "description": "Story narrator",
            "role": "narrator",
            "speaking_style": "warm",
            "estimated_age": "adult",
            "gender": "other",
        },
        {
            "character_id": "char_roger",
            "name": "Roger",
            "description": "Supporting character",
            "role": "supporting",
            "speaking_style": "casual",
            "estimated_age": "adult",
            "gender": "male",
        },
    ]

    pages: list[dict] = []
    page_segments: list[dict] = []
    char_count = 0
    page_num = 1
    target_chars = 1750

    for para in paragraphs:
        if char_count + len(para) > target_chars and page_segments:
            pages.append({
                "page_number": page_num,
                "segments": page_segments,
                "ambient_setting": "",
            })
            page_num += 1
            page_segments = []
            char_count = 0

        seg_type = "narration"
        char_id = "narrator"
        emotion = "neutral"

        # Simple dialogue: paragraph is mostly quoted speech
        if para.startswith('"') or (para.count('"') >= 2 and len(para) < 300):
            seg_type = "dialogue"
            char_id = "char_roger"

        page_segments.append({
            "type": seg_type,
            "text": para,
            "character_id": char_id,
            "emotion": emotion,
        })
        char_count += len(para)

    if page_segments:
        pages.append({
            "page_number": page_num,
            "segments": page_segments,
            "ambient_setting": "",
        })

    return {
        "title": title[:200],
        "characters": characters,
        "pages": pages,
    }
