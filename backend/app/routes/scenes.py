"""Routes for the live-background scene + video pipeline.

GET  /api/stories/{story_id}/pages/{page_num}/scene
        Returns the current scene status. When ready, includes the Veo MP4
        URL and Gemini 2.5 Pro scene metadata. When the feature flag is off,
        returns status="disabled" so the frontend can fall back silently.

POST /api/stories/{story_id}/pages/{page_num}/scene/generate
        Idempotent. Kicks off scene analysis (Gemini 2.5 Pro) + Veo 3.1 Lite
        video generation in a background task. The frontend polls the GET
        endpoint until status="ready".
"""
import asyncio

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.dependencies import get_supabase
from app.models.schemas import SceneResponse, SceneMeta
from app.services.video_generator import generate_page_scene_video

router = APIRouter()


def _build_response(page_row: dict, page_num: int) -> SceneResponse:
    scene_meta_raw = page_row.get("scene_meta_json") or None
    scene_meta = SceneMeta(**scene_meta_raw) if isinstance(scene_meta_raw, dict) else None
    status = page_row.get("video_status") or "idle"
    return SceneResponse(
        page_number=page_num,
        status=status,
        video_url=page_row.get("video_url"),
        scene_meta=scene_meta,
        error_message=page_row.get("video_error"),
    )


@router.get(
    "/stories/{story_id}/pages/{page_num}/scene",
    response_model=SceneResponse,
)
async def get_scene(story_id: str, page_num: int):
    cfg = get_settings()
    supabase = get_supabase()

    page = (
        supabase.table("story_pages")
        .select(
            "page_number, video_url, video_status, scene_meta_json, video_error"
        )
        .eq("story_id", story_id)
        .eq("page_number", page_num)
        .execute()
    )
    if not page.data:
        raise HTTPException(404, f"Page {page_num} not found")

    if not cfg.enable_live_backgrounds:
        return SceneResponse(
            page_number=page_num,
            status="disabled",
        )

    return _build_response(page.data[0], page_num)


@router.post(
    "/stories/{story_id}/pages/{page_num}/scene/generate",
    response_model=SceneResponse,
)
async def trigger_scene_generation(story_id: str, page_num: int):
    cfg = get_settings()
    if not cfg.enable_live_backgrounds:
        return SceneResponse(page_number=page_num, status="disabled")

    supabase = get_supabase()
    page = (
        supabase.table("story_pages")
        .select(
            "page_number, status, video_url, video_status, scene_meta_json, video_error"
        )
        .eq("story_id", story_id)
        .eq("page_number", page_num)
        .execute()
    )
    if not page.data:
        raise HTTPException(404, f"Page {page_num} not found")

    row = page.data[0]

    # Need the parsed page text first. If audio generation hasn't laid down
    # raw_segments yet, the caller should retry once the page exists.
    if row.get("status") not in ("idle", "generating", "ready", "failed"):
        raise HTTPException(
            400,
            f"Page {page_num} is not in a parseable state ({row.get('status')})",
        )

    if row.get("video_status") == "ready" and row.get("video_url"):
        return _build_response(row, page_num)

    if row.get("video_status") == "generating":
        return SceneResponse(page_number=page_num, status="generating")

    asyncio.create_task(_safe_generate(story_id, page_num))
    return SceneResponse(page_number=page_num, status="generating")


async def _safe_generate(story_id: str, page_num: int) -> None:
    """Wrapper that swallows exceptions — they're already persisted to the row."""
    try:
        await generate_page_scene_video(story_id, page_num)
    except Exception as exc:
        print(f"[scenes] generation failed for {story_id} page {page_num}: {exc}")
