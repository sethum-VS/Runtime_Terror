"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import type {
  Story,
  Character,
  PageData,
  DialogueInput,
  Session,
  TimestampChunk,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Word tokens with optional speaker attribution
// ---------------------------------------------------------------------------

export interface WordToken {
  text: string;
  start: number;
  end: number;
  characterId?: string;
  voiceId?: string;
}

/** Strip ElevenLabs [audio tags] so we can match raw text length to alignment chars. */
function stripAudioTags(text: string): string {
  return text.replace(/\[[^\]]*\]/g, "");
}

/**
 * Build a voice_id → character_id lookup from the cast list.
 */
function buildVoiceToCharacterMap(
  characters: Character[]
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const c of characters) {
    if (c.voice_id) map[c.voice_id] = c.character_id;
  }
  return map;
}

/**
 * Build word tokens with timing *and* speaker attribution.
 *
 * Speaker mapping works by aligning the flattened alignment character stream
 * against the ordered dialogue_json entries. Each dialogue entry's stripped
 * text length defines a contiguous character range; the voice_id on that entry
 * tells us who is speaking.
 */
export function buildWordsFromTimestamps(
  timestamps: TimestampChunk[],
  dialogueJson?: DialogueInput[] | null,
  voiceToCharacter?: Record<string, string>
): WordToken[] {
  // 1. Build per-character flat arrays
  const allChars: string[] = [];
  const allStarts: number[] = [];
  const allEnds: number[] = [];

  for (const chunk of timestamps) {
    const chars = chunk.characters || [];
    const starts = chunk.character_start_times || [];
    const ends = chunk.character_end_times || [];
    for (let i = 0; i < chars.length; i++) {
      allChars.push(chars[i]);
      allStarts.push(starts[i] ?? 0);
      allEnds.push(ends[i] ?? (starts[i] ?? 0));
    }
  }

  // 2. Build segment boundaries (cumulative char offsets) from dialogue_json
  type SegRange = { start: number; end: number; voiceId: string };
  const segRanges: SegRange[] = [];

  if (dialogueJson?.length) {
    let offset = 0;
    for (const seg of dialogueJson) {
      const stripped = stripAudioTags(seg.text);
      const len = stripped.length;
      segRanges.push({
        start: offset,
        end: offset + len,
        voiceId: seg.voice_id,
      });
      offset += len;
    }

    // Scale ranges if alignment char count differs from dialogue text length
    // (ElevenLabs may normalize text slightly differently).
    const totalSegChars = offset;
    const totalAlignChars = allChars.length;
    if (totalSegChars > 0 && totalAlignChars > 0 && totalSegChars !== totalAlignChars) {
      const scale = totalAlignChars / totalSegChars;
      let running = 0;
      for (const r of segRanges) {
        const scaledLen = Math.round((r.end - r.start) * scale);
        r.start = running;
        r.end = running + scaledLen;
        running += scaledLen;
      }
      if (segRanges.length) {
        segRanges[segRanges.length - 1].end = totalAlignChars;
      }
    }
  }

  function speakerAtCharIndex(idx: number): { voiceId?: string; characterId?: string } {
    if (!segRanges.length || !voiceToCharacter) return {};
    for (const r of segRanges) {
      if (idx >= r.start && idx < r.end) {
        return {
          voiceId: r.voiceId,
          characterId: voiceToCharacter[r.voiceId],
        };
      }
    }
    return {};
  }

  // 3. Group characters into words (same logic as before, plus speaker)
  const words: WordToken[] = [];
  let currentChars: string[] = [];
  let currentStart: number | null = null;
  let currentEnd: number | null = null;
  let wordFirstCharIdx = 0;

  const flush = () => {
    if (currentChars.length === 0) return;
    const text = currentChars.join("");
    if (text.trim()) {
      const speaker = speakerAtCharIndex(wordFirstCharIdx);
      words.push({
        text,
        start: currentStart ?? 0,
        end: currentEnd ?? (currentStart ?? 0),
        characterId: speaker.characterId,
        voiceId: speaker.voiceId,
      });
    }
    currentChars = [];
    currentStart = null;
    currentEnd = null;
  };

  for (let i = 0; i < allChars.length; i++) {
    const ch = allChars[i];
    const s = allStarts[i];
    const e = allEnds[i];

    if (ch === " " || ch === "\n" || ch === "\t") {
      flush();
    } else {
      if (currentStart === null) {
        currentStart = s;
        wordFirstCharIdx = i;
      }
      currentEnd = e;
      currentChars.push(ch);
    }
  }
  flush();
  return words;
}

