from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    elevenlabs_api_key: str = ""

    google_cloud_project: str = ""
    google_cloud_region: str = "us-central1"
    gemini_model: str = "gemini-2.5-flash"  # Vertex AI model ID
    # Gemini 2.5 Pro for scene/mood/environment analysis (1M-token context)
    gemini_pro_model: str = "gemini-2.5-pro"
    gemini_pro_max_output_tokens: int = 65536

    # Veo 3.1 Lite for live-background video generation
    veo_model: str = "veo-3.1-lite-generate-001"
    veo_aspect_ratio: str = "16:9"   # 16:9 or 9:16
    veo_resolution: str = "720p"     # 720p | 1080p | 4k
    veo_duration_seconds: int = 8    # 4 | 6 | 8
    veo_max_poll_seconds: int = 180  # safety timeout
    veo_poll_interval_seconds: int = 8

    # Feature flag: scene/video generation is opt-in (costly + slow).
    # When false, /scene endpoints respond with status="disabled" and the
    # frontend falls back to its static background.
    enable_live_backgrounds: bool = False

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    backend_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"

    elevenlabs_max_concurrent: int = 3
    elevenlabs_max_chars_per_request: int = 2000
    elevenlabs_convai_model: str = "gemini-2.0-flash"  # ConvAI agent LLM
    # Low-latency TTS for English ConvAI agents (language=en requires v2, not v2.5)
    elevenlabs_convai_tts_model: str = "eleven_turbo_v2"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()
