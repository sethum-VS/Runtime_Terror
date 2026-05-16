from fastapi import APIRouter

from app.dependencies import get_supabase
from app.models.schemas import SessionResponse, SessionUpdate

router = APIRouter()


@router.get("/stories/{story_id}/session", response_model=SessionResponse)
async def get_session(story_id: str):
    """Get last_page + last_position for refresh recovery."""
    supabase = get_supabase()
    result = (
        supabase.table("story_sessions")
        .select("*")
        .eq("story_id", story_id)
        .execute()
    )
    if not result.data:
        return SessionResponse(story_id=story_id, last_page=1, last_position=0.0)
    s = result.data[0]
    return SessionResponse(
        story_id=str(s["story_id"]),
        last_page=s.get("last_page") or 1,
        last_position=float(s.get("last_position") or 0.0),
    )


@router.put("/stories/{story_id}/session")
async def update_session(story_id: str, data: SessionUpdate):
    """Save current page + position. Called on pause/page-change/before-unload."""
    supabase = get_supabase()
    supabase.table("story_sessions").upsert({
        "story_id": story_id,
        "last_page": data.last_page,
        "last_position": data.last_position,
        "updated_at": "now()",
    }, on_conflict="story_id").execute()
    return {"status": "saved"}
