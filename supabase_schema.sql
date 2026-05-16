-- ============================================
-- VOICETALE DATABASE SCHEMA
-- Run this entire block in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql/new
-- ============================================

-- 1. Stories table
CREATE TABLE IF NOT EXISTS stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL DEFAULT 'Untitled Story',
    original_text TEXT,
    total_pages INT DEFAULT 0,
    status TEXT DEFAULT 'uploaded'
        CHECK (status IN ('uploaded','parsing','parsed','profiling','profiled','generating_page1','ready','failed')),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Characters table
CREATE TABLE IF NOT EXISTS characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    character_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    role TEXT CHECK (role IN ('protagonist','antagonist','supporting','narrator')),
    speaking_style TEXT,
    estimated_age TEXT,
    gender TEXT,
    voice_strategy TEXT CHECK (voice_strategy IN ('library_match','voice_design')),
    voice_id TEXT,
    voice_design_prompt TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Story Pages table
CREATE TABLE IF NOT EXISTS story_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    page_number INT NOT NULL,
    status TEXT DEFAULT 'idle'
        CHECK (status IN ('idle','generating','ready','failed')),
    raw_segments JSONB,
    dialogue_json JSONB,
    audio_url TEXT,
    timestamps_json JSONB,
    char_count INT DEFAULT 0,
    error_message TEXT,
    generated_at TIMESTAMPTZ,
    UNIQUE(story_id, page_number)
);

-- 4. Voice Library Cache
CREATE TABLE IF NOT EXISTS voice_library (
    voice_id TEXT PRIMARY KEY,
    name TEXT,
    labels JSONB DEFAULT '{}',
    preview_url TEXT,
    category TEXT,
    description TEXT,
    cached_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Story Sessions (page refresh recovery)
CREATE TABLE IF NOT EXISTS story_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    last_page INT DEFAULT 1,
    last_position FLOAT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(story_id)
);

-- 6. [SUB-FEATURE] Q&A Sessions
CREATE TABLE IF NOT EXISTS qa_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    page_number INT,
    question TEXT,
    answer TEXT,
    audio_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. [SUB-FEATURE] Showcase Stories
CREATE TABLE IF NOT EXISTS showcase_stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID REFERENCES stories(id),
    title TEXT,
    cover_image_url TEXT,
    description TEXT,
    total_duration FLOAT,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_characters_story ON characters(story_id);
CREATE INDEX IF NOT EXISTS idx_pages_story ON story_pages(story_id);
CREATE INDEX IF NOT EXISTS idx_pages_story_number ON story_pages(story_id, page_number);
CREATE INDEX IF NOT EXISTS idx_sessions_story ON story_sessions(story_id);

-- ============================================
-- STORAGE BUCKET SETUP
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('story-audio', 'story-audio', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access" ON storage.objects
    FOR SELECT USING (bucket_id = 'story-audio');

CREATE POLICY "Service role upload" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'story-audio');

CREATE POLICY "Service role update" ON storage.objects
    FOR UPDATE USING (bucket_id = 'story-audio');

CREATE POLICY "Service role delete" ON storage.objects
    FOR DELETE USING (bucket_id = 'story-audio');