/** Binary search: active word at playback time t (always scans from scratch). */
function findActiveWordIndex(words: WordToken[], t: number): number {
  if (!words.length || t < 0) return -1;

  let lo = 0;
  let hi = words.length - 1;

  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (words[mid].start <= t) lo = mid;
    else hi = mid - 1;
  }

  const w = words[lo];
  if (t >= w.start && t <= w.end) return lo;
  if (t < w.start) return lo > 0 ? lo - 1 : -1;
  return lo < words.length - 1 ? lo + 1 : lo;
}

interface UseStoryPlayerArgs {
  storyId: string;
}

export function useStoryPlayer({ storyId }: UseStoryPlayerArgs) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadedAudioUrlRef = useRef<string | null>(null);
  const audioListenersCleanupRef = useRef<(() => void) | null>(null);
  const pendingPlayRef = useRef(false);
  const autoPlayAfterLoadRef = useRef(false);
  const shouldResumePositionRef = useRef(false);
  const nextPageRequestedRef = useRef(false);
  const resumePositionRef = useRef(0);
  const lastSaveAtRef = useRef(0);

  const [story, setStory] = useState<Story | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [nextPageStatus, setNextPageStatus] = useState<
    "idle" | "generating" | "ready"
  >("idle");
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);

  const voiceToCharacter = useMemo(
    () => buildVoiceToCharacterMap(characters),
    [characters]
  );

  const words: WordToken[] = useMemo(
    () =>
      pageData?.timestamps_json
        ? buildWordsFromTimestamps(
            pageData.timestamps_json,
            pageData.dialogue_json,
            voiceToCharacter
          )
        : [],
    [pageData?.timestamps_json, pageData?.dialogue_json, voiceToCharacter]
  );

  const activeCharacterId =
    activeWordIndex >= 0 ? words[activeWordIndex]?.characterId ?? null : null;

  // ----- Bootstrapping: load story, characters, session -----
  useEffect(() => {
    if (!storyId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [s, chars, session] = await Promise.all([
          api.getStory(storyId),
          api.getCharacters(storyId),
          api
            .getSession(storyId)
            .catch(() =>
              ({ story_id: storyId, last_page: 1, last_position: 0 }) as Session
            ),
        ]);
        if (cancelled) return;
        setStory(s);
        setCharacters(chars);
        const startPage = Math.max(1, session.last_page || 1);
        const savedPosition = session.last_position || 0;
        setCurrentPage(startPage);
        if (savedPosition > 0) {
          resumePositionRef.current = savedPosition;
          shouldResumePositionRef.current = true;
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load story");
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [storyId]);

  // ----- Load (or generate) the current page on change -----
  useEffect(() => {
    if (!storyId || !currentPage) return;
    let cancelled = false;
    let pollHandle: ReturnType<typeof setInterval> | null = null;

    const ensurePage = async () => {
      setPageLoading(true);
      setPlayError(null);
      setActiveWordIndex(-1);
      setCurrentTime(0);
      setDuration(0);
      setPageData(null);
      loadedAudioUrlRef.current = null;
      shouldResumePositionRef.current = false;
      resumePositionRef.current = 0;
      if (!autoPlayAfterLoadRef.current) {
        setIsPlaying(false);
      }
      try {
        const p = await api.getPage(storyId, currentPage);
        if (cancelled) return;

        if (p.status === "ready") {
          setPageData(p);
          setPageLoading(false);
          nextPageRequestedRef.current = false;
          setNextPageStatus("idle");
          return;
        }

        if (p.status === "idle" || p.status === "failed") {
          await api.generatePage(storyId, currentPage);
        }

        // Poll until ready
        pollHandle = setInterval(async () => {
          if (cancelled) return;
          try {
            const fresh = await api.getPage(storyId, currentPage);
            if (fresh.status === "ready") {
              setPageData(fresh);
              setPageLoading(false);
              nextPageRequestedRef.current = false;
              setNextPageStatus("idle");
              if (pollHandle) clearInterval(pollHandle);
            } else if (fresh.status === "failed") {
              setError("Audio generation failed for this page.");
              setPageLoading(false);
              if (pollHandle) clearInterval(pollHandle);
            }
          } catch {
            /* keep polling */
          }
        }, 2000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load page");
        setPageLoading(false);
      }
    };
    ensurePage();

    return () => {
      cancelled = true;
      if (pollHandle) clearInterval(pollHandle);
    };
  }, [storyId, currentPage]);

  const tryStartPlayback = useCallback((audio: HTMLAudioElement) => {
    if (!pendingPlayRef.current && !autoPlayAfterLoadRef.current) return;

    pendingPlayRef.current = false;
    autoPlayAfterLoadRef.current = false;

    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch((err) => {
        console.error("[player] autoplay failed:", err);
        setPlayError("Could not start playback. Press play to retry.");
        setIsPlaying(false);
      });
  }, []);

  const bindAudioElement = useCallback(
    (audio: HTMLAudioElement | null) => {
      audioListenersCleanupRef.current?.();
      audioListenersCleanupRef.current = null;

      audioRef.current = audio;
      if (!audio) {
        loadedAudioUrlRef.current = null;
        return;
      }

      const url = pageData?.audio_url;
      if (!url) return;

      const srcMatches =
        loadedAudioUrlRef.current === url &&
        (audio.src === url ||
          audio.src.endsWith(url.split("/").pop() || "__none__"));

      if (!srcMatches) {
        audio.pause();
        audio.currentTime = 0;
        setCurrentTime(0);
        setActiveWordIndex(-1);
        audio.src = url;
        audio.load();
        loadedAudioUrlRef.current = url;
      }

      const pageWords = pageData?.timestamps_json
        ? buildWordsFromTimestamps(pageData.timestamps_json)
        : [];

      const onMeta = () => {
        const dur = audio.duration || 0;
        setDuration(dur);

        if (shouldResumePositionRef.current) {
          const resume = resumePositionRef.current;
          if (resume > 0 && resume < dur - 0.05) {
            audio.currentTime = resume;
            setCurrentTime(resume);
            setActiveWordIndex(findActiveWordIndex(pageWords, resume));
          }
          shouldResumePositionRef.current = false;
          resumePositionRef.current = 0;
        } else if (!srcMatches) {
          audio.currentTime = 0;
          setCurrentTime(0);
          setActiveWordIndex(-1);
        }
      };

      const onCanPlay = () => {
        setPlayError(null);
        tryStartPlayback(audio);
      };

      const onError = () => {
        setPlayError("Failed to load audio for this page.");
        setIsPlaying(false);
      };

      audio.addEventListener("loadedmetadata", onMeta);
      audio.addEventListener("canplay", onCanPlay);
      audio.addEventListener("error", onError);

      audioListenersCleanupRef.current = () => {
        audio.removeEventListener("loadedmetadata", onMeta);
        audio.removeEventListener("canplay", onCanPlay);
        audio.removeEventListener("error", onError);
      };

      if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        if (audio.duration) setDuration(audio.duration);
        tryStartPlayback(audio);
      }
    },
    [pageData?.audio_url, pageData?.timestamps_json, tryStartPlayback]
  );

  // Re-bind when page audio URL changes (same element, new page)
  useEffect(() => {
    if (audioRef.current && pageData?.audio_url) {
      bindAudioElement(audioRef.current);
    }
  }, [pageData?.audio_url, bindAudioElement]);

  // ----- Audio time updates: word highlight + lazy next page trigger -----
  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const t = audio.currentTime;
    setCurrentTime(t);

    if (words.length) {
      const found = findActiveWordIndex(words, t);
      setActiveWordIndex((prev) => (found !== prev ? found : prev));
    }

    // Lazy next-page trigger: <= 50 s remaining and we have a next page
    const remaining = (audio.duration || 0) - t;
    if (
      remaining > 0 &&
      remaining <= 50 &&
      !nextPageRequestedRef.current &&
      story &&
      currentPage < story.total_pages
    ) {
      nextPageRequestedRef.current = true;
      setNextPageStatus("generating");
      api
        .generatePage(storyId, currentPage + 1)
        .catch(() => {
          /* background */
        })
        .finally(() => {
          const poll = setInterval(async () => {
            try {
              const p = await api.getPage(storyId, currentPage + 1);
              if (p.status === "ready") {
                setNextPageStatus("ready");
                if (p.audio_url) {
                  const preload = new Audio(p.audio_url);
                  preload.preload = "auto";
                }
                clearInterval(poll);
              } else if (p.status === "failed") {
                clearInterval(poll);
              }
            } catch {
              /* keep polling */
            }
          }, 2000);
        });
    }

    // Throttled session save (max once per 5 seconds)
    const now = Date.now();
    if (now - lastSaveAtRef.current > 5000 && t > 0) {
      lastSaveAtRef.current = now;
      api.saveSession(storyId, currentPage, t).catch(() => {});
    }
  }, [words, story, currentPage, storyId]);

  // ----- Audio ended: auto-advance -----
  const handleEnded = useCallback(() => {
    if (story && currentPage < story.total_pages) {
      autoPlayAfterLoadRef.current = true;
      pendingPlayRef.current = true;
      shouldResumePositionRef.current = false;
      resumePositionRef.current = 0;
      setCurrentPage((p) => p + 1);
    } else {
      autoPlayAfterLoadRef.current = false;
      pendingPlayRef.current = false;
      setIsPlaying(false);
    }
  }, [story, currentPage]);

  const startPlayback = useCallback(async () => {
    const url = pageData?.audio_url;
    if (!url) {
      setPlayError("Audio is still generating for this page.");
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      setPlayError("Audio player not ready. Refresh the page.");
      return;
    }

    if (loadedAudioUrlRef.current !== url && pageData?.audio_url) {
      bindAudioElement(audio);
    }

    setPlayError(null);

    pendingPlayRef.current = true;
    autoPlayAfterLoadRef.current = false;

    try {
      await audio.play();
      pendingPlayRef.current = false;
      setIsPlaying(true);
    } catch (err) {
      // Source may still be buffering — retry when canplay fires
      if (audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
        return;
      }
      pendingPlayRef.current = false;
      console.error("[player] play failed:", err);
      setPlayError("Could not play audio. Check your browser audio settings.");
      setIsPlaying(false);
    }
  }, [pageData?.audio_url, bindAudioElement]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Use element state as source of truth (avoids desync after auto page change)
    const actuallyPlaying = !audio.paused && !audio.ended;

    if (actuallyPlaying) {
      autoPlayAfterLoadRef.current = false;
      pendingPlayRef.current = false;
      audio.pause();
      setIsPlaying(false);
      api.saveSession(storyId, currentPage, audio.currentTime).catch(() => {});
      return;
    }

    void startPlayback();
  }, [storyId, currentPage, startPlayback]);

  const handlePlay = useCallback(() => setIsPlaying(true), []);
  const handlePause = useCallback(() => setIsPlaying(false), []);

  const pauseAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      audio.pause();
      setIsPlaying(false);
    }
  }, []);

  const resumeAudio = useCallback(() => {
    void startPlayback();
  }, [startPlayback]);

  const seekToWord = useCallback(
    (index: number) => {
      const w = words[index];
      if (!w || !pageData?.audio_url) return;
      const audio = audioRef.current;
      if (!audio) return;
      const t = Math.max(0, Math.min(audio.duration || 0, w.start));
      audio.currentTime = t;
      setCurrentTime(t);
      setActiveWordIndex(index);
      if (audio.paused) void startPlayback();
    },
    [words, pageData?.audio_url, startPlayback]
  );

  const seekTo = useCallback(
    (seconds: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const t = Math.max(0, Math.min(audio.duration || 0, seconds));
      audio.currentTime = t;
      setCurrentTime(t);
      if (words.length) {
        setActiveWordIndex(findActiveWordIndex(words, t));
      }
    },
    [words]
  );

  const goToPage = useCallback(
    (n: number) => {
      if (!story) return;
      const target = Math.max(1, Math.min(story.total_pages, n));
      if (target === currentPage) return;
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      pendingPlayRef.current = false;
      autoPlayAfterLoadRef.current = false;
      shouldResumePositionRef.current = false;
      resumePositionRef.current = 0;
      loadedAudioUrlRef.current = null;
      setIsPlaying(false);
      setCurrentTime(0);
      setActiveWordIndex(-1);
      setCurrentPage(target);
    },
    [story, currentPage]
  );

  // Save session on unload
  useEffect(() => {
    const onBeforeUnload = () => {
      const audio = audioRef.current;
      if (audio) {
        navigator.sendBeacon?.(
          `/api/stories/${storyId}/session`,
          new Blob(
            [
              JSON.stringify({
                last_page: currentPage,
                last_position: audio.currentTime,
              }),
            ],
            { type: "application/json" }
          )
        );
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [storyId, currentPage]);

  // Enable play when page audio exists; click handler loads/buffers if needed.
  const canPlay =
    Boolean(pageData?.audio_url) &&
    pageData?.status === "ready" &&
    !pageLoading;

  return {
    audioRef,
    bindAudioElement,
    story,
    characters,
    pageData,
    currentPage,
    isPlaying,
    currentTime,
    duration,
    activeWordIndex,
    activeCharacterId,
    nextPageStatus,
    error,
    pageLoading,
    playError,
    canPlay,
    words,
    handleTimeUpdate,
    handleEnded,
    handlePlay,
    handlePause,
    togglePlay,
    seekTo,
    seekToWord,
    goToPage,
    pauseAudio,
    resumeAudio,
  };
}
