"""Veo 3.1 Lite video generator — turns a scene prompt into an MP4 background.

We use the `google-genai` SDK (a separate package from `google-cloud-aiplatform`
that we use for Gemini Flash/Pro). Both rely on Application Default Credentials,
so no extra auth setup is needed.

Flow per page:
  1. Run scene_analyzer to get a Veo prompt (Gemini 2.5 Pro).
  2. Submit a long-running operation to Veo 3.1 Lite (model id from settings).
  3. Poll the operation (~30-90s typical).
  4. Pull the bytes, upload to Supabase Storage (`story-video` bucket).
  5. Persist the video URL + scene metadata on the page row.

The 8-second clip is `loop`ed on the frontend to fill the audio duration.
"""
import asyncio
import io
import time
from typing import Any

from app.config import get_settings
from app.dependencies import (
    get_genai_client,
    get_supabase,
    veo_semaphore,
)
from app.services.scene_analyzer import analyze_scene_for_page


_STORAGE_BUCKET = "story-video"


def _build_veo_config():
    """Build a Veo GenerateVideosConfig from settings.

    Imported lazily so the module is importable when google-genai is not yet
    installed (e.g. in CI without the new dep).
    """
    from google.genai import types  # type: ignore

    cfg = get_settings()
    return types.GenerateVideosConfig(
        aspect_ratio=cfg.veo_aspect_ratio,
        number_of_videos=1,
        duration_seconds=cfg.veo_duration_seconds,
        resolution=cfg.veo_resolution,
        person_generation="allow_adult",
        generate_audio=False,  # background video, no soundtrack interference
    )


async def _generate_video_bytes(prompt: str, negative_prompt: str | None) -> bytes:
    """Call Veo 3.1 Lite and block until the video is ready, returning MP4 bytes."""
    cfg = get_settings()
    client = get_genai_client()
    veo_config = _build_veo_config()
    if negative_prompt:
        try:
            veo_config.negative_prompt = negative_prompt  # type: ignore[attr-defined]
        except Exception:
            pass

    def _submit_and_poll() -> bytes:
        operation = client.models.generate_videos(
            model=cfg.veo_model,
            prompt=prompt,
            config=veo_config,
        )
        deadline = time.monotonic() + cfg.veo_max_poll_seconds
        while not operation.done:
            if time.monotonic() > deadline:
                raise TimeoutError(
                    f"Veo generation exceeded {cfg.veo_max_poll_seconds}s"
                )
            time.sleep(cfg.veo_poll_interval_seconds)
            operation = client.operations.get(operation)

        response: Any = getattr(operation, "response", None) or getattr(
            operation, "result", None
        )
        if not response:
            raise RuntimeError("Veo operation finished without a response payload")

        videos = getattr(response, "generated_videos", None) or []
        if not videos:
            raise RuntimeError("Veo returned no generated_videos")

        video = videos[0].video
        # Two possible shapes: inline bytes OR a URI (when output_gcs_uri is set).
        video_bytes = getattr(video, "video_bytes", None)
        if video_bytes:
            return bytes(video_bytes)

        uri = getattr(video, "uri", None)
        if uri:
            raise RuntimeError(
                f"Veo returned a GCS URI ({uri}) but no inline bytes. "
                "Either fetch the GCS object or call without output_gcs_uri."
            )
        raise RuntimeError("Veo response had neither video_bytes nor uri")

    async with veo_semaphore:
        return await asyncio.to_thread(_submit_and_poll)


def _upload_video(story_id: str, page_number: int, video_bytes: bytes) -> str:
    supabase = get_supabase()
    file_path = f"{story_id}/page_{page_number:03d}.mp4"
    file_options = {"content-type": "video/mp4", "upsert": "true"}
    try:
        supabase.storage.from_(_STORAGE_BUCKET).upload(
            path=file_path,
            file=video_bytes,
            file_options=file_options,
        )
    except Exception as exc:
        msg = str(exc).lower()
        if "exists" in msg or "duplicate" in msg:
            supabase.storage.from_(_STORAGE_BUCKET).update(
                path=file_path,
                file=video_bytes,
                file_options={"content-type": "video/mp4"},
            )
        else:
            raise

    url = supabase.storage.from_(_STORAGE_BUCKET).get_public_url(file_path)
    if isinstance(url, str):
        url = url.rstrip("?")
    return url


async def generate_page_scene_video(story_id: str, page_number: int) -> dict:
    """Full pipeline: analyze scene -> Veo -> upload -> persist on story_pages.

    Returns the saved scene record (video_url + meta).
    Idempotent: short-circuits if the page already has a ready video.
    """
    cfg = get_settings()
    if not cfg.enable_live_backgrounds:
        return {"status": "disabled"}

    supabase = get_supabase()
    page_result = (
        supabase.table("story_pages")
        .select("id, video_url, video_status, scene_meta_json")
        .eq("story_id", story_id)
        .eq("page_number", page_number)
        .execute()
    )
    if not page_result.data:
        raise ValueError(f"Page {page_number} not found for story {story_id}")
    page = page_result.data[0]

    if page.get("video_status") == "ready" and page.get("video_url"):
        return {
            "status": "ready",
            "video_url": page["video_url"],
            "scene_meta": page.get("scene_meta_json"),
        }
    if page.get("video_status") == "generating":
        return {"status": "generating"}

    supabase.table("story_pages").update(
        {"video_status": "generating"}
    ).eq("id", page["id"]).execute()

    try:
        scene = await analyze_scene_for_page(story_id, page_number)
        video_bytes = await _generate_video_bytes(
            prompt=scene["video_prompt"],
            negative_prompt=scene.get("negative_prompt"),
        )
        if not video_bytes:
            raise RuntimeError("Veo returned empty bytes")

        video_url = _upload_video(story_id, page_number, video_bytes)

        supabase.table("story_pages").update(
            {
                "video_status": "ready",
                "video_url": video_url,
                "scene_meta_json": scene,
                "video_generated_at": "now()",
            }
        ).eq("id", page["id"]).execute()

        return {"status": "ready", "video_url": video_url, "scene_meta": scene}
    except Exception as exc:
        supabase.table("story_pages").update(
            {
                "video_status": "failed",
                "video_error": str(exc)[:500],
            }
        ).eq("id", page["id"]).execute()
        raise
