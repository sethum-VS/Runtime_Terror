import asyncio
from typing import Optional

from supabase import create_client, Client
from elevenlabs.client import ElevenLabs
import vertexai
from vertexai.generative_models import GenerativeModel
from fastapi import Header, HTTPException
from jose import jwt, JWTError

from app.config import get_settings

settings = get_settings()

VERTEX_GEMINI_MODEL = "gemini-2.5-flash"

_supabase: Optional[Client] = None
_elevenlabs_client: Optional[ElevenLabs] = None
_gemini_flash: Optional[GenerativeModel] = None
_gemini_model_name: Optional[str] = None


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


def _resolve_gemini_model() -> str:
    """Always use Gemini 2.5 Flash on Vertex AI (2.0 is deprecated/unavailable)."""
    cfg = get_settings()
    model = (cfg.gemini_model or VERTEX_GEMINI_MODEL).strip()
    if "gemini-2.0" in model or model == "gemini-2.0-flash":
        model = VERTEX_GEMINI_MODEL
    return model


def get_gemini() -> GenerativeModel:
    global _gemini_flash, _gemini_model_name
    model_name = _resolve_gemini_model()
    if _gemini_flash is None or _gemini_model_name != model_name:
        cfg = get_settings()
        if not cfg.google_cloud_project:
            raise RuntimeError(
                "GOOGLE_CLOUD_PROJECT missing in .env. "
                "Set it to your GCP project ID and ensure GOOGLE_APPLICATION_CREDENTIALS "
                "points to your service account key file (for local dev)."
            )
        vertexai.init(
            project=cfg.google_cloud_project,
            location=cfg.google_cloud_region,
        )
        print(f"[vertexai] Using model: {model_name}")
        _gemini_flash = GenerativeModel(model_name)
        _gemini_model_name = model_name
    return _gemini_flash


elevenlabs_semaphore = asyncio.Semaphore(settings.elevenlabs_max_concurrent)


async def get_current_user(authorization: str | None = Header(None)) -> dict | None:
    """Decode Supabase JWT. Returns {"user_id": ..., "role": ...} or None if no/invalid token."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    secret = get_settings().supabase_jwt_secret
    if not secret:
        return None
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"], audience="authenticated")
        user_id = payload.get("sub")
        if not user_id:
            return None
        sb = get_supabase()
        profile = sb.table("user_profiles").select("role").eq("user_id", user_id).execute()
        role = profile.data[0]["role"] if profile.data else "user"
        return {"user_id": user_id, "role": role}
    except JWTError:
        return None


async def get_required_user(authorization: str | None = Header(None)) -> dict:
    """Like get_current_user but raises 401 if not authenticated."""
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user
