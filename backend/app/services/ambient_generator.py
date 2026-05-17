import asyncio
import json
import logging
import re
from typing import List

from app.config import get_settings
from app.dependencies import get_supabase, get_elevenlabs, get_gemini, elevenlabs_semaphore

logger = logging.getLogger(__name__)

settings = get_settings()

_ambient_locks: dict[tuple[str, int], asyncio.Lock] = {}

VIBE_ANALYSIS_PROMPT = """You are a film-score composer choosing LOOPING MUSICAL AMBIENT beds for an audiobook. Narration plays on top — music must be emotional, cinematic, calm, and quiet (not distracting).

### Musical atmosphere (from parser)
{setting}

### Story segments on this page (in order)
{segments_json}

### Task
Identify 1-2 mood zones (max 2). Prefer ONE zone unless emotion or scene clearly shifts (e.g. calm reflection → confrontation).

For EACH zone return:
- "label": 1-3 words (e.g. "Tender Memory", "Rising Tension")
- "prompt": draft musical ambient description (20-35 words) tied to what happens in that zone
- "start_segment": first segment index (0-based)
- "end_segment": last segment index (inclusive)

### Musical ambient rules (critical)
- CALM TYPE BEAT: the bed must always feel calm, soft, and restrained. You CAN express any emotion (joy, dread, melancholy, romance, tension, wonder) — but ALWAYS through gentle harmony, texture, and dynamics, NEVER through hard beats, driving rhythm, or loud percussion. Think "calm cinematic underscore" even for intense feelings.
- INSTRUMENTAL ONLY: soft pads, drones, atmospheric underscore — like a gentle film score bed
- Match story mood from segment emotions and text, keeping the calm character intact:
  - sad / melancholic → slow minor piano, sparse strings, soft synth pad
  - tense / scared → low calm pulsing drone, dissonant soft strings, dark ambient texture (NO hard beats)
  - happy / warm → major key soft piano or acoustic guitar harmonics, light strings wash
  - romantic → warm legato strings pad, soft piano chords
  - mysterious → ambient synth pad, subtle low bells, airy texture
  - action (rare) → still calm slow underscore, NOT percussion-heavy — at most a very soft, low rhythmic pulse if absolutely needed
- Tempo: slow (60-80 bpm feel), low dynamics, no sudden changes, no hard hits
- NO vocals/choir/lyrics, NO drums or percussion, NO hard beats, NO catchy lead melody, NO EDM, NO trap, NO trailer hits, NO build-ups or drops
- NO environmental SFX focus (rain, crowds, traffic) unless blended very quietly under the music
- Genre-appropriate: period drama → piano/strings; fantasy → ethereal pads; modern → minimal synth ambient

Return valid JSON array only.

Example:
[
  {{"label": "Quiet Grief", "prompt": "Slow melancholic ambient piano with soft distant string pad, minor key, intimate audiobook underscore, very gentle and sparse", "start_segment": 0, "end_segment": 4}}
]
"""

REFINE_SFX_PROMPT = """Turn this into a final ElevenLabs prompt for a LOOPING MUSICAL AMBIENT track (instrumental underscore under audiobook narration).

Page musical atmosphere: {setting}

Story excerpt for this section:
{excerpt}

Draft: {draft}

Write ONE prompt (25-45 words). Requirements:
- CALM TYPE BEAT: the track must always feel calm and restrained. Emotions are fine (joy, sadness, romance, tension, dread, wonder), but expressed through soft harmony, texture, and dynamics — NEVER through hard beats or driving percussion.
- Describe MUSICAL ambient: pads, drones, soft piano, strings, synth atmosphere, guitar harmonics — pick what fits the excerpt
- Must match emotional arc in the excerpt (not generic epic music), while keeping a calm character
- Slow, soft, cinematic, seamless loop, low dynamics under spoken voice
- Say "instrumental", "ambient music", "underscore", or "film score bed"; you may also say "calm" explicitly
- NO vocals, NO drums/percussion, NO hard beats, NO loud brass, NO drops, NO build-ups, NO sound effects as the main element

Return ONLY the prompt string, no quotes."""


