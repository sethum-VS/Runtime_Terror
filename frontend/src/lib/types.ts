export interface Story {
  id: string;
  title: string;
  status: StoryStatus;
  total_pages: number;
  error_message?: string | null;
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
