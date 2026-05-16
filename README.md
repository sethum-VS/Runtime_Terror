# VoiceTale

> **AI-Powered Multi-Character Storybook Narrator**
> Cursor Colombo Buildathon 2026 — ElevenLabs Audio & Voice AI Track
> Team: **Runtime Terror**

VoiceTale transforms any PDF story into an immersive multi-character audio experience. Upload a story, and the system automatically:

1. Parses the text to identify characters, dialogue, and narration
2. Designs a unique ElevenLabs voice per character
3. Generates page-by-page audio (lazily — only as the user reads)
4. Plays back with **word-by-word read-along highlighting** synced to ElevenLabs timestamps

---

## Key Features

- **Full Cast Voices** — each character gets a personality-matched AI voice (not a single narrator)
- **Lazy Audio Generation** — pages generate on demand, saving ~70% ElevenLabs credits
- **Read-Along Highlighting** — word-level sync from ElevenLabs alignment data
- **Session Recovery** — refresh the page and resume exactly where you left off

## Tech Stack

| Layer        | Technology                                                   |
|--------------|--------------------------------------------------------------|
| Frontend     | Next.js 15 (App Router), TypeScript, Tailwind CSS, Framer Motion |
| Backend      | Python FastAPI (async)                                       |
| LLMs         | Gemini 2.0 Flash (Google AI Studio / Vertex AI)              |
| Voice / TTS  | ElevenLabs — Text-to-Dialogue, Voice Design, Voice Library, Audio Tags |
| Database     | Supabase (PostgreSQL + Storage)                              |
| Deployment   | Vercel (frontend) + GCP Cloud Run (backend)                  |

## ElevenLabs APIs Used

1. **Text-to-Dialogue (with timestamps)** — multi-speaker page audio + word alignment
2. **Voice Design** — synthesize unique character voices from text descriptions
3. **Voice Library** — match existing voices when a good fit exists (saves credits)
4. **Audio Tags** — `[whispers]`, `[laughs]`, `[speaks firmly]` for emotional delivery

## Repo Structure

```
voicetale/
├── backend/                 # Python FastAPI (deployed to GCP Cloud Run)
│   ├── app/
│   │   ├── main.py          # FastAPI app + CORS + lifespan
│   │   ├── config.py        # Pydantic settings
│   │   ├── dependencies.py  # Supabase / ElevenLabs / Gemini clients
│   │   ├── models/          # Pydantic schemas
│   │   ├── services/        # Pipeline: pdf -> parse -> profile -> dialogue -> audio
│   │   └── routes/          # /stories, /pages, /sessions, /voices
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/                # Next.js 15 app (deployed to Vercel)
│   ├── src/
│   │   ├── app/             # App-Router pages: /, /library, /voices, /about, /story/[id]
│   │   ├── components/      # Navbar, landing sections, player components
│   │   ├── hooks/           # useStoryPlayer (audio + word sync + lazy gen)
│   │   └── lib/             # API client + types
│   ├── tailwind.config.ts
│   ├── package.json
│   └── .env.local.example
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

### 2. Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env  # fill in keys
uvicorn app.main:app --reload --port 8000
```

Visit `http://localhost:8000/docs` to confirm.

### 3. Frontend

```powershell
cd frontend
npm install
copy .env.local.example .env.local  # set NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

```env
# ElevenLabs
ELEVENLABS_API_KEY=

# Google
GOOGLE_CLOUD_PROJECT=
GOOGLE_CLOUD_REGION=us-central1
GEMINI_API_KEY=

# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# App URLs
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
```

## API Surface (Backend)

| Method | Path                                                  | Description                              |
|--------|-------------------------------------------------------|------------------------------------------|
| POST   | `/api/stories/upload`                                 | Upload PDF, kicks off the pipeline       |
| GET    | `/api/stories`                                        | List recent stories                      |
| GET    | `/api/stories/{id}`                                   | Story status + metadata                  |
| GET    | `/api/stories/{id}/characters`                        | Character cast + assigned voices         |
| GET    | `/api/stories/{id}/pages`                             | Status of every page                    |
| GET    | `/api/stories/{id}/pages/{n}`                         | Page audio URL + timestamps              |
| POST   | `/api/stories/{id}/pages/{n}/generate`                | Trigger lazy audio generation            |
| GET    | `/api/stories/{id}/session`                           | Resume position                          |
| PUT    | `/api/stories/{id}/session`                           | Save resume position                     |
| GET    | `/api/voices`                                         | Cached ElevenLabs voice library          |
| POST   | `/api/voices/refresh`                                 | Re-fetch voice library                   |
| GET    | `/api/health`                                         | Health probe                             |

## Branch Strategy

- `prod` — Production-ready code (deployed)
- `dev` — Active development branch (default working branch)

## License

MIT
