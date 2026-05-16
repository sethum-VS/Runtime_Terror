import asyncio
import json
import logging

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.dependencies import get_supabase, get_elevenlabs
from app.models.schemas import (
    ConversationStartRequest,
    ConversationStartResponse,
    ConversationEndRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter()

DEFAULT_NARRATOR_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"  # George
MAX_CONTEXT_CHARS = 4000


def _build_agent_prompt(
    story_title: str,
    original_text: str | None,
    characters: list[dict],
    current_page: int,
    total_pages: int,
    page_segments: list[dict] | None,
) -> str:
    synopsis = (original_text or "")[:MAX_CONTEXT_CHARS]

    char_lines = []
    for c in characters:
        role = c.get("role", "supporting")
        desc = c.get("description", "")
        char_lines.append(f"- {c['name']} ({role}): {desc}")
    characters_block = "\n".join(char_lines) if char_lines else "No character data."

    page_text = ""
    if page_segments:
        parts = []
        for seg in page_segments:
            if isinstance(seg, dict):
                parts.append(seg.get("text", ""))
            elif isinstance(seg, str):
                parts.append(seg)
        page_text = " ".join(parts)[:MAX_CONTEXT_CHARS]

    return f"""# Personality
You are the Narrator of "{story_title}". You are warm, knowledgeable, and enthusiastic about this story. You speak as a friendly storyteller who knows every detail.

# Environment
You are speaking with a reader who is currently on page {current_page} of {total_pages}.

# Context
## Story Synopsis
{synopsis}

## Characters
{characters_block}

## Current Page Content
{page_text}

# Goal
Answer questions about the story, characters, plot, and themes. Stay in character as the narrator. If asked about events beyond the current page, gently hint without spoiling. Keep answers concise and conversational — you are speaking out loud, not writing an essay.

# Tone
- Warm and engaging, like a fireside storyteller
- Enthusiastic about the story's details
- Protective of spoilers for pages the reader hasn't reached
- Concise — aim for 2-3 sentences per response unless more detail is requested"""


def _find_narrator_voice_id(characters: list[dict]) -> str:
    for c in characters:
        if c.get("role") == "narrator" and c.get("voice_id"):
            return c["voice_id"]
    return DEFAULT_NARRATOR_VOICE_ID


def _build_first_message(
    story_title: str,
    is_first_session: bool,
) -> str:
    if is_first_session:
        return (
            f"Welcome, dear reader! I'm the narrator of \"{story_title}\". "
            "I know every corner of this story — its characters, its secrets, its twists. "
            "Ask me anything you'd like to know."
        )
    return f"Ah, welcome back! Still curious about \"{story_title}\"? Go ahead, I'm listening."


@router.post(
    "/stories/{story_id}/conversation/start",
    response_model=ConversationStartResponse,
)
async def start_conversation(story_id: str, body: ConversationStartRequest):
    settings = get_settings()
    supabase = get_supabase()
    el = get_elevenlabs()

    story_result = (
        supabase.table("stories")
        .select("title, original_text, total_pages, status")
        .eq("id", story_id)
        .execute()
    )
    if not story_result.data:
        raise HTTPException(404, "Story not found")

    story = story_result.data[0]
    if story["status"] not in ("profiled", "ready", "generating_page1"):
        raise HTTPException(400, f"Story not ready. Status: {story['status']}")

    chars_result = (
        supabase.table("characters")
        .select("name, description, role, voice_id")
        .eq("story_id", story_id)
        .execute()
    )
    characters = chars_result.data or []

    page_segments = None
    page_result = (
        supabase.table("story_pages")
        .select("raw_segments")
        .eq("story_id", story_id)
        .eq("page_number", body.current_page)
        .execute()
    )
    if page_result.data:
        page_segments = page_result.data[0].get("raw_segments")

    prompt = _build_agent_prompt(
        story_title=story["title"],
        original_text=story.get("original_text"),
        characters=characters,
        current_page=body.current_page,
        total_pages=story["total_pages"],
        page_segments=page_segments,
    )

    narrator_voice = _find_narrator_voice_id(characters)

    try:
        agent = await asyncio.to_thread(
            el.conversational_ai.agents.create,
            name=f"VoiceTale Narrator - {story['title'][:40]}",
            conversation_config={
                "agent": {
                    "first_message": _build_first_message(
                        story['title'], body.is_first_session
                    ),
                    "language": "en",
                    "prompt": {
                        "prompt": prompt,
                        "llm": settings.elevenlabs_convai_model,
                        "temperature": 0.7,
                    },
                },
                "tts": {"voice_id": narrator_voice},
            },
        )
    except Exception as e:
        logger.error("Failed to create ElevenLabs agent: %s", e)
        raise HTTPException(500, f"Failed to create conversation agent: {e}")

    agent_id = agent.agent_id

    try:
        signed = await asyncio.to_thread(
            el.conversational_ai.conversations.get_signed_url,
            agent_id=agent_id,
        )
    except Exception as e:
        logger.error("Failed to get signed URL: %s", e)
        try:
            await asyncio.to_thread(
                el.conversational_ai.agents.delete,
                agent_id=agent_id,
            )
        except Exception:
            pass
        raise HTTPException(500, f"Failed to start conversation session: {e}")

    return ConversationStartResponse(
        signed_url=signed.signed_url,
        agent_id=agent_id,
    )


@router.post("/stories/{story_id}/conversation/end")
async def end_conversation(story_id: str, body: ConversationEndRequest):
    el = get_elevenlabs()
    try:
        await asyncio.to_thread(
            el.conversational_ai.agents.delete,
            agent_id=body.agent_id,
        )
    except Exception as e:
        logger.warning("Agent cleanup failed (may already be deleted): %s", e)

    return {"status": "ok"}
