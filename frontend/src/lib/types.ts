export interface Story {
  id: string;
  title: string;
  status: StoryStatus;
  total_pages: number;
  error_message?: string | null;
  is_showcase?: boolean;
  user_id?: string | null;
}

export type StoryStatus =
  | "uploaded"
  | "parsing"
  | "parsed"
  | "profiling"
  | "profiled"
  | "generating_page1"
  | "ready"
  | "failed";

export type PageStatus = "idle" | "generating" | "ready" | "failed";

export interface RawSegment {
  type: "narration" | "dialogue";
  text: string;
  character_id?: string;
  emotion?: string;
}

export interface DialogueInput {
  voice_id: string;
  text: string;
}

export interface TimestampChunk {
  chunk_index: number;
  characters: string[];
  character_start_times: number[];
  character_end_times: number[];
}

export interface PageData {
  page_number: number;
  status: PageStatus;
  audio_url?: string | null;
  timestamps_json?: TimestampChunk[] | null;
  dialogue_json?: DialogueInput[] | null;
  raw_segments?: RawSegment[] | null;
}

export interface PageSummary {
  page_number: number;
  status: PageStatus;
  audio_url?: string | null;
}

export interface Character {
  character_id: string;
  name: string;
  description?: string | null;
  role?: string | null;
  voice_id?: string | null;
  voice_strategy?: string | null;
}

export interface Session {
  story_id: string;
  last_page: number;
  last_position: number;
}

export interface Voice {
  voice_id: string;
  name: string;
  labels?: Record<string, string>;
  preview_url?: string;
  category?: string;
  description?: string;
}

export interface UserProfile {
  user_id: string;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  preferred_narrator_voice: string | null;
  preferred_reading_theme: string | null;
  role: string;
}

export interface BookmarkEntry {
  story_id: string;
  title: string;
  status: string;
  total_pages: number;
  is_showcase: boolean;
  created_at: string | null;
}

export interface ConversationStartResponse {
  signed_url: string;
  agent_id: string;
}

export type SceneStatus =
  | "idle"
  | "generating"
  | "ready"
  | "failed"
  | "disabled";

export interface SceneMeta {
  topic?: string | null;
  mood?: string | null;
  environment?: string | null;
  time_of_day?: string | null;
  weather?: string | null;
  visual_style?: string | null;
  color_palette?: string | null;
  camera_motion?: string | null;
  video_prompt?: string | null;
  negative_prompt?: string | null;
}

export interface SceneData {
  page_number: number;
  status: SceneStatus;
  video_url?: string | null;
  scene_meta?: SceneMeta | null;
  error_message?: string | null;
}
