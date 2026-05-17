import asyncio

from fastapi import APIRouter, HTTPException

from app.dependencies import get_supabase
from app.models.schemas import AmbientTrackResponse, AmbientTracksResponse
from app.services.ambient_generator import generate_ambient_for_page

router = APIRouter()


def _row_to_response(t: dict) -> AmbientTrackResponse:
    return AmbientTrackResponse(
        layer_index=t["layer_index"],
        label=t["label"],
        audio_url=t.get("audio_url"),
        default_volume=t.get("default_volume", 0.3),
        start_fraction=t.get("start_fraction", 0.0),
        status=t["status"],
    )


@router.post(
    "/stories/{story_id}/pages/{page_num}/ambient/generate",
    response_model=AmbientTracksResponse,
)
async def generate_ambient(story_id: str, page_num: int):
    """Trigger ambient track generation for a page (idempotent, vibe-driven)."""
    supabase = get_supabase()

    story = supabase.table("stories").select("status").eq("id", story_id).execute()
    if not story.data:
        raise HTTPException(404, "Story not found")

    status = story.data[0]["status"]
    if status not in ("profiled", "ready", "generating_page1"):
        raise HTTPException(
            400,
            f"Story not ready for ambient generation. Current status: {status}",
        )

    existing = (
        supabase.table("page_ambient_tracks")
        .select("*")
        .eq("story_id", story_id)
        .eq("page_number", page_num)
        .order("layer_index")
        .execute()
    )

    if existing.data:
        has_active = any(t["status"] in ("ready", "generating") for t in existing.data)
        if has_active:
            return AmbientTracksResponse(
                page_number=page_num,
                tracks=[_row_to_response(t) for t in existing.data],
            )

    asyncio.create_task(generate_ambient_for_page(story_id, page_num))
    return AmbientTracksResponse(page_number=page_num, tracks=[])


@router.get(
    "/stories/{story_id}/pages/{page_num}/ambient",
    response_model=AmbientTracksResponse,
)
async def get_ambient(story_id: str, page_num: int):
    """Get all ambient vibe tracks for a page."""
    supabase = get_supabase()

    tracks = (
        supabase.table("page_ambient_tracks")
        .select("*")
        .eq("story_id", story_id)
        .eq("page_number", page_num)
        .order("layer_index")
        .execute()
    )

    return AmbientTracksResponse(
        page_number=page_num,
        tracks=[_row_to_response(t) for t in (tracks.data or [])],
    )
