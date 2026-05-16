"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { SceneData } from "@/lib/types";

interface UseStorySceneBackgroundArgs {
  storyId: string;
  currentPage: number;
  totalPages: number;
  audioCurrentTime: number;
  audioDuration: number;
}

interface UseStorySceneBackgroundResult {
  currentScene: SceneData | null;
  nextScene: SceneData | null;
  status:
    | "idle"
    | "loading"
    | "generating"
    | "ready"
    | "failed"
    | "disabled";
}

const POLL_INTERVAL_MS = 5_000;
const NEXT_PAGE_LEAD_SECONDS = 60;

/**
 * Owns the scene/video background lifecycle:
 *
 *  - When `currentPage` changes, fetch the scene; if status is "idle" or
 *    "failed", trigger generation and poll until "ready".
 *  - When audio is near the end of the current page, kick off generation
 *    for the *next* page's scene (lazy preload, mirrors the audio gen).
 *  - Returns the active scene (for the visible video) and the staged next
 *    scene (so the LiveBackground component can preload it).
 */
export function useStorySceneBackground({
  storyId,
  currentPage,
  totalPages,
  audioCurrentTime,
  audioDuration,
}: UseStorySceneBackgroundArgs): UseStorySceneBackgroundResult {
  const [currentScene, setCurrentScene] = useState<SceneData | null>(null);
  const [nextScene, setNextScene] = useState<SceneData | null>(null);
  const [status, setStatus] = useState<
    "idle" | "loading" | "generating" | "ready" | "failed" | "disabled"
  >("idle");

  const nextRequestedRef = useRef<Record<number, boolean>>({});
  const disabledRef = useRef(false);

  const fetchSceneOnce = useCallback(
    async (page: number): Promise<SceneData | null> => {
      try {
        return await api.getScene(storyId, page);
      } catch (err) {
        console.warn(`[scene] getScene(${page}) failed:`, err);
        return null;
      }
    },
    [storyId]
  );

  const ensureScene = useCallback(
    async (page: number): Promise<SceneData | null> => {
      const initial = await fetchSceneOnce(page);
      if (!initial) return null;
      if (initial.status === "disabled") {
        disabledRef.current = true;
        return initial;
      }
      if (initial.status === "ready") return initial;
      if (initial.status === "generating") return initial;

      try {
        await api.generateScene(storyId, page);
      } catch (err) {
        console.warn(`[scene] generateScene(${page}) failed:`, err);
      }
      return await fetchSceneOnce(page);
    },
    [storyId, fetchSceneOnce]
  );

  // ----- Load + poll current page scene -----
  useEffect(() => {
    if (!storyId || !currentPage) return;
    if (disabledRef.current) return;

    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | null = null;

    setStatus("loading");
    setCurrentScene(null);

    (async () => {
      const initial = await ensureScene(currentPage);
      if (cancelled || !initial) return;
      setCurrentScene(initial);

      if (initial.status === "ready") {
        setStatus("ready");
        return;
      }
      if (initial.status === "disabled") {
        setStatus("disabled");
        return;
      }
      if (initial.status === "failed") {
        setStatus("failed");
        return;
      }

      setStatus("generating");
      poll = setInterval(async () => {
        if (cancelled) return;
        const fresh = await fetchSceneOnce(currentPage);
        if (!fresh) return;
        setCurrentScene(fresh);
        if (fresh.status === "ready") {
          setStatus("ready");
          if (poll) clearInterval(poll);
        } else if (fresh.status === "failed") {
          setStatus("failed");
          if (poll) clearInterval(poll);
        } else if (fresh.status === "disabled") {
          setStatus("disabled");
          disabledRef.current = true;
          if (poll) clearInterval(poll);
        }
      }, POLL_INTERVAL_MS);
    })();

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
    };
  }, [storyId, currentPage, ensureScene, fetchSceneOnce]);

  // ----- Lazy next-page scene preload (mirrors audio's lazy generation) -----
  useEffect(() => {
    if (disabledRef.current) return;
    if (!storyId || !audioDuration || currentPage >= totalPages) return;

    const remaining = audioDuration - audioCurrentTime;
    if (remaining <= 0 || remaining > NEXT_PAGE_LEAD_SECONDS) return;

    const nextPage = currentPage + 1;
    if (nextRequestedRef.current[nextPage]) return;
    nextRequestedRef.current[nextPage] = true;

    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | null = null;

    (async () => {
      const initial = await ensureScene(nextPage);
      if (cancelled || !initial) return;
      setNextScene(initial);
      if (initial.status === "ready" || initial.status === "disabled") return;

      poll = setInterval(async () => {
        if (cancelled) return;
        const fresh = await fetchSceneOnce(nextPage);
        if (!fresh) return;
        setNextScene(fresh);
        if (
          fresh.status === "ready" ||
          fresh.status === "failed" ||
          fresh.status === "disabled"
        ) {
          if (poll) clearInterval(poll);
        }
      }, POLL_INTERVAL_MS);
    })();

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
    };
  }, [
    storyId,
    currentPage,
    totalPages,
    audioCurrentTime,
    audioDuration,
    ensureScene,
    fetchSceneOnce,
  ]);

  // When the page advances, the previously staged "next" scene becomes the
  // current one — clear the slot so the lazy effect can re-arm.
  useEffect(() => {
    setNextScene(null);
  }, [currentPage]);

  return { currentScene, nextScene, status };
}
