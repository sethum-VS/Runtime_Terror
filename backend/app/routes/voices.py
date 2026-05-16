from fastapi import APIRouter

from app.dependencies import get_supabase
from app.services.voice_service import cache_voice_library

router = APIRouter()


@router.get("/voices")
async def list_voices():
    """Return cached voice library."""
    supabase = get_supabase()
    result = supabase.table("voice_library").select("*").limit(200).execute()
    return result.data or []


@router.post("/voices/refresh")
async def refresh_voices():
    """Re-fetch and cache the ElevenLabs voice library."""
    count = await cache_voice_library()
    return {"status": "refreshed", "count": count}
