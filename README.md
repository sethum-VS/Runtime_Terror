# VoiceTale

> **AI-Powered Multi-Character Storybook Narrator**
> Cursor Colombo Buildathon 2026 — ElevenLabs Audio & Voice AI Track
> Team: **Runtime Terror**

VoiceTale transforms any PDF story into an immersive multi-character audio experience. Upload a story, and the system automatically:

1. Parses the text to identify characters, dialogue, and narration
2. Designs a unique ElevenLabs voice per character
3. Generates page-by-page audio (lazily — only as the user reads)
4. Plays back with **word-by-word read-along highlighting** synced to ElevenLabs timestamps
5. Lets readers **talk to the narrator** in real time (ElevenLabs Conversational AI)

---

## Key Features

- **Full Cast Voices** — each character gets a personality-matched AI voice (not a single narrator)
- **Lazy Audio Generation** — pages generate on demand, saving ~70% ElevenLabs credits
- **Read-Along Highlighting** — word-level sync from ElevenLabs alignment data
- **Ambient Soundscapes** — AI-generated ambient sound loops per page (ElevenLabs Text-to-SFX), layered with a Web Audio mixer
- **Session Recovery** — refresh the page and resume exactly where you left off
- **Talk to Narrator** — real-time voice Q&A on the story player; uses ElevenLabs **Turbo v2** TTS (English agents) for low-latency, natural back-and-forth (override with **Flash v2** for minimum latency)
- **User Authentication** — email/password sign-in via Supabase Auth with JWT propagation to the backend
- **Bookmarks & Reading Library** — save stories and track recent reading progress across sessions
- **Showcase Stories** — admin-curated public stories visible to all users (including anonymous)

## Tech Stack

| Layer        | Technology                                                   |
|--------------|--------------------------------------------------------------|
| Frontend     | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Framer Motion |
| Backend      | Python FastAPI (async)                                       |
| Story LLM    | Gemini 2.5 Flash via **Vertex AI** (service account / ADC)   |
| Voice / TTS  | ElevenLabs — Text-to-Dialogue, Voice Design, Voice Library, Audio Tags, Text-to-SFX, ConvAI (Turbo/Flash v2) |
| Narrator LLM | Gemini via **ElevenLabs ConvAI** (`ELEVENLABS_CONVAI_MODEL`, default `gemini-2.0-flash`) |
| Auth         | Supabase Auth (email/password, JWT) + `@supabase/ssr`        |
| Database     | Supabase (PostgreSQL + Storage)                              |
| Real-time    | `@elevenlabs/react` (ConvAI WebSocket), Web Audio API (ambient mixer) |
| Deployment   | Vercel (frontend) + GCP Cloud Run (backend)                  |

## ElevenLabs APIs Used

1. **Text-to-Dialogue (with timestamps)** — multi-speaker page audio + word alignment
2. **Voice Design** — synthesize unique character voices from text descriptions (with retries and safety sanitization)
3. **Voice Library** — match existing voices when a good fit exists (saves credits)
4. **Audio Tags** — `[whispers]`, `[laughs]`, `[speaks firmly]` for emotional delivery
5. **Text-to-Sound-Effects** — ambient sound loops per page (vibe zones inferred by Gemini, looping enabled)
6. **Conversational AI (ConvAI)** — ephemeral narrator agents per story session; signed URLs so the API key stays on the backend

### Narrator voice agent (low-latency TTS)

