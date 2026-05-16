import asyncio
from fastapi import APIRouter, HTTPException

from app.dependencies import get_supabase
from app.services.audio_generator import generate_page_audio
from app.models.schemas import PageResponse, PageSummary

router = APIRouter()


@router.post("/stories/{story_id}/pages/{page_num}/generate", response_model=PageResponse)
async def generate_page(story_id: str, page_num: int):
    """Trigger lazy audio generation for a page (idempotent)."""
    supabase = get_supabase()

    story = supabase.table("stories").select("status").eq("id", story_id).execute()
    if not story.data:
        raise HTTPException(404, "Story not found")

    status = story.data[0]["status"]
    if status not in ("profiled", "ready", "generating_page1"):
        raise HTTPException(
            400,
            f"Story not ready for audio generation. Current status: {status}",
        )

    page = (
        supabase.table("story_pages")
        .select("*")
        .eq("story_id", story_id)
        .eq("page_number", page_num)
        .execute()
    )
    if not page.data:
        raise HTTPException(404, f"Page {page_num} not found")

    p = page.data[0]

    if p["status"] == "ready" and p.get("audio_url"):
        return PageResponse(
            page_number=page_num,
            status="ready",
            audio_url=p["audio_url"],
            timestamps_json=p.get("timestamps_json"),
            dialogue_json=p.get("dialogue_json"),
            raw_segments=p.get("raw_segments"),
        )

    if p["status"] == "generating":
        return PageResponse(page_number=page_num, status="generating")

    asyncio.create_task(generate_page_audio(story_id, page_num))
    return PageResponse(page_number=page_num, status="generating")


@router.get("/stories/{story_id}/pages/{page_num}", response_model=PageResponse)
async def get_page(story_id: str, page_num: int):
    """Get a page's status and (if ready) audio URL + timestamps."""
    supabase = get_supabase()
    page = (
        supabase.table("story_pages")
        .select("*")
        .eq("story_id", story_id)
        .eq("page_number", page_num)
        .execute()
    )
    if not page.data:
        raise HTTPException(404, f"Page {page_num} not found")

    p = page.data[0]
    return PageResponse(
        page_number=p["page_number"],
        status=p["status"],
        audio_url=p.get("audio_url"),
        timestamps_json=p.get("timestamps_json"),
        dialogue_json=p.get("dialogue_json"),
        raw_segments=p.get("raw_segments"),
    )


@router.get("/stories/{story_id}/pages", response_model=list[PageSummary])
async def get_all_pages(story_id: str):
    """List all pages in a story with their status."""
    supabase = get_supabase()
    pages = (
        supabase.table("story_pages")
        .select("page_number, status, audio_url")
        .eq("story_id", story_id)
        .order("page_number")
        .execute()
    )
    return [
        PageSummary(
            page_number=p["page_number"],
            status=p["status"],
            audio_url=p.get("audio_url"),
        )
        for p in (pages.data or [])
    ]