def _extract_page_context(raw_segments: list) -> tuple[str, str]:
    texts = []
    emotions = set()
    for seg in raw_segments:
        if not isinstance(seg, dict):
            continue
        text = seg.get("text", "").strip()
        if text:
            texts.append(text)
        emotion = seg.get("emotion", "")
        if emotion and emotion != "neutral":
            emotions.add(emotion)
    page_text = " ".join(texts)[:3000]
    emotion_str = ", ".join(sorted(emotions)) if emotions else "neutral"
    return page_text, emotion_str


def _zone_excerpt(raw_segments: list, zone: dict) -> str:
    start = int(zone.get("start_segment", 0))
    end = int(zone.get("end_segment", start))
    parts: list[str] = []
    for i, seg in enumerate(raw_segments):
        if not isinstance(seg, dict) or i < start or i > end:
            continue
        text = (seg.get("text") or "").strip()
        if not text:
            continue
        emotion = seg.get("emotion", "neutral")
        speaker = seg.get("character_id", "narrator")
        seg_type = seg.get("type", "narration")
        parts.append(f"[{seg_type} {speaker} {emotion}] {text[:400]}")
    return "\n".join(parts)[:2000]


def _compute_start_fractions(raw_segments: list, zones: list[dict]) -> list[float]:
    seg_lengths = []
    for seg in raw_segments:
        if isinstance(seg, dict):
            seg_lengths.append(len(seg.get("text", "")))
        else:
            seg_lengths.append(0)

    total_chars = sum(seg_lengths) or 1
    cumulative = [0.0]
    running = 0
    for length in seg_lengths:
        running += length
        cumulative.append(running / total_chars)

    fractions = []
    for zone in zones:
        start_seg = zone.get("start_segment", 0)
        start_seg = max(0, min(start_seg, len(cumulative) - 1))
        fractions.append(round(cumulative[start_seg], 4))

    return fractions


def _ensure_music_ambient_prompt(prompt: str) -> str:
    p = (prompt or "").strip()
    if not p:
        return (
            "Calm instrumental ambient music bed, slow piano and warm string pad, "
            "cinematic underscore for audiobook, gentle seamless loop, no vocals, no drums, no hard beats"
        )
    lower = p.lower()
    if not any(
        w in lower
        for w in (
            "music",
            "musical",
            "instrumental",
            "piano",
            "strings",
            "pad",
            "drone",
            "ambient",
            "underscore",
            "score",
        )
    ):
        p = f"Calm instrumental ambient music, {p}"
    if not any(w in lower for w in ("calm", "gentle", "soft", "slow")):
        p = f"Calm and gentle, {p}"
    if "vocal" not in lower:
        p = f"{p}, no vocals"
    if not any(w in lower for w in ("drum", "percussion", "beat")):
        p = f"{p}, no drums, no hard beats"
    elif "no hard beat" not in lower and "no drum" not in lower:
        p = f"{p}, no hard beats"
    if "loop" not in lower and "continuous" not in lower:
        p = f"{p}, seamless looping underscore"
    return p[:500]


async def _infer_setting(raw_segments: list) -> str:
    page_text, emotions = _extract_page_context(raw_segments)
    if not page_text.strip():
        return ""

    gemini = get_gemini()
    prompt = f"""You compose subtle MUSICAL ambient beds for audiobook narration (instrumental underscore). The bed must always be a CALM TYPE BEAT — emotional but never hard-hitting.

From this page, describe the musical mood in 15-30 words:
- Core emotion (melancholy, tension, wonder, warmth, dread, hope) — emotions OK, but expressed calmly
- Suggested instruments (soft piano, string pad, synth drone, guitar harmonics, etc.)
- Genre/period feel if obvious (Victorian drama, fantasy, noir, contemporary)
- Tempo and energy: slow, gentle, calm, low dynamics — must sit UNDER spoken voice
- Instrumental only — no vocals, no drums, no hard beats

Character emotions on page: {emotions}

Story text:
{page_text[:2500]}

Return ONLY the description string."""

    response = await asyncio.to_thread(
        gemini.generate_content,
        prompt,
        generation_config={"temperature": 0.35, "max_output_tokens": 200},
    )
    return (response.text or "").strip().strip('"')


