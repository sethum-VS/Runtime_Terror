import asyncio
from fastapi import APIRouter, UploadFile, File, HTTPException

from app.dependencies import get_supabase
from app.services.pdf_converter import convert_pdf_to_markdown
from app.services.story_parser import parse_story
from app.models.schemas import StoryResponse, CharacterResponse

router = APIRouter()

MAX_PDF_BYTES = 10 * 1024 * 1024  # 10 MB


@router.post("/stories/upload", response_model=StoryResponse)
async def upload_story(file: UploadFile = File(...)):
    """Upload a PDF file and start the parsing pipeline in the background."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are accepted")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_PDF_BYTES:
        raise HTTPException(400, "File too large. Max 10MB.")
    if not file_bytes:
        raise HTTPException(400, "Empty file")

    try:
        md_text = await convert_pdf_to_markdown(file_bytes, file.filename)
    except Exception as e:
        raise HTTPException(500, f"PDF conversion failed: {str(e)}") from e

    if not md_text.strip():
        raise HTTPException(400, "PDF contains no extractable text")

    supabase = get_supabase()
    story_data = {
        "title": file.filename.rsplit(".", 1)[0],
        "original_text": md_text,
        "status": "uploaded",
    }
    try:
        result = supabase.table("stories").insert(story_data).execute()
    except Exception as e:
        raise HTTPException(500, f"Database error: {str(e)}") from e

    if not result.data:
        raise HTTPException(500, "Failed to create story record")

    story = result.data[0]
    story_id = str(story["id"])
    asyncio.create_task(_run_parsing_pipeline(story_id, md_text))

    return StoryResponse(
        id=story_id,
        title=story["title"],
        status=story["status"],
        total_pages=story.get("total_pages") or 0,
    )


async def _run_parsing_pipeline(story_id: str, md_text: str):
    """Background pipeline: parse -> profile -> generate page 1."""
    supabase = get_supabase()
    try:
        supabase.table("stories").update({"status": "parsing"}).eq("id", story_id).execute()

        parsed = await parse_story(md_text)

        # Save characters
        for char in parsed.get("characters", []):
            supabase.table("characters").insert({
                "story_id": story_id,
                "character_id": char.get("character_id", "char_unknown"),
                "name": char.get("name", "Unknown"),
                "description": char.get("description", ""),
                "role": char.get("role", "supporting"),
                "speaking_style": char.get("speaking_style", "neutral"),
                "estimated_age": char.get("estimated_age", "adult"),
                "gender": char.get("gender", "other"),
            }).execute()

        # Save pages
        for page in parsed.get("pages", []):
            supabase.table("story_pages").insert({
                "story_id": story_id,
                "page_number": page["page_number"],
                "status": "idle",
                "raw_segments": page.get("segments", []),
            }).execute()

        # Update story
        supabase.table("stories").update({
            "status": "parsed",
            "total_pages": len(parsed["pages"]),
            "title": parsed.get("title") or "Untitled",
        }).eq("id", story_id).execute()

        # Continue pipeline: profile + generate page 1
        await _run_profiling(story_id)

    except Exception as e:
        supabase.table("stories").update({
            "status": "failed",
            "error_message": str(e)[:500],
        }).eq("id", story_id).execute()


async def _run_profiling(story_id: str):
    """Profile characters, assign voices, then generate page 1."""
    supabase = get_supabase()
    try:
        from app.services.character_profiler import profile_characters_and_assign_voices
        from app.services.audio_generator import generate_page_audio

        supabase.table("stories").update({"status": "profiling"}).eq("id", story_id).execute()
        await profile_characters_and_assign_voices(story_id)

        supabase.table("stories").update({"status": "profiled"}).eq("id", story_id).execute()
        supabase.table("stories").update({"status": "generating_page1"}).eq("id", story_id).execute()

        await generate_page_audio(story_id, 1)

        supabase.table("stories").update({"status": "ready"}).eq("id", story_id).execute()
    except Exception as e:
        supabase.table("stories").update({
            "status": "failed",
            "error_message": str(e)[:500],
        }).eq("id", story_id).execute()


@router.post("/stories/{story_id}/profile")
async def profile_story(story_id: str):
    """Manually trigger character profiling (typically auto-runs after parse)."""
    supabase = get_supabase()
    story = supabase.table("stories").select("status").eq("id", story_id).execute()
    if not story.data:
        raise HTTPException(404, "Story not found")

    current_status = story.data[0]["status"]
    if current_status not in ("parsed", "failed"):
        raise HTTPException(400, f"Story must be 'parsed', currently: {current_status}")

    asyncio.create_task(_run_profiling(story_id))
    return {"status": "profiling"}


@router.get("/stories/{story_id}", response_model=StoryResponse)
async def get_story(story_id: str):
    """Get story status and metadata."""
    supabase = get_supabase()
    result = supabase.table("stories").select("*").eq("id", story_id).execute()
    if not result.data:
        raise HTTPException(404, "Story not found")
    story = result.data[0]
    return StoryResponse(
        id=story["id"],
        title=story["title"],
        status=story["status"],
        total_pages=story.get("total_pages") or 0,
        error_message=story.get("error_message"),
    )


@router.get("/stories/{story_id}/characters", response_model=list[CharacterResponse])
async def get_characters(story_id: str):
    """Get all characters for a story."""
    supabase = get_supabase()
    result = supabase.table("characters").select("*").eq("story_id", story_id).execute()
    return [
        CharacterResponse(
            character_id=c["character_id"],
            name=c["name"],
            description=c.get("description"),
            role=c.get("role"),
            voice_id=c.get("voice_id"),
            voice_strategy=c.get("voice_strategy"),
        )
        for c in (result.data or [])
    ]


@router.get("/stories")
async def list_stories():
    """List all stories (for My Library page)."""
    supabase = get_supabase()
    result = (
        supabase.table("stories")
        .select("id, title, status, total_pages, created_at")
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return result.data or []
