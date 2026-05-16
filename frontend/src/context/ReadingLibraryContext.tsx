"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { api } from "@/lib/api";
import type { BookmarkEntry } from "@/lib/types";

const RECENT_KEY = "voicetale_recent_stories";
const MAX_RECENT = 20;

export interface RecentEntry {
  story_id: string;
  title: string;
  total_pages: number;
  last_page: number;
  last_position: number;
  updated_at: string;
}

interface ReadingLibraryContextValue {
  saved: BookmarkEntry[];
  recent: RecentEntry[];
  isSaved: (storyId: string) => boolean;
  toggleSaved: (storyId: string) => Promise<void>;
  refreshBookmarks: () => Promise<void>;
  recordRecent: (entry: Omit<RecentEntry, "updated_at">) => void;
}

const ReadingLibraryContext = createContext<ReadingLibraryContextValue | undefined>(
  undefined
);

function loadRecent(): RecentEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistRecent(entries: RecentEntry[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(entries));
  } catch {}
}

export function ReadingLibraryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [saved, setSaved] = useState<BookmarkEntry[]>([]);
  const [recent, setRecent] = useState<RecentEntry[]>([]);

  const refreshBookmarks = useCallback(async () => {
    if (!user) {
      setSaved([]);
      return;
    }
    try {
      const data = await api.listBookmarks();
      setSaved(data);
    } catch {
      setSaved([]);
    }
  }, [user]);

  useEffect(() => {
    refreshBookmarks();
  }, [refreshBookmarks]);

  useEffect(() => {
    setRecent(loadRecent());
  }, []);

  const isSaved = useCallback(
    (storyId: string) => saved.some((b) => b.story_id === storyId),
    [saved]
  );

  const toggleSaved = useCallback(
    async (storyId: string) => {
      if (isSaved(storyId)) {
        await api.removeBookmark(storyId);
      } else {
        await api.addBookmark(storyId);
      }
      await refreshBookmarks();
    },
    [isSaved, refreshBookmarks]
  );

  const recordRecent = useCallback(
    (entry: Omit<RecentEntry, "updated_at">) => {
      setRecent((prev) => {
        const filtered = prev.filter((r) => r.story_id !== entry.story_id);
        const next = [
          { ...entry, updated_at: new Date().toISOString() },
          ...filtered,
        ].slice(0, MAX_RECENT);
        persistRecent(next);
        return next;
      });
    },
    []
  );

  return (
    <ReadingLibraryContext.Provider
      value={{ saved, recent, isSaved, toggleSaved, refreshBookmarks, recordRecent }}
    >
      {children}
    </ReadingLibraryContext.Provider>
  );
}

export function useReadingLibrary() {
  const ctx = useContext(ReadingLibraryContext);
  if (!ctx)
    throw new Error(
      "useReadingLibrary must be used within ReadingLibraryProvider"
    );
  return ctx;
}
