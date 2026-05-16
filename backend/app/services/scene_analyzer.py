"""Scene analyzer — Gemini 2.5 Pro extracts the topic / mood / environment of a
story page and emits a cinematic prompt for Veo 3.1 Lite.

The scene is what the live background should portray while the narrator reads
the page (location, time-of-day, weather, dominant mood, key visual subjects).

We pass the *whole story* as global context (Gemini 2.5 Pro's 1M-token context
window easily accommodates this) so the model can keep style/world consistent
across pages — e.g. once we've established "Victorian London at dusk", later
pages won't suddenly switch to a desert.
"""
import asyncio
import json
from typing import Optional

from vertexai.generative_models import GenerationConfig

from app.config import get_settings
from app.dependencies import get_gemini_pro, get_supabase
from app.utils.json_utils import parse_llm_json

SCENE_ANALYZER_PROMPT = """You are a cinematography director analyzing a story page.

Identify the CURRENT scene (location, mood, environment, time, weather, key
visual subjects) at the moment described by THIS page. Use the rest of the
story only as background context for visual consistency.

OUTPUT: A single JSON object with these fields (no markdown, no commentary):
  - topic: short phrase (<= 60 chars) summarising what this page is about
  - mood: one of [calm, tense, mysterious, joyful, melancholy, ominous, romantic,
            wonderous, adventurous, scary, somber, triumphant, dreamlike, chaotic]
  - environment: short noun phrase ("dense pine forest at twilight",
            "marble palace hall", "abandoned subway tunnel")
  - time_of_day: one of [dawn, morning, midday, afternoon, dusk, night, unspecified]
  - weather: one of [clear, cloudy, rainy, stormy, snowy, foggy, windy, none]
  - visual_style: short cinematic style phrase
            ("storybook watercolor illustration", "Studio Ghibli anime",
             "Pixar 3D animation", "moody oil painting", "cinematic photoreal",
             "noir film", "soft pastel children's book", etc.)
            Choose what best fits the genre/tone of the story.
  - color_palette: 3-5 dominant colors as comma-separated names
            ("deep teal, gold, ivory, warm amber")
  - camera_motion: one of [Static Shot, Pan (left), Pan (right), Tilt (up),
            Tilt (down), Dolly (In), Dolly (Out), Zoom (In), Zoom (Out),
            Wide Shot, Establishing Shot, Aerial Shot, Drone Shot]
  - video_prompt: a single 2-4 sentence cinematic prompt for a video generator
            (Google Veo) that captures the environment AND mood AND visual_style
            of this scene. NO dialogue, NO captions, NO text overlays. Describe
            the SETTING and atmosphere — characters can be implied or shown
            from behind / silhouetted but never spoken about by name.
            ALWAYS prepend the visual_style at the start, e.g. "Storybook
            watercolor illustration of ..."
  - negative_prompt: short comma-separated list of things to avoid
            ("text, captions, subtitles, distorted faces, harsh shadows")

GLOBAL STORY CONTEXT (for style/world consistency only — do NOT base the
scene on these later events):
---
{story_context}
---

CURRENT PAGE {page_number} TEXT:
---
{page_text}
---

Return ONLY the JSON object.
"""

SCENE_SCHEMA = {
    "type": "object",
    "properties": {
        "topic": {"type": "string"},
        "mood": {"type": "string"},
        "environment": {"type": "string"},
        "time_of_day": {"type": "string"},
        "weather": {"type": "string"},
        "visual_style": {"type": "string"},
        "color_palette": {"type": "string"},
        "camera_motion": {"type": "string"},
        "video_prompt": {"type": "string"},
        "negative_prompt": {"type": "string"},
    },
    "required": [
        "topic",
        "mood",
        "environment",
        "video_prompt",
    ],
}


def _generation_config() -> GenerationConfig:
    cfg = get_settings()
    return GenerationConfig(
        temperature=0.4,
        max_output_tokens=min(cfg.gemini_pro_max_output_tokens, 8192),
        response_mime_type="application/json",
        response_schema=SCENE_SCHEMA,
    )


