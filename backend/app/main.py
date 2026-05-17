import logging
import traceback
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

from app.config import get_settings
from app.models.schemas import HealthResponse

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: cache voice library (best-effort, non-blocking on failure)
    try:
        from app.dependencies import _resolve_gemini_model
        from app.services.voice_service import cache_voice_library

        print(f"[startup] Vertex AI model: {_resolve_gemini_model()}")
        await cache_voice_library()
        print("[startup] Voice library cached successfully")
    except Exception as e:
        print(f"[startup] Warning: Voice library cache failed: {e}")
    yield
    print("[shutdown] VoiceTale backend stopped")


app = FastAPI(
    title="VoiceTale API",
    description="AI-powered multi-character storybook narrator",
    version="1.0.0",
    lifespan=lifespan,
)

configured_origins = {
    settings.frontend_url,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://voicetale-frontend.vercel.app",
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(o for o in configured_origins if o),
    allow_origin_regex=r"(http://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|172\.\d{1,3}\.\d{1,3}\.\d{1,3}):3000)|(https://.*\.vercel\.app)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
from app.routes import stories, pages, voices, sessions, profiles, bookmarks, conversation, ambient  # noqa: E402

app.include_router(stories.router, prefix="/api", tags=["Stories"])
app.include_router(pages.router, prefix="/api", tags=["Pages"])
app.include_router(voices.router, prefix="/api", tags=["Voices"])
app.include_router(sessions.router, prefix="/api", tags=["Sessions"])
app.include_router(profiles.router, prefix="/api", tags=["Profile"])
app.include_router(bookmarks.router, prefix="/api", tags=["Bookmarks"])
app.include_router(conversation.router, prefix="/api", tags=["Conversation"])
app.include_router(ambient.router, prefix="/api", tags=["Ambient"])


def _is_upstream_timeout(exc: BaseException) -> bool:
    msg = str(exc).lower()
    if isinstance(exc, (httpx.TimeoutException, httpx.ReadTimeout, httpx.ConnectTimeout)):
        return True
    return "timeout" in msg or "recvmsg" in msg or "timed out" in msg


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled error on %s %s", request.method, request.url.path)
    traceback.print_exc()
    if _is_upstream_timeout(exc):
        return JSONResponse(
            status_code=503,
            content={
                "detail": (
                    "Database connection timed out. Please retry in a few seconds "
                    "(Supabase may be busy during story processing)."
                ),
            },
        )
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc) or "Internal Server Error"},
    )


@app.get("/api/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok", service="voicetale-backend")


@app.get("/")
async def root():
    return {"message": "VoiceTale API", "docs": "/docs", "health": "/api/health"}
