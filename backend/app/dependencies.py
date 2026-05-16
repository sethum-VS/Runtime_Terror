import asyncio
from typing import Optional

import httpx
from supabase import create_client, Client
from elevenlabs.client import ElevenLabs
import vertexai
from vertexai.generative_models import GenerativeModel
from fastapi import Header, HTTPException
from jose import jwt, JWTError

from app.config import get_settings

settings = get_settings()

VERTEX_GEMINI_MODEL = "gemini-2.5-flash"
VERTEX_GEMINI_PRO_MODEL = "gemini-2.5-pro"

_supabase: Optional[Client] = None
_elevenlabs_client: Optional[ElevenLabs] = None
_gemini_flash: Optional[GenerativeModel] = None
_gemini_model_name: Optional[str] = None
_gemini_pro: Optional[GenerativeModel] = None
_gemini_pro_model_name: Optional[str] = None
_genai_client = None  # google.genai.Client for Veo / multimodal endpoints


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
                "GOOGLE_CLOUD_PROJECT is not set. "
                "Local: add it to backend/.env and set GOOGLE_APPLICATION_CREDENTIALS to your "
                "service account JSON (or use gcloud auth application-default login). "
                "Cloud Run: set GOOGLE_CLOUD_PROJECT on the service (deploy workflow uses "
                "GCP_PROJECT_ID); attach a service account with Vertex AI User — no key file needed."
            )
        vertexai.init(
            project=cfg.google_cloud_project,
            location=cfg.google_cloud_region,
        )
        print(f"[vertexai] Using model: {model_name}")
        _gemini_flash = GenerativeModel(model_name)
        _gemini_model_name = model_name
    return _gemini_flash


def _resolve_gemini_pro_model() -> str:
    cfg = get_settings()
    model = (cfg.gemini_pro_model or VERTEX_GEMINI_PRO_MODEL).strip()
    return model or VERTEX_GEMINI_PRO_MODEL


def get_gemini_pro() -> GenerativeModel:
    """Gemini 2.5 Pro on Vertex AI (1M-token context, used for scene analysis)."""
    global _gemini_pro, _gemini_pro_model_name
    model_name = _resolve_gemini_pro_model()
    if _gemini_pro is None or _gemini_pro_model_name != model_name:
        cfg = get_settings()
        if not cfg.google_cloud_project:
            raise RuntimeError(
                "GOOGLE_CLOUD_PROJECT is not set; cannot init Gemini 2.5 Pro on Vertex AI."
            )
        vertexai.init(
            project=cfg.google_cloud_project,
            location=cfg.google_cloud_region,
        )
        print(f"[vertexai] Using Pro model: {model_name}")
        _gemini_pro = GenerativeModel(model_name)
        _gemini_pro_model_name = model_name
    return _gemini_pro


def get_genai_client():
    """Lazy google.genai client bound to Vertex AI (used for Veo video generation).

    Uses the same Application Default Credentials as the rest of the Vertex calls,
    so no extra auth setup is required.
    """
    global _genai_client
    if _genai_client is None:
        try:
            from google import genai  # type: ignore
        except ImportError as exc:
            raise RuntimeError(
                "google-genai is not installed. Add 'google-genai' to backend/requirements.txt."
            ) from exc

        cfg = get_settings()
        if not cfg.google_cloud_project:
            raise RuntimeError(
                "GOOGLE_CLOUD_PROJECT is not set; cannot init google-genai Vertex client."
            )
        _genai_client = genai.Client(
            vertexai=True,
            project=cfg.google_cloud_project,
            location=cfg.google_cloud_region,
        )
        print(
            f"[genai] Vertex client ready (project={cfg.google_cloud_project}, "
            f"location={cfg.google_cloud_region}, veo_model={cfg.veo_model})"
        )
    return _genai_client


elevenlabs_semaphore = asyncio.Semaphore(settings.elevenlabs_max_concurrent)
# Only allow a handful of Veo jobs concurrently — each costs $$ and ties up
# the operations API. Pages share this semaphore so a long story doesn't fan
# out to dozens of simultaneous video generations.
veo_semaphore = asyncio.Semaphore(2)


async def _verify_token_via_supabase_auth(token: str) -> str | None:
    """Validate access token with Supabase Auth (works with symmetric and asymmetric JWTs)."""
    cfg = get_settings()
    if not cfg.supabase_url:
        return None
    api_key = cfg.supabase_service_role_key or cfg.supabase_anon_key
    if not api_key:
        return None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{cfg.supabase_url.rstrip('/')}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": api_key,
                },
            )
        if resp.status_code != 200:
            return None
        return resp.json().get("id")
    except Exception as exc:
        print(f"[auth] Supabase /auth/v1/user failed: {exc}")
        return None


def _verify_token_via_jwt_secret(token: str) -> str | None:
    """Legacy HS256 verification when SUPABASE_JWT_SECRET is configured."""
    secret = get_settings().supabase_jwt_secret
    if not secret:
        return None
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"verify_aud": True},
        )
        return payload.get("sub")
    except JWTError:
        return None


async def _resolve_user_role(user_id: str) -> str:
    sb = get_supabase()
    profile = sb.table("user_profiles").select("role").eq("user_id", user_id).execute()
    return profile.data[0]["role"] if profile.data else "user"


async def get_current_user(authorization: str | None = Header(None)) -> dict | None:
    """Validate Supabase access token. Returns {"user_id": ..., "role": ...} or None."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        return None

    user_id = await _verify_token_via_supabase_auth(token)
    if not user_id:
        user_id = _verify_token_via_jwt_secret(token)
    if not user_id:
        return None

    role = await _resolve_user_role(user_id)
    return {"user_id": user_id, "role": role}


async def get_required_user(authorization: str | None = Header(None)) -> dict:
    """Like get_current_user but raises 401 if not authenticated."""
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user
