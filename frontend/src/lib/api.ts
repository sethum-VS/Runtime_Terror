import type {
  Story,
  Character,
  PageData,
  PageSummary,
  Session,
  Voice,
} from "./types";

const API_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
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
};

export { API_URL };