async def _analyze_vibes(setting: str, raw_segments: list) -> list[dict]:
    segments_for_prompt = []
    for i, seg in enumerate(raw_segments):
        if not isinstance(seg, dict):
            continue
        segments_for_prompt.append({
            "index": i,
            "type": seg.get("type", "narration"),
            "text": (seg.get("text", ""))[:500],
            "emotion": seg.get("emotion", "neutral"),
            "character_id": seg.get("character_id", "narrator"),
        })

    if not segments_for_prompt:
        return [{
            "label": "Ambience",
            "prompt": setting or "Soft instrumental ambient piano and string pad, gentle underscore",
            "start_segment": 0,
            "end_segment": 0,
        }]

    gemini = get_gemini()
    prompt = (
        VIBE_ANALYSIS_PROMPT
        .replace("{setting}", setting or "(infer from segments)")
        .replace("{segments_json}", json.dumps(segments_for_prompt, indent=2)[:6000])
    )

    response = await asyncio.to_thread(
        gemini.generate_content,
        prompt,
        generation_config={
            "temperature": 0.25,
            "response_mime_type": "application/json",
        },
    )

    try:
        zones = json.loads(response.text or "[]")
    except json.JSONDecodeError:
        zones = []

    if isinstance(zones, dict):
        zones = zones.get("zones", [zones])
    if not isinstance(zones, list) or not zones:
        zones = [{
            "label": "Ambience",
            "prompt": setting or "Soft instrumental ambient piano and string pad, gentle underscore",
            "start_segment": 0,
            "end_segment": len(segments_for_prompt) - 1,
        }]

    for zone in zones:
        if "prompt" not in zone or not zone["prompt"]:
            zone["prompt"] = setting or "Soft instrumental ambient piano and string pad, gentle underscore"
        if "label" not in zone or not zone["label"]:
            zone["label"] = "Ambience"
        end = len(segments_for_prompt) - 1
        zone["start_segment"] = max(0, min(int(zone.get("start_segment", 0)), end))
        zone["end_segment"] = max(zone["start_segment"], min(int(zone.get("end_segment", end)), end))

    if len(zones) > 2:
        zones = zones[:2]

    return zones


async def _refine_sfx_prompt(
    setting: str,
    zone: dict,
    raw_segments: list,
) -> str:
    excerpt = _zone_excerpt(raw_segments, zone)
    draft = (zone.get("prompt") or setting or "").strip()

    gemini = get_gemini()
    prompt = (
        REFINE_SFX_PROMPT
        .replace("{setting}", setting or "(not specified)")
        .replace("{excerpt}", excerpt or draft)
        .replace("{draft}", draft)
    )

    try:
        response = await asyncio.to_thread(
            gemini.generate_content,
            prompt,
            generation_config={"temperature": 0.2, "max_output_tokens": 150},
        )
        refined = (response.text or "").strip().strip('"').strip("'")
        refined = re.sub(r"\s+", " ", refined)
        if len(refined) >= 12:
            return _ensure_music_ambient_prompt(refined)
    except Exception as e:
        logger.warning("SFX prompt refine failed, using draft: %s", e)

    return _ensure_music_ambient_prompt(draft)


async def _generate_sfx(prompt: str, duration: float) -> bytes:
    el = get_elevenlabs()
    influence = getattr(settings, "ambient_prompt_influence", 0.72)
    async with elevenlabs_semaphore:
        audio_iter = await asyncio.to_thread(
            el.text_to_sound_effects.convert,
            text=prompt,
            duration_seconds=duration,
            prompt_influence=influence,
            loop=True,
        )
    chunks = []
    for chunk in audio_iter:
        chunks.append(chunk)
    return b"".join(chunks)


