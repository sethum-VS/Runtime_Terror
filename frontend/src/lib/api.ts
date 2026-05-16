import type {
  Story,
  Character,
  PageData,
  PageSummary,
  Session,
  Voice,
  UserProfile,
  BookmarkEntry,
} from "./types";

// Relative /api/* calls are handled by `src/app/api/[...path]/route.ts`, which
// proxies to BACKEND_URL on the server (avoids browser CORS to Cloud Run).
const API_URL = "";

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {};
  const { getSupabaseClient } = await import("./supabaseClient");
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.warn("[api] getSession failed:", error.message);
    return {};
  }
  const token = data.session?.access_token;
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...authHeaders,
      ...(init?.headers || {}),
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = "";
    try {
      const data = await res.json();
      detail = data?.detail || JSON.stringify(data);
    } catch {
      detail = res.statusText;
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  async uploadStory(file: File): Promise<Story> {
    const formData = new FormData();
    formData.append("file", file);
    return jsonFetch<Story>("/api/stories/upload", {
      method: "POST",
      body: formData,
    });
  },

  async getStory(storyId: string): Promise<Story> {
    return jsonFetch<Story>(`/api/stories/${storyId}`);
  },

  async listStories(): Promise<Story[]> {
    return jsonFetch<Story[]>("/api/stories");
  },

  async getCharacters(storyId: string): Promise<Character[]> {
    return jsonFetch<Character[]>(`/api/stories/${storyId}/characters`);
  },

  async getPage(storyId: string, pageNum: number): Promise<PageData> {
    return jsonFetch<PageData>(`/api/stories/${storyId}/pages/${pageNum}`);
  },

  async generatePage(storyId: string, pageNum: number): Promise<PageData> {
    return jsonFetch<PageData>(
      `/api/stories/${storyId}/pages/${pageNum}/generate`,
      { method: "POST" }
    );
  },

  async getAllPages(storyId: string): Promise<PageSummary[]> {
    return jsonFetch<PageSummary[]>(`/api/stories/${storyId}/pages`);
  },

  async getSession(storyId: string): Promise<Session> {
    return jsonFetch<Session>(`/api/stories/${storyId}/session`);
  },

  async saveSession(
    storyId: string,
    lastPage: number,
    lastPosition: number
  ): Promise<void> {
    await jsonFetch(`/api/stories/${storyId}/session`, {
      method: "PUT",
      body: JSON.stringify({
        last_page: lastPage,
        last_position: lastPosition,
      }),
    });
  },

  async listVoices(): Promise<Voice[]> {
    return jsonFetch<Voice[]>("/api/voices");
  },

  async getProfile() {
    return jsonFetch<UserProfile>("/api/profile");
  },

  async updateProfile(data: Partial<UserProfile>) {
    return jsonFetch<UserProfile>("/api/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async listBookmarks() {
    return jsonFetch<BookmarkEntry[]>("/api/bookmarks");
  },

  async addBookmark(storyId: string) {
    return jsonFetch<{ status: string }>(`/api/bookmarks/${storyId}`, {
      method: "POST",
    });
  },

  async removeBookmark(storyId: string) {
    return jsonFetch<{ status: string }>(`/api/bookmarks/${storyId}`, {
      method: "DELETE",
    });
  },

  async checkBookmark(storyId: string) {
    return jsonFetch<{ bookmarked: boolean }>(`/api/bookmarks/${storyId}`);
  },
};

export { API_URL };
