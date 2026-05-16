-- ============================================
-- MIGRATION: Live Background (Veo 3.1 Lite) support
-- Adds: video_url + video_status + scene_meta on story_pages,
--       story-video storage bucket (public read).
-- Run this in Supabase SQL Editor on existing projects.
-- (supabase_schema.sql already creates the same columns for new projects.)
-- ============================================

ALTER TABLE story_pages
    ADD COLUMN IF NOT EXISTS video_url TEXT,
    ADD COLUMN IF NOT EXISTS video_status TEXT DEFAULT 'idle',
    ADD COLUMN IF NOT EXISTS scene_meta_json JSONB,
    ADD COLUMN IF NOT EXISTS video_error TEXT,
    ADD COLUMN IF NOT EXISTS video_generated_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'story_pages_video_status_check'
    ) THEN
        ALTER TABLE story_pages
            ADD CONSTRAINT story_pages_video_status_check
            CHECK (video_status IN ('idle','generating','ready','failed','disabled'));
    END IF;
END$$;

-- Storage bucket for generated MP4 backgrounds (public read).
INSERT INTO storage.buckets (id, name, public)
VALUES ('story-video', 'story-video', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Public read access for story-video'
    ) THEN
        CREATE POLICY "Public read access for story-video" ON storage.objects
            FOR SELECT USING (bucket_id = 'story-video');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Service role upload for story-video'
    ) THEN
        CREATE POLICY "Service role upload for story-video" ON storage.objects
            FOR INSERT WITH CHECK (bucket_id = 'story-video');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Service role update for story-video'
    ) THEN
        CREATE POLICY "Service role update for story-video" ON storage.objects
            FOR UPDATE USING (bucket_id = 'story-video');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Service role delete for story-video'
    ) THEN
        CREATE POLICY "Service role delete for story-video" ON storage.objects
            FOR DELETE USING (bucket_id = 'story-video');
    END IF;
END$$;
