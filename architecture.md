# VoiceTale — Architecture Diagrams

## High-Level System Architecture

```mermaid
graph TB
    subgraph Client["Client Layer"]
        Browser["User Browser<br/><i>React 19 + Tailwind + Framer Motion</i>"]
    end

    subgraph Frontend["Frontend — Vercel"]
        NextJS["Next.js 15<br/><i>App Router, TypeScript</i>"]
        Proxy["/api/[...path] Proxy"]
    end

    subgraph Backend["Backend — GCP Cloud Run"]
        FastAPI["FastAPI<br/><i>Python async</i>"]
        subgraph Services["Service Layer"]
            PDF["pdf_converter"]
            Parser["story_parser"]
            Profiler["character_profiler"]
            VoiceSvc["voice_service"]
            DialogueMap["dialogue_mapper"]
            Chunker["chunker"]
            AudioGen["audio_generator"]
            AmbientGen["ambient_generator"]
            Safety["voice_safety"]
        end
    end

    subgraph External["External Services"]
        EL["ElevenLabs<br/><i>TTS, Voice Design, SFX</i>"]
        ConvAI["ElevenLabs ConvAI<br/><i>Real-time Voice Agent</i>"]
        Gemini["Vertex AI<br/><i>Gemini 2.5 Flash</i>"]
        subgraph Supabase["Supabase"]
            PG["PostgreSQL<br/><i>8 tables</i>"]
            Storage["Storage<br/><i>story-audio, avatars</i>"]
            Auth["Auth<br/><i>JWT, RLS</i>"]
        end
    end

    Browser -->|"HTTP"| NextJS
    NextJS --> Proxy
    Proxy -->|"REST + JWT"| FastAPI
    FastAPI --> Services

    Browser -.->|"Signed WebSocket URL"| ConvAI
    Browser -.->|"Anon Key (Auth + Avatars)"| Supabase

    PDF --> Parser
    Parser --> Profiler
    Profiler --> VoiceSvc
    VoiceSvc --> DialogueMap
    DialogueMap --> Chunker
    Chunker --> AudioGen

    AudioGen -->|"text_to_dialogue"| EL
    AmbientGen -->|"text_to_sound_effects"| EL
    VoiceSvc -->|"Voice Design / Library"| EL
    Parser -->|"LLM Parsing"| Gemini
    Profiler -->|"Character Profiles"| Gemini
    DialogueMap -->|"Dialogue Mapping"| Gemini
    AmbientGen -->|"Vibe Zone Planning"| Gemini
    AudioGen -->|"Upload MP3"| Storage
    AmbientGen -->|"Upload Ambient"| Storage
    FastAPI -->|"Service Role Key"| PG
    FastAPI -->|"ConvAI Agent CRUD"| ConvAI
```

## Story Processing Pipeline

```mermaid
flowchart LR
    A["PDF Upload"] --> B["Text Extraction<br/><i>pymupdf4llm</i>"]
    B --> C["Story Parsing<br/><i>Gemini LLM</i>"]
    C --> D["Character<br/>Profiling<br/><i>Gemini LLM</i>"]
    D --> E["Voice<br/>Assignment<br/><i>ElevenLabs</i>"]
    E --> F["Page 1 Audio<br/><i>text_to_dialogue</i>"]
    E --> G["Page 1 Ambient<br/><i>text_to_SFX</i>"]

    F --> H["Upload to<br/>Supabase Storage"]
    G --> H

    style A fill:#4f46e5,color:#fff
    style C fill:#059669,color:#fff
    style D fill:#059669,color:#fff
    style E fill:#d97706,color:#fff
    style F fill:#d97706,color:#fff
    style G fill:#d97706,color:#fff
    style H fill:#7c3aed,color:#fff
```

## Lazy Page Generation (On Demand)

```mermaid
sequenceDiagram
    participant U as User Browser
    participant N as Next.js Proxy
    participant F as FastAPI
    participant G as Gemini
    participant E as ElevenLabs
    participant S as Supabase

    U->>N: POST /api/stories/{id}/pages/{n}/generate
    N->>F: Forward with JWT
    F->>S: Check page status
    S-->>F: status: pending

    F->>G: Map raw_segments → dialogue inputs
    G-->>F: Tagged dialogue JSON

    F->>F: Chunk for char limits

    F->>E: text_to_dialogue (with timestamps)
    E-->>F: MP3 audio + word alignment

    F->>S: Upload MP3 to story-audio bucket
    F->>S: Update story_pages (audio_url, timestamps)
    S-->>F: OK

    F-->>N: Page data + audio URL
    N-->>U: Response

    Note over U: Parallel ambient generation
    U->>N: POST .../ambient/generate
    N->>F: Forward
    F->>G: Infer setting + vibe zones
    F->>E: text_to_sound_effects (looping)
    F->>S: Upload ambient MP3s
    F-->>N: Ambient tracks
    N-->>U: Ambient URLs
```

