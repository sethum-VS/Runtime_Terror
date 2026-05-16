import asyncio
from typing import Optional

from supabase import create_client, Client
from elevenlabs.client import ElevenLabs
import google.generativeai as genai

from app.config import get_settings

settings = get_settings()

_supabase: Optional[Client] = None
_elevenlabs_client: Optional[ElevenLabs] = None
_gemini_flash = None


def get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise RuntimeError(
                "Supabase credentials missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env"
            )
        _supabase = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
    return _supabase


def get_elevenlabs() -> ElevenLabs:
    global _elevenlabs_client
    if _elevenlabs_client is None:
        if not settings.elevenlabs_api_key:
            raise RuntimeError("ELEVENLABS_API_KEY missing in .env")
        _elevenlabs_client = ElevenLabs(api_key=settings.elevenlabs_api_key)
    return _elevenlabs_client


def get_gemini():
    global _gemini_flash
    if _gemini_flash is None:
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY missing in .env")
        genai.configure(api_key=settings.gemini_api_key)
        _gemini_flash = genai.GenerativeModel("gemini-2.0-flash-exp")
    return _gemini_flash


elevenlabs_semaphore = asyncio.Semaphore(settings.elevenlabs_max_concurrent)
