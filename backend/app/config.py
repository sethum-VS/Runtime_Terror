from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    elevenlabs_api_key: str = ""

    google_cloud_project: str = ""
    google_cloud_region: str = "us-central1"
    gemini_api_key: str = ""

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    backend_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"

    elevenlabs_max_concurrent: int = 3
    elevenlabs_max_chars_per_request: int = 2000

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()
