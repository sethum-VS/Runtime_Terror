from pydantic import BaseModel
from typing import Optional, List, Any
from enum import Enum


class StoryStatus(str, Enum):
    UPLOADED = "uploaded"
    PARSING = "parsing"
    PARSED = "parsed"
    PROFILING = "profiling"
    PROFILED = "profiled"
    GENERATING_PAGE1 = "generating_page1"
    READY = "ready"
    FAILED = "failed"


class PageStatus(str, Enum):
    IDLE = "idle"
    GENERATING = "generating"
    READY = "ready"
    FAILED = "failed"


class StoryResponse(BaseModel):
    id: str
    title: str
    status: str
    total_pages: int
    error_message: Optional[str] = None
    is_showcase: bool = False
    user_id: Optional[str] = None


class PageResponse(BaseModel):
    page_number: int
    status: str
    audio_url: Optional[str] = None
    timestamps_json: Optional[List[dict]] = None
    dialogue_json: Optional[List[dict]] = None
    raw_segments: Optional[List[dict]] = None


class PageSummary(BaseModel):
    page_number: int
    status: str
    audio_url: Optional[str] = None


class SessionResponse(BaseModel):
    story_id: str
    last_page: int
    last_position: float


class SessionUpdate(BaseModel):
    last_page: int
    last_position: float


class CharacterResponse(BaseModel):
    character_id: str
    name: str
    description: Optional[str] = None
    role: Optional[str] = None
    voice_id: Optional[str] = None
    voice_strategy: Optional[str] = None


class DialogueInput(BaseModel):
    voice_id: str
    text: str


class UserProfileResponse(BaseModel):
    user_id: str
    full_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    preferred_narrator_voice: Optional[str] = None
    preferred_reading_theme: Optional[str] = None
    role: str = "user"


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    preferred_narrator_voice: Optional[str] = None
    preferred_reading_theme: Optional[str] = None


class BookmarkResponse(BaseModel):
    story_id: str
    title: str
    status: str
    total_pages: int
    is_showcase: bool = False
    created_at: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    service: str
