# MVP Project Requirement Document (PRD)

> **Cursor Colombo Buildathon 2026 | ElevenLabs Audio & Voice AI Track**
> **Goal**: 24-Hour MVP Build | **Team Roles**: Frontend (Next.js), Backend (FastAPI)

## 1. Product Overview
**VoiceTale** is an AI-driven, multi-character audiobook platform that transforms any written story (from short scripts to full novels) into an immersive audio experience. 
Unlike standard TTS wrappers, VoiceTale profiles every character, assigns them distinct AI-generated voices, and utilizes ElevenLabs' Text-to-Dialogue API to create natural turn-taking. 

Additionally, VoiceTale offers a **Conversational Interactive Layer**, allowing users to pause the story and talk directly to the characters or the narrator via WebSockets.

---

## 2. Core MVP Scope

### 2.1 Story Ingestion & AI Parsing
- Users upload a text document or paste text.
- **Backend Orchestrator** uses a third-party LLM (GCP Model Garden) to read the text.
- The LLM identifies characters, descriptions, emotional states, and segments the text into dialogue vs. narration.

### 2.2 Character Voice Mapping
- Each detected character is profiled.
- The system hits the ElevenLabs **Voice Design API** to generate a custom voice per character based on their profile.
- A central `Character Registry` saves the `voice_id` mapping.

### 2.3 The Text-to-Dialogue Loop (P0 Priority)
- The backend batches consecutive dialogue turns and formats them into a JSON array.
- Sends payloads to the ElevenLabs **Text-to-Dialogue API** (`/v1/dialogue`).
- **Constraint**: Payloads are strictly chunked to stay under the 2,000-character limit.
- Audio streams are returned and stitched sequentially via `ffmpeg` in the backend before being stored in Supabase.

### 2.4 Interactive Conversational Mode (WebSockets)
- Users can pause playback and initiate a conversational Q&A.
- Powered by ElevenLabs Conversational AI Agents.
- **Multi-voice Support**: The agent can dynamically switch between the Narrator's voice and specific Character voices in real-time within the same conversation.
- **Agent Transfer**: If the context shifts drastically, the backend uses Agent Transfer to hand off the user to a specialized agent.
- Frontend uses `@elevenlabs/client` for seamless WebSocket integration.

---

## 3. System Architecture

### 3.1 Tech Stack
- **Frontend**: Next.js 15 (React, TypeScript), Zustand, Framer Motion, `@elevenlabs/client`.
- **Backend Orchestrator**: Python FastAPI.
- **AI/LLM**: GCP Model Garden (Gemini).
- **Audio Generation**: ElevenLabs API (10 distinct endpoints utilized).
- **Database & Storage**: Supabase (PostgreSQL + Blob Storage).

### 3.2 Data Flow & Processing Pipeline
1. **Upload & Chunking**: Next.js frontend sends raw text to FastAPI backend. FastAPI splits the novel into logical chunks (e.g., chapters or scene blocks).
2. **LLM Extraction (Rolling Window)**: 
   - FastAPI sends Chunk 1 to GCP Model Garden.
   - Extracts `Characters` and `Dialogue Turns`. 
   - Registers new characters to DB. Passes the existing `Character Registry` to Chunk 2's prompt to maintain consistency.
3. **Voice Generation**: FastAPI queries ElevenLabs Voice Design for any newly discovered characters and maps the returned `voice_id`s.
4. **Dialogue Batching (The 2k Loop)**:
   - FastAPI accumulates dialogue turns. Once the batch approaches ~1,800 characters, it wraps it in the Text-to-Dialogue JSON schema.
   - Executes the `/v1/dialogue` endpoint.
5. **Audio Stitching**: FastAPI concatenates the raw audio buffers using `ffmpeg` and uploads the compiled audio file to Supabase Storage.
6. **Playback**: Next.js retrieves the Supabase URL and plays the audio via Wavesurfer.js.

### 3.3 Resilience & Fault Tolerance
- **Exponential Backoff**: FastAPI must use `tenacity` to handle `429 Too Many Requests` from ElevenLabs and GCP.
- **Structured LLM Parsing**: Enforce strict Pydantic JSON schemas on GCP outputs to prevent parser crashes.

---

## 4. API Specifications & ElevenLabs Integrations

### 4.1 ElevenLabs Integrations
| Feature | ElevenLabs Endpoint | Usage in VoiceTale |
|---------|---------------------|--------------------|
| **Voice Design** | `POST /v1/voice-generation/generate-voice` | Create custom voices based on LLM profiles. |
| **Text-to-Dialogue** | `POST /v1/dialogue` | Generates multi-speaker scenes (the core 2k-char batch loop). |
| **TTS (v3)** | `POST /v1/text-to-speech/{voice_id}` | Narration lines using emotional audio tags (`[whispers]`). |
| **Conversational AI** | `/v1/convai/agents/{agent_id}` | Setup agents with Multi-voice support. |
| **Agent Realtime** | `wss://api.elevenlabs.io/v1/convai/conversation` | Interactive frontend Q&A via `@elevenlabs/client`. |

### 4.2 FastAPI Core Endpoints
- `POST /api/process_story`: Ingests raw text, triggers background task for LLM parsing and audio generation. Returns task ID.
- `GET /api/story_status/{task_id}`: Polling endpoint for frontend to get generation progress.
- `PATCH /api/update_agent_context`: Updates the Conversational Agent's context/prompt based on the current timestamp of the audio the user is listening to.

---

## 5. Next Steps for Development (Immediate Execution)

As per architectural constraints, the immediate focus is:
1. **FastAPI Setup**: Scaffold the Python backend.
2. **The 2k Loop**: Implement the algorithm to safely chunk dialogue turns under 2,000 characters and execute the `/v1/dialogue` request.
3. **Frontend WebSocket**: Scaffold the Next.js UI specifically for the conversational Q&A layer using `@elevenlabs/client`.