Per [ElevenLabs guidance](https://elevenlabs.io/docs), real-time agents should use **Flash** or **Turbo** low-latency TTS. VoiceTale’s narrator is **English** (`language: "en"`), so the API requires **v2** models (not v2.5):

| Model ID | Latency | Use when |
|----------|---------|----------|
| `eleven_turbo_v2` | ~250–300ms | **Default** — best balance of speed and natural voice quality |
| `eleven_flash_v2` | ~75ms | Lowest latency for English |

For multilingual agents, use `eleven_turbo_v2_5` or `eleven_flash_v2_5` instead.

Set `ELEVENLABS_CONVAI_TTS_MODEL` in `backend/.env`. The agent’s reasoning model is separate (`ELEVENLABS_CONVAI_MODEL`, default `gemini-2.0-flash`).

## Repo Structure

```
voicetale/
├── backend/                 # Python FastAPI (deployed to GCP Cloud Run)
│   ├── app/
│   │   ├── main.py          # FastAPI app + CORS + lifespan + global error handler
│   │   ├── config.py        # Pydantic settings (BaseSettings from .env)
│   │   ├── dependencies.py  # Supabase / ElevenLabs / Vertex AI clients, JWT auth
│   │   ├── models/
│   │   │   └── schemas.py   # Pydantic DTOs (StoryStatus, PageStatus, responses)
│   │   ├── services/
│   │   │   ├── pdf_converter.py       # PDF → markdown (pymupdf4llm)
│   │   │   ├── story_parser.py        # Gemini: text → {title, characters, pages}
│   │   │   ├── character_profiler.py  # Gemini: voice descriptions + strategy
│   │   │   ├── voice_service.py       # ElevenLabs voice cache, design, library match
│   │   │   ├── voice_safety.py        # Sanitize Voice Design prompts/names
│   │   │   ├── dialogue_mapper.py     # Gemini: raw segments → dialogue inputs
│   │   │   ├── chunker.py            # Split dialogue for char limits
│   │   │   ├── audio_generator.py     # text_to_dialogue + MP3 concat + upload
│   │   │   └── ambient_generator.py   # Gemini vibe zones + SFX loops + upload
│   │   ├── routes/          # /stories, /pages, /sessions, /voices, /conversation,
│   │   │                    # /profile, /bookmarks, /ambient
│   │   └── utils/           # json_utils, character_roles, voice_errors, voice_logging
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/                # Next.js 15 app (deployed to Vercel)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx             # Landing (hero, features, upload)
│   │   │   ├── library/             # Story browser + bookmarks
│   │   │   ├── story/[id]/          # Interactive story player
│   │   │   ├── voices/              # Voice library browser
│   │   │   ├── about/               # About page
│   │   │   ├── auth/                # sign-in, sign-up, forgot-password
│   │   │   ├── profile/             # Dashboard, edit, saved, progress, settings
│   │   │   └── api/[...path]/       # Catch-all proxy to backend
│   │   ├── components/      # Navbar, PlayerControls, StoryText, CharacterPanel,
│   │   │                    # SoundMixerPanel, VoiceAgent, HeroSection, BentoGrid
│   │   ├── context/         # AuthContext, ReadingLibraryContext
│   │   ├── hooks/           # useStoryPlayer, useAmbientMixer, useVoiceAgent
│   │   └── lib/             # api.ts (REST client), supabaseClient.ts, types, siteNav
│   ├── tailwind.config.ts
│   ├── package.json
│   └── .env.local.example
├── architecture.md          # Mermaid architecture diagrams
├── supabase_schema.sql      # Run in Supabase SQL Editor
├── .env.example
├── .gitignore
└── README.md
```

## Quickstart

### 1. Set up Supabase

1. Create a project at https://supabase.com/dashboard
2. Open SQL Editor and run [`supabase_schema.sql`](./supabase_schema.sql)
3. Verify the `story-audio` storage bucket was created
4. Grab `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` from Project Settings → API

### 2. Google Cloud (Vertex AI)

Gemini calls use the **Vertex AI SDK** with Application Default Credentials (no `GEMINI_API_KEY`).

**Local development** (pick one):

```powershell
# Option A: gcloud CLI (recommended)
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID
gcloud auth application-default login

# Option B: service account JSON key
# Set GOOGLE_APPLICATION_CREDENTIALS in backend/.env to the key file path
```

On **Cloud Run**, attach the service account (e.g. `vertexai-api@...`); ADC is automatic. GitHub Actions deploy auth uses Workload Identity Federation separately from runtime LLM auth.

### 3. Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env   # fill in keys (see Environment Variables)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Visit `http://localhost:8000/docs` to confirm.

### 4. Frontend

```powershell
cd frontend
npm install
copy .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000` (or the LAN URL shown by Next.js — both work).

API requests are proxied through Next.js (`/api/*` → backend) so you avoid CORS issues in local dev. Leave `NEXT_PUBLIC_BACKEND_URL` unset in `.env.local` unless you need direct backend calls.

## Environment Variables

### Backend (`backend/.env`)

```env
# ElevenLabs
ELEVENLABS_API_KEY=

# Google Cloud / Vertex AI
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_REGION=us-central1
GEMINI_MODEL=gemini-2.5-flash
# Local dev only (optional if using gcloud auth application-default login):
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json

# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=             # Optional: enables local HS256 JWT verify (faster than HTTP fallback)

# App URLs
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000

# ElevenLabs Limits
ELEVENLABS_MAX_CONCURRENT=3
ELEVENLABS_MAX_CHARS_PER_REQUEST=2000

# Interactive narrator (ConvAI)
ELEVENLABS_CONVAI_MODEL=gemini-2.0-flash
ELEVENLABS_CONVAI_TTS_MODEL=eleven_turbo_v2

# Ambient sound generation
AMBIENT_LOOP_DURATION=            # Duration in seconds for SFX loops
AMBIENT_PROMPT_INFLUENCE=         # ElevenLabs prompt influence parameter
```

### Frontend (`frontend/.env.local`)

```env
# Optional: direct backend URL. Unset = proxy via Next.js (recommended locally).
# NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
BACKEND_URL=http://localhost:8000

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Local Development Notes

- **PDF upload**: Conversion uses `pymupdf4llm` with layout ML disabled (`use_layout(False)`) to avoid ONNX `int32`/`int64` errors on Windows. Text-based story PDFs work well; scanned-only PDFs may need OCR support later.
- **CORS**: Backend allows `localhost`, `127.0.0.1`, and common LAN IPs on port 3000. Prefer the Next.js API proxy for the simplest setup.
- **Required for uploads**: `SUPABASE_SERVICE_ROLE_KEY` must be set in `backend/.env` or story creation will fail after PDF conversion. Uploads also require authentication (sign in first).
- **Voice startup**: On backend start, the lifespan hook calls `cache_voice_library()` to pre-populate the ElevenLabs voice catalog in the DB (best-effort, non-blocking).
- **Global error handler**: `httpx` timeout errors return **503** (upstream busy); all other unhandled exceptions return **500** with detail.

## API Surface (Backend)

### Stories & Pages

| Method | Path                                                  | Auth     | Description                              |
|--------|-------------------------------------------------------|----------|------------------------------------------|
| POST   | `/api/stories/upload`                                 | Required | Upload PDF, kicks off the full pipeline  |
| GET    | `/api/stories`                                        | Optional | List stories (own + showcase, or showcase only) |
| GET    | `/api/stories/{id}`                                   | Optional | Story metadata (403 if not showcase & not owner) |
| GET    | `/api/stories/{id}/characters`                        | —        | Character cast + assigned voices         |
| POST   | `/api/stories/{id}/profile`                           | —        | Re-kick character profiling              |
| POST   | `/api/stories/{id}/showcase`                          | Admin    | Set `is_showcase` flag                   |
| GET    | `/api/stories/{id}/pages`                             | —        | Status of every page                     |
| GET    | `/api/stories/{id}/pages/{n}`                         | —        | Page audio URL + timestamps              |
| POST   | `/api/stories/{id}/pages/{n}/generate`                | —        | Trigger lazy audio generation            |

### Ambient Audio

| Method | Path                                                  | Auth     | Description                              |
|--------|-------------------------------------------------------|----------|------------------------------------------|
| POST   | `/api/stories/{id}/pages/{n}/ambient/generate`        | —        | Start ambient track generation for page  |
| GET    | `/api/stories/{id}/pages/{n}/ambient`                 | —        | List ambient tracks for page             |

### Sessions & Conversation

| Method | Path                                                  | Auth     | Description                              |
|--------|-------------------------------------------------------|----------|------------------------------------------|
| GET    | `/api/stories/{id}/session`                           | Optional | Resume position (defaults if anonymous)  |
| PUT    | `/api/stories/{id}/session`                           | Required | Save resume position                     |
| POST   | `/api/stories/{id}/conversation/start`                | —        | Create narrator agent + signed ConvAI URL |
| POST   | `/api/stories/{id}/conversation/end`                  | —        | Delete ephemeral narrator agent          |

### Voices

| Method | Path                                                  | Auth     | Description                              |
|--------|-------------------------------------------------------|----------|------------------------------------------|
| GET    | `/api/voices`                                         | —        | Cached ElevenLabs voice library          |
| POST   | `/api/voices/refresh`                                 | —        | Re-fetch voice library from ElevenLabs   |

### User Profile & Bookmarks

| Method | Path                                                  | Auth     | Description                              |
|--------|-------------------------------------------------------|----------|------------------------------------------|
| GET    | `/api/profile`                                        | Required | Get or create user profile               |
| PUT    | `/api/profile`                                        | Required | Update profile (name, avatar URL)        |
| GET    | `/api/bookmarks`                                      | Required | List bookmarked stories                  |
| POST   | `/api/bookmarks/{id}`                                 | Required | Add bookmark                             |
| DELETE | `/api/bookmarks/{id}`                                 | Required | Remove bookmark                          |
| GET    | `/api/bookmarks/{id}`                                 | Required | Check if story is bookmarked             |

### System

| Method | Path                                                  | Auth     | Description                              |
|--------|-------------------------------------------------------|----------|------------------------------------------|
| GET    | `/api/health`                                         | —        | Health probe                             |

## Database Schema

8 tables in Supabase PostgreSQL (defined in [`supabase_schema.sql`](./supabase_schema.sql)):

| Table                | Purpose                                              |
|----------------------|------------------------------------------------------|
| `user_profiles`      | User accounts with `role` (`user` / `admin`)         |
| `stories`            | Uploaded stories, processing status, `is_showcase`   |
| `characters`         | Per-story character cast with `voice_id` and strategy |
| `story_pages`        | Page content, audio URLs, timestamps, ambient setting |
| `page_ambient_tracks`| Layered ambient sound loops per page                 |
| `voice_library`      | Cached ElevenLabs voice catalog                      |
| `story_sessions`     | Reading resume position per user/story               |
| `user_bookmarks`     | Saved/favorited stories                              |

Storage buckets: `story-audio` (narration + ambient MP3s, public read), `avatars` (profile images).

## Authentication

- **Frontend**: Supabase Auth via `@supabase/ssr` — email/password sign-in/up, password reset, `onAuthStateChange` listener in `AuthContext`
- **API proxy**: Next.js catch-all route (`/api/[...path]`) forwards `Authorization: Bearer <access_token>` to the backend
- **Backend**: `dependencies.py` verifies JWT via `SUPABASE_JWT_SECRET` (HS256 decode) or falls back to `GET /auth/v1/user` on Supabase. User role is cached for 300s. Service-role key used for server-side DB writes (bypasses RLS).
- **Route protection**: `/profile/*` is client-side gated via `useRouter().replace` in `profile/layout.tsx`

## Architecture

See [`architecture.md`](./architecture.md) for detailed Mermaid diagrams covering:
- High-level system architecture
- Story processing pipeline
- Lazy page generation sequence
- Voice agent conversation flow
- Authentication flow
- Database ER diagram
- Frontend route map

## Branch Strategy

- `prod` — Production-ready code (deployed)
- `dev` — Active development branch (default working branch)

## License

MIT