## Voice Agent Conversation Flow

```mermaid
sequenceDiagram
    participant U as User Browser
    participant N as Next.js
    participant F as FastAPI
    participant E as ElevenLabs ConvAI

    U->>N: Start Conversation
    N->>F: POST /api/stories/{id}/conversation/start
    F->>F: Build narrator prompt from story context
    F->>E: Create ephemeral ConvAI agent
    E-->>F: agent_id + signed_url
    F-->>N: { agent_id, signed_url }
    N-->>U: signed_url

    U->>E: WebSocket connect (signed_url)
    Note over U,E: Real-time voice conversation<br/>Turbo v2 TTS (~250ms latency)
    U-->>E: User speaks
    E-->>U: Narrator responds (voice)

    U->>N: End Conversation
    N->>F: POST /api/stories/{id}/conversation/end
    F->>E: Delete ephemeral agent
    E-->>F: OK
```

## Authentication Flow

```mermaid
flowchart TB
    subgraph Browser
        UI["Sign In / Sign Up Page"]
        AC["AuthContext<br/><i>onAuthStateChange listener</i>"]
        API["api.ts<br/><i>jsonFetch with Bearer token</i>"]
    end

    subgraph Supabase_Auth["Supabase Auth"]
        SA["signInWithPassword<br/>signUp<br/>resetPasswordForEmail"]
        JWT["JWT (access_token)"]
    end

    subgraph Backend_Auth["FastAPI Auth"]
        Dep["get_current_user<br/><i>dependencies.py</i>"]
        Verify{"JWT_SECRET<br/>set?"}
        HS["HS256 decode<br/><i>python-jose</i>"]
        HTTP["GET /auth/v1/user<br/><i>httpx → Supabase</i>"]
        Role["Load role from<br/>user_profiles<br/><i>cached 300s</i>"]
    end

    UI --> SA
    SA --> JWT
    JWT --> AC
    AC --> API
    API -->|"Authorization: Bearer"| Dep
    Dep --> Verify
    Verify -->|"Yes"| HS
    Verify -->|"No"| HTTP
    HS --> Role
    HTTP --> Role
```

## Database Schema (Supabase PostgreSQL)

```mermaid
erDiagram
    user_profiles {
        uuid id PK
        text full_name
        text avatar_url
        text role
    }

    stories {
        uuid id PK
        text title
        text original_text
        int total_pages
        text status
        uuid user_id FK
        bool is_showcase
    }

    characters {
        uuid id PK
        uuid story_id FK
        text name
        text voice_id
        text voice_strategy
        text description
    }

    story_pages {
        uuid id PK
        uuid story_id FK
        int page_num
        jsonb raw_segments
        jsonb dialogue_json
        text audio_url
        jsonb timestamps_json
        text ambient_setting
    }

    page_ambient_tracks {
        uuid id PK
        uuid page_id FK
        text label
        text prompt
        text audio_url
        float start_fraction
    }

    voice_library {
        text voice_id PK
        text name
        text category
    }

    story_sessions {
        uuid user_id FK
        uuid story_id FK
        int last_page
        float last_position
    }

    user_bookmarks {
        uuid user_id FK
        uuid story_id FK
    }

    user_profiles ||--o{ stories : "uploads"
    user_profiles ||--o{ story_sessions : "has"
    user_profiles ||--o{ user_bookmarks : "saves"
    stories ||--o{ characters : "has"
    stories ||--o{ story_pages : "contains"
    stories ||--o{ story_sessions : "tracked_in"
    stories ||--o{ user_bookmarks : "bookmarked_in"
    story_pages ||--o{ page_ambient_tracks : "has"
```

## Frontend Route Map

```mermaid
graph LR
    subgraph Public
        Home["/"]
        Library["/library"]
        Voices["/voices"]
        About["/about"]
        Story["/story/[id]"]
    end

    subgraph Auth_Pages["Auth"]
        SignIn["/auth/sign-in"]
        SignUp["/auth/sign-up"]
        Forgot["/auth/forgot-password"]
    end

    subgraph Profile_Pages["Profile (Auth Required)"]
        Profile["/profile"]
        Edit["/profile/edit"]
        Saved["/profile/saved"]
        Progress["/profile/progress"]
        Settings["/profile/settings"]
    end

    Home -->|"Upload PDF"| Library
    Library -->|"Select story"| Story
    Home -->|"Browse"| Library
    SignIn -->|"Authenticated"| Profile
    SignUp -->|"Confirmed"| Profile
    Profile --> Edit
    Profile --> Saved
    Profile --> Progress
    Profile --> Settings
```
