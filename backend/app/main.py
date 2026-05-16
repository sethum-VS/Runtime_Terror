from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.models.schemas import HealthResponse

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: cache voice library (best-effort, non-blocking on failure)
    try:
        from app.services.voice_service import cache_voice_library
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
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


@app.get("/api/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok", service="voicetale-backend")


@app.get("/")
async def root():
    return {"message": "VoiceTale API", "docs": "/docs", "health": "/api/health"}