async def generate_ambient_for_page(story_id: str, page_number: int) -> List[dict]:
    """Generate vibe-driven ambient tracks for a page. Safe to call concurrently."""
    lock_key = (story_id, page_number)
    if lock_key not in _ambient_locks:
        _ambient_locks[lock_key] = asyncio.Lock()

    async with _ambient_locks[lock_key]:
        return await _generate_locked(story_id, page_number)


async def _generate_locked(story_id: str, page_number: int) -> List[dict]:
    supabase = get_supabase()

    existing = (
        supabase.table("page_ambient_tracks")
        .select("*")
        .eq("story_id", story_id)
        .eq("page_number", page_number)
        .order("layer_index")
        .execute()
    )
    if existing.data:
        ready = [t for t in existing.data if t["status"] == "ready" and t.get("audio_url")]
        if len(ready) == len(existing.data):
            return ready
        generating = [t for t in existing.data if t["status"] == "generating"]
        if generating:
            return existing.data

    page_result = (
        supabase.table("story_pages")
        .select("ambient_setting, raw_segments")
        .eq("story_id", story_id)
        .eq("page_number", page_number)
        .execute()
    )
    if not page_result.data:
        logger.warning("Page %d not found for story %s", page_number, story_id)
        return []

    page = page_result.data[0]
    raw_segments = page.get("raw_segments") or []
    setting = (page.get("ambient_setting") or "").strip()

    if not setting and not raw_segments:
        logger.warning("No content for ambient: story=%s page=%d", story_id, page_number)
        return []

    if not setting:
        setting = await _infer_setting(raw_segments)

    zones = await _analyze_vibes(setting, raw_segments)
    start_fractions = _compute_start_fractions(raw_segments, zones)

    for i, zone in enumerate(zones):
        supabase.table("page_ambient_tracks").upsert(
            {
                "story_id": story_id,
                "page_number": page_number,
                "layer_index": i,
                "label": zone["label"],
                "prompt": zone.get("prompt", ""),
                "default_volume": 0.3,
                "start_fraction": start_fractions[i] if i < len(start_fractions) else 0,
                "status": "generating",
            },
            on_conflict="story_id,page_number,layer_index",
        ).execute()

    results = []
    for i, zone in enumerate(zones):
        try:
            sfx_prompt = await _refine_sfx_prompt(setting, zone, raw_segments)
            logger.info(
                "Ambient SFX story=%s page=%d zone=%d label=%s prompt=%s",
                story_id,
                page_number,
                i,
                zone.get("label"),
                sfx_prompt[:120],
            )

            supabase.table("page_ambient_tracks").update({
                "prompt": sfx_prompt,
            }).eq("story_id", story_id).eq("page_number", page_number).eq(
                "layer_index", i
            ).execute()

            audio_bytes = await _generate_sfx(sfx_prompt, settings.ambient_loop_duration)
            if not audio_bytes:
                raise RuntimeError("Empty audio from ElevenLabs SFX API")

            file_path = f"{story_id}/ambient/page_{page_number:03d}_vibe_{i}.mp3"
            try:
                supabase.storage.from_("story-audio").upload(
                    path=file_path,
                    file=audio_bytes,
                    file_options={"content-type": "audio/mpeg", "upsert": "true"},
                )
            except Exception as e:
                if "exists" in str(e).lower() or "duplicate" in str(e).lower():
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

            sf = start_fractions[i] if i < len(start_fractions) else 0

            supabase.table("page_ambient_tracks").update({
                "status": "ready",
                "audio_url": audio_url,
                "duration_seconds": settings.ambient_loop_duration,
            }).eq("story_id", story_id).eq("page_number", page_number).eq(
                "layer_index", i
            ).execute()

            results.append({
                "layer_index": i,
                "label": zone["label"],
                "audio_url": audio_url,
                "default_volume": 0.3,
                "start_fraction": sf,
                "status": "ready",
            })

        except Exception as e:
            logger.error(
                "Ambient SFX failed: story=%s page=%d zone=%d: %s",
                story_id, page_number, i, e,
            )
            supabase.table("page_ambient_tracks").update({
                "status": "failed",
            }).eq("story_id", story_id).eq("page_number", page_number).eq(
                "layer_index", i
            ).execute()

    return results
