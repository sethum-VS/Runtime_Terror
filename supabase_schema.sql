-- ============================================
-- VOICETALE DATABASE SCHEMA (with Auth + RLS)
-- Run this entire block in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql/new
-- ============================================

-- ============================================
-- DROP EXISTING TABLES (clean reset)
-- ============================================
DROP TABLE IF EXISTS user_bookmarks CASCADE;
DROP TABLE IF EXISTS story_sessions CASCADE;
DROP TABLE IF EXISTS voice_library CASCADE;
DROP TABLE IF EXISTS story_pages CASCADE;
DROP TABLE IF EXISTS characters CASCADE;
DROP TABLE IF EXISTS stories CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS qa_sessions CASCADE;
DROP TABLE IF EXISTS showcase_stories CASCADE;

-- ============================================
-- 1. User Profiles
-- ============================================
CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    full_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    preferred_narrator_voice TEXT DEFAULT 'Auto',
    preferred_reading_theme TEXT DEFAULT 'Light',
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 2. Stories
-- ============================================
CREATE TABLE stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL DEFAULT 'Untitled Story',
    original_text TEXT,
    total_pages INT DEFAULT 0,
    status TEXT DEFAULT 'uploaded'
        CHECK (status IN ('uploaded','parsing','parsed','profiling','profiled','generating_page1','ready','failed')),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    user_id UUID REFERENCES auth.users ON DELETE SET NULL,
    is_showcase BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 3. Characters
-- ============================================
CREATE TABLE characters (
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

-- ============================================
-- 4. Story Pages
-- ============================================
CREATE TABLE story_pages (
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
    -- Live background (Veo 3.1 Lite + Gemini 2.5 Pro scene analysis)
    video_url TEXT,
    video_status TEXT DEFAULT 'idle'
        CHECK (video_status IN ('idle','generating','ready','failed','disabled')),
    scene_meta_json JSONB,
    video_error TEXT,
    video_generated_at TIMESTAMPTZ,
    UNIQUE(story_id, page_number)
);

-- ============================================
-- 5. Voice Library Cache
-- ============================================
CREATE TABLE voice_library (
    voice_id TEXT PRIMARY KEY,
    name TEXT,
    labels JSONB DEFAULT '{}',
    preview_url TEXT,
    category TEXT,
    description TEXT,
    cached_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 6. Story Sessions (user-scoped)
-- ============================================
CREATE TABLE story_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
    last_page INT DEFAULT 1,
    last_position FLOAT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(story_id, user_id)
);

-- ============================================
-- 7. User Bookmarks
-- ============================================
CREATE TABLE user_bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, story_id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_user_profiles_user ON user_profiles(user_id);
CREATE INDEX idx_stories_user ON stories(user_id);
CREATE INDEX idx_stories_showcase ON stories(is_showcase);
CREATE INDEX idx_characters_story ON characters(story_id);
CREATE INDEX idx_pages_story ON story_pages(story_id);
CREATE INDEX idx_pages_story_number ON story_pages(story_id, page_number);
CREATE INDEX idx_sessions_story ON story_sessions(story_id);
CREATE INDEX idx_sessions_user ON story_sessions(user_id);
CREATE INDEX idx_sessions_story_user ON story_sessions(story_id, user_id);
CREATE INDEX idx_bookmarks_user ON user_bookmarks(user_id);
CREATE INDEX idx_bookmarks_story ON user_bookmarks(story_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
    ON user_profiles FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile"
    ON user_profiles FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own profile"
    ON user_profiles FOR UPDATE
    USING (user_id = auth.uid());

-- stories
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view showcase or own stories"
    ON stories FOR SELECT
    USING (is_showcase = true OR user_id = auth.uid());

CREATE POLICY "Users can insert own stories"
    ON stories FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own stories"
    ON stories FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete own stories"
    ON stories FOR DELETE
    USING (user_id = auth.uid());

-- story_sessions
ALTER TABLE story_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sessions"
    ON story_sessions FOR ALL
    USING (user_id = auth.uid());

-- user_bookmarks
ALTER TABLE user_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bookmarks"
    ON user_bookmarks FOR ALL
    USING (user_id = auth.uid());

-- ============================================
-- STORAGE BUCKETS
-- ============================================

-- Story audio bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('story-audio', 'story-audio', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for story-audio" ON storage.objects
    FOR SELECT USING (bucket_id = 'story-audio');

CREATE POLICY "Service role upload for story-audio" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'story-audio');

CREATE POLICY "Service role update for story-audio" ON storage.objects
    FOR UPDATE USING (bucket_id = 'story-audio');

CREATE POLICY "Service role delete for story-audio" ON storage.objects
    FOR DELETE USING (bucket_id = 'story-audio');

-- Story video bucket (public — generated Veo background clips)
INSERT INTO storage.buckets (id, name, public)
VALUES ('story-video', 'story-video', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for story-video" ON storage.objects
    FOR SELECT USING (bucket_id = 'story-video');

CREATE POLICY "Service role upload for story-video" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'story-video');

CREATE POLICY "Service role update for story-video" ON storage.objects
    FOR UPDATE USING (bucket_id = 'story-video');

CREATE POLICY "Service role delete for story-video" ON storage.objects
    FOR DELETE USING (bucket_id = 'story-video');

-- Avatars bucket (public read, authenticated write)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for avatars" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated insert for avatars" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated update for avatars" ON storage.objects
    FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated delete for avatars" ON storage.objects
    FOR DELETE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
