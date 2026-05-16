import type {
  Story,
  Character,
  PageData,
  PageSummary,
  Session,
  Voice,
} from "./types";

// All requests use relative paths; Next.js rewrites (next.config.mjs) proxy
// /api/* to the backend (NEXT_PUBLIC_BACKEND_URL) to avoid browser CORS.
const API_URL = "";

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // #region agent log
  fetch("http://127.0.0.1:7526/ingest/961202cd-c5d8-4866-bb97-7c7fd4c9f5f8", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "0b705f",
    },
    body: JSON.stringify({
      sessionId: "0b705f",
      runId: "initial",
      hypothesisId: "H1",
      location: "frontend/src/lib/api.ts:jsonFetch:beforeFetch",
      message: "Client fetch started",
      data: { path, hasAbsoluteApiBase: Boolean(API_URL), method: init?.method || "GET" },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
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
    // #region agent log
    fetch("http://127.0.0.1:7526/ingest/961202cd-c5d8-4866-bb97-7c7fd4c9f5f8", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "0b705f",
      },
      body: JSON.stringify({
        sessionId: "0b705f",
        runId: "initial",
        hypothesisId: "H2",
        location: "frontend/src/lib/api.ts:jsonFetch:nonOk",
        message: "Client fetch received non-ok response",
        data: { path, status: res.status, statusText: res.statusText },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    let detail = "";
    try {
      const data = await res.json();
      detail = data?.detail || JSON.stringify(data);
    } catch {
      detail = res.statusText;
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  // #region agent log
  fetch("http://127.0.0.1:7526/ingest/961202cd-c5d8-4866-bb97-7c7fd4c9f5f8", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "0b705f",
    },
    body: JSON.stringify({
      sessionId: "0b705f",
      runId: "initial",
      hypothesisId: "H2",
      location: "frontend/src/lib/api.ts:jsonFetch:ok",
      message: "Client fetch succeeded",
      data: { path, status: res.status },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
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
