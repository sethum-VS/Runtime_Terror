# VoiceTale

> **AI-Powered Multi-Character Storybook Narrator**
> Cursor Colombo Buildathon 2026 | ElevenLabs Audio & Voice AI Track

VoiceTale transforms any PDF story into an immersive, multi-character audio experience. Upload a story, and the system automatically parses characters, assigns unique AI-generated voices, and delivers page-by-page narration with read-along text highlighting.

## Features

- **Full Cast Voices** — Each character gets a personality-matched AI voice (not a single narrator)
- **Lazy Audio Generation** — Only generates pages as the user reads, saving ~70% ElevenLabs credits
- **Read-Along Highlighting** — Word-by-word text sync using ElevenLabs timestamps
- **Session Recovery** — Refresh the page and resume exactly where you left off

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15 (App Router), TypeScript, Tailwind CSS, Framer Motion |
| **Backend** | Python FastAPI |
| **LLMs** | Gemini 2.5 Flash + Llama 4 Scout (via GCP Vertex AI) |
| **Audio** | ElevenLabs (Voice Design, Text-to-Dialogue, Audio Tags, Sound Effects) |
| **Database** | Supabase (PostgreSQL + Storage) |
| **Deployment** | Vercel (Frontend) + GCP Cloud Run (Backend) |

## ElevenLabs APIs Used

1. **Text-to-Dialogue** — Multi-speaker audio generation with timestamps
2. **Voice Design** — Create character-matched voices from text descriptions
3. **Voice Library** — Search and match existing voices
4. **Audio Tags** — Emotional delivery (`[whispers]`, `[laughs]`, `[speaks firmly]`)
5. **Sound Effects** — Ambient scene audio
6. **Conversational AI** — Interactive Q&A about the story

## Project Structure

```
voicetale/
├── backend/          # Python FastAPI (GCP Cloud Run)
├── frontend/         # Next.js 15 App (Vercel)
├── .env.example      # Environment variable template
└── README.md
```

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- ElevenLabs API Key
- Google Cloud Project with Vertex AI enabled
- Supabase Project

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/sethum-VS/Runtime_Terror.git
   cd Runtime_Terror
   ```

2. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

3. Backend setup:
   ```bash
   cd backend
   python -m venv .venv
   .venv\Scripts\activate   # Windows
   pip install -r requirements.txt
   uvicorn app.main:app --reload --port 8000
   ```

4. Frontend setup:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

```env
ELEVENLABS_API_KEY=
GOOGLE_CLOUD_PROJECT=
GOOGLE_CLOUD_REGION=us-central1
GEMINI_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
```

## Branch Strategy

- `prod` — Production-ready code
- `dev` — Active development branch

## Team

**Runtime Terror** — Cursor Colombo Buildathon 2026

## License

MIT