def _flatten_segments(segments: Optional[list]) -> str:
    if not segments:
        return ""
    parts = [str(seg.get("text", "")).strip() for seg in segments if seg.get("text")]
    return "\n".join(p for p in parts if p)


def _build_story_context(story_id: str, current_page: int, max_chars: int = 60_000) -> str:
    """Pull surrounding pages from Supabase to give Gemini 2.5 Pro global context.

    Gemini 2.5 Pro's 1M context easily fits long stories, but we cap aggressively
    to keep latency + cost reasonable — usually all pages of a typical kids' book.
    """
    supabase = get_supabase()
    pages = (
        supabase.table("story_pages")
        .select("page_number, raw_segments")
        .eq("story_id", story_id)
        .order("page_number")
        .execute()
    )
    rows = pages.data or []
    chunks: list[str] = []
    for row in rows:
        text = _flatten_segments(row.get("raw_segments"))
        if not text:
            continue
        marker = "<-- THIS PAGE" if row["page_number"] == current_page else ""
        chunks.append(f"[Page {row['page_number']}] {marker}\n{text}")
    joined = "\n\n".join(chunks)
    if len(joined) > max_chars:
        return joined[:max_chars] + "\n\n…(truncated for length)…"
    return joined


async def analyze_scene_for_page(story_id: str, page_number: int) -> dict:
    """Run Gemini 2.5 Pro and return scene metadata for a single page.

    Raises ValueError if no page text is available yet.
    """
    supabase = get_supabase()
    page_result = (
        supabase.table("story_pages")
        .select("raw_segments")
        .eq("story_id", story_id)
        .eq("page_number", page_number)
        .execute()
    )
    if not page_result.data:
        raise ValueError(f"Page {page_number} not found for story {story_id}")

    page_text = _flatten_segments(page_result.data[0].get("raw_segments"))
    if not page_text:
        raise ValueError(f"Page {page_number} has no text yet")

    story_context = _build_story_context(story_id, page_number)
    prompt = (
        SCENE_ANALYZER_PROMPT
        .replace("{story_context}", story_context or "(no extra context available)")
        .replace("{page_text}", page_text)
        .replace("{page_number}", str(page_number))
    )

    gemini_pro = get_gemini_pro()
    response = await asyncio.to_thread(
        gemini_pro.generate_content,
        prompt,
        generation_config=_generation_config(),
    )

    raw = (response.text or "").strip()
    if not raw:
        raise RuntimeError("Gemini 2.5 Pro returned empty scene analysis")

    try:
        scene = parse_llm_json(raw)
    except (json.JSONDecodeError, ValueError) as exc:
        raise RuntimeError(
            f"Gemini 2.5 Pro returned invalid JSON for scene analysis: {raw[:300]}"
        ) from exc

    return _normalize(scene)


def _normalize(scene: dict) -> dict:
    """Apply sensible defaults so downstream Veo prompt is always valid."""
    out = {
        "topic": (scene.get("topic") or "Story scene").strip()[:120],
        "mood": (scene.get("mood") or "calm").strip().lower()[:32],
        "environment": (scene.get("environment") or "unspecified environment").strip()[:200],
        "time_of_day": (scene.get("time_of_day") or "unspecified").strip().lower()[:32],
        "weather": (scene.get("weather") or "none").strip().lower()[:32],
        "visual_style": (
            scene.get("visual_style") or "storybook watercolor illustration"
        ).strip()[:200],
        "color_palette": (scene.get("color_palette") or "").strip()[:200],
        "camera_motion": (scene.get("camera_motion") or "Static Shot").strip()[:64],
        "video_prompt": (scene.get("video_prompt") or "").strip(),
        "negative_prompt": (
            scene.get("negative_prompt")
            or "text, captions, subtitles, watermarks, distorted faces, harsh shadows"
        ).strip()[:400],
    }
    if not out["video_prompt"]:
        # Fallback prompt synthesized from the structured fields.
        out["video_prompt"] = (
            f"{out['visual_style']} of {out['environment']}, "
            f"{out['time_of_day']} light, {out['weather']} weather. "
            f"Mood: {out['mood']}. Color palette: {out['color_palette'] or 'natural'}. "
            f"Camera: {out['camera_motion'].lower()}. No on-screen text."
        )
    return out
