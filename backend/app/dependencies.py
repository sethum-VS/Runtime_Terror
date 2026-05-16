import asyncio
from typing import Optional

from supabase import create_client, Client
from elevenlabs.client import ElevenLabs
import vertexai
from vertexai.generative_models import GenerativeModel

from app.config import get_settings

settings = get_settings()

_supabase: Optional[Client] = None
_elevenlabs_client: Optional[ElevenLabs] = None
_gemini_flash: Optional[GenerativeModel] = None


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


def get_gemini() -> GenerativeModel:
    global _gemini_flash
    if _gemini_flash is None:
        if not settings.google_cloud_project:
            raise RuntimeError(
                "GOOGLE_CLOUD_PROJECT missing in .env. "
                "Set it to your GCP project ID and ensure GOOGLE_APPLICATION_CREDENTIALS "
                "points to your service account key file (for local dev)."
            )
        vertexai.init(
            project=settings.google_cloud_project,
            location=settings.google_cloud_region,
        )
        _gemini_flash = GenerativeModel("gemini-2.0-flash")
    return _gemini_flash


elevenlabs_semaphore = asyncio.Semaphore(settings.elevenlabs_max_concurrent)
