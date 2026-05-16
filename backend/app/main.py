import logging
import traceback
from contextlib import asynccontextmanager
import json
import time
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)
DEBUG_LOG_PATH = Path("/Users/sethummethsanda/Documents/Dev/Runtime_Terror/.cursor/debug-0b705f.log")


def _debug_log(hypothesis_id: str, location: str, message: str, data: dict):
    # #region agent log
    payload = {
        "sessionId": "0b705f",
        "runId": "initial",
        "hypothesisId": hypothesis_id,
        "location": location,
        "message": message,
        "data": data,
        "timestamp": int(time.time() * 1000),
    }
    with DEBUG_LOG_PATH.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(payload) + "\n")
    # #endregion

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
from app.routes import stories, pages, voices, sessions  # noqa: E402

app.include_router(stories.router, prefix="/api", tags=["Stories"])
app.include_router(pages.router, prefix="/api", tags=["Pages"])
app.include_router(voices.router, prefix="/api", tags=["Voices"])
app.include_router(sessions.router, prefix="/api", tags=["Sessions"])


@app.middleware("http")
async def log_story_request_flow(request: Request, call_next):
    if request.url.path.startswith("/api/stories"):
        _debug_log(
            "H4",
            "backend/app/main.py:log_story_request_flow:before",
            "Backend received /api/stories request",
            {
                "method": request.method,
                "path": request.url.path,
                "origin": request.headers.get("origin"),
                "frontendUrlSetting": settings.frontend_url,
            },
        )
    response = await call_next(request)
    if request.url.path.startswith("/api/stories"):
        _debug_log(
            "H4",
            "backend/app/main.py:log_story_request_flow:after",
            "Backend completed /api/stories request",
            {
                "status": response.status_code,
                "hasAllowOriginHeader": "access-control-allow-origin" in response.headers,
                "allowOriginHeader": response.headers.get("access-control-allow-origin"),
            },
        )
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled error on %s %s", request.method, request.url.path)
    traceback.print_exc()
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
