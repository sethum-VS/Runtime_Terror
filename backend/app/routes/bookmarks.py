from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_supabase, get_required_user
from app.models.schemas import BookmarkResponse

router = APIRouter()


@router.get("/bookmarks", response_model=list[BookmarkResponse])
async def list_bookmarks(user: dict = Depends(get_required_user)):
    """Return all bookmarked stories for the authenticated user."""
    supabase = get_supabase()
    user_id = user["user_id"]

    result = (
        supabase.table("user_bookmarks")
        .select("story_id, created_at, stories(id, title, status, total_pages, is_showcase)")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    bookmarks = []
    for row in result.data or []:
        story = row.get("stories")
        if not story:
            continue
        bookmarks.append(BookmarkResponse(
            story_id=story["id"],
            title=story["title"],
            status=story["status"],
            total_pages=story.get("total_pages") or 0,
            is_showcase=story.get("is_showcase", False),
            created_at=row.get("created_at"),
        ))
    return bookmarks


@router.post("/bookmarks/{story_id}")
async def add_bookmark(story_id: str, user: dict = Depends(get_required_user)):
    """Add a bookmark for the given story."""
    supabase = get_supabase()
    user_id = user["user_id"]

    story = supabase.table("stories").select("id").eq("id", story_id).execute()
    if not story.data:
        raise HTTPException(404, "Story not found")

    try:
        supabase.table("user_bookmarks").upsert(
            {"user_id": user_id, "story_id": story_id},
            on_conflict="user_id,story_id",
        ).execute()
    except Exception as e:
        raise HTTPException(500, f"Failed to add bookmark: {str(e)}") from e

    return {"status": "bookmarked", "story_id": story_id}


@router.delete("/bookmarks/{story_id}")
async def remove_bookmark(story_id: str, user: dict = Depends(get_required_user)):
    """Remove a bookmark for the given story."""
    supabase = get_supabase()
    user_id = user["user_id"]

    supabase.table("user_bookmarks").delete().eq("user_id", user_id).eq("story_id", story_id).execute()
    return {"status": "removed", "story_id": story_id}


@router.get("/bookmarks/{story_id}")
async def check_bookmark(story_id: str, user: dict = Depends(get_required_user)):
    """Check if the user has bookmarked a specific story."""
    supabase = get_supabase()
    user_id = user["user_id"]

    result = (
        supabase.table("user_bookmarks")
        .select("id")
        .eq("user_id", user_id)
        .eq("story_id", story_id)
        .execute()
    )
    return {"bookmarked": bool(result.data)}
