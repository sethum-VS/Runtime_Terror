from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    elevenlabs_api_key: str = ""

    google_cloud_project: str = ""
    google_cloud_region: str = "us-central1"
    gemini_model: str = "gemini-2.5-flash"  # Vertex AI model ID

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

    ambient_loop_duration: float = 20.0  # longer loop suits musical pads/drones
    ambient_prompt_influence: float = 0.72  # ElevenLabs SFX adherence (higher = closer to prompt)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()
