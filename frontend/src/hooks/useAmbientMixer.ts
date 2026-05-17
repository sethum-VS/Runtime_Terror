"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { AmbientTrack } from "@/lib/types";

export interface UseAmbientMixerReturn {
  volume: number;
  isEnabled: boolean;
  isLoading: boolean;
  trackLabel: string | null;
  setVolume: (vol: number) => void;
  toggleEnabled: () => void;
  syncStoryPlayback: (playing: boolean) => void;
}

const CROSSFADE_MS = 800;
const TOGGLE_FADE_MS = 200;
const DEFAULT_VOLUME = 0.7;
const MAX_OUTPUT_GAIN = 2.5;

function outputGain(slider: number): number {
  return Math.max(0, Math.min(MAX_OUTPUT_GAIN, slider * MAX_OUTPUT_GAIN));
}

type WiredTrack = {
  audio: HTMLAudioElement;
  gainNode: GainNode;
  bufferSource?: AudioBufferSourceNode;
  usesBuffer: boolean;
};

function normalizeBuffer(buffer: AudioBuffer): Promise<AudioBuffer> {
  let peak = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      peak = Math.max(peak, Math.abs(data[i]));
    }
  }
  if (peak < 0.01) return Promise.resolve(buffer);

  const ctx = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = 0.85 / peak;
  src.buffer = buffer;
  src.connect(gain);
  gain.connect(ctx.destination);
  src.start();
  return ctx.startRendering();
}

export function useAmbientMixer(
  storyId: string,
  currentPage: number,
  isStoryPlaying: boolean,
  currentTime: number,
  duration: number
): UseAmbientMixerReturn {
  const [volume, setVolumeState] = useState(DEFAULT_VOLUME);
  const [isEnabled, setIsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [trackLabel, setTrackLabel] = useState<string | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const wiredRef = useRef<Map<string, WiredTrack>>(new Map());
  const bufferCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const activeUrlRef = useRef<string | null>(null);
  const playSessionRef = useRef(0);

  const prevPageRef = useRef(-1);
  const isEnabledRef = useRef(isEnabled);
  const gainRef = useRef(outputGain(volume));
  const generateRequestedRef = useRef("");
  const isStoryPlayingRef = useRef(isStoryPlaying);

  const tracksRef = useRef<AmbientTrack[]>([]);
  const activeVibeRef = useRef(-1);

  isEnabledRef.current = isEnabled;
  gainRef.current = outputGain(volume);
  isStoryPlayingRef.current = isStoryPlaying;

  const ensureContext = useCallback(async (): Promise<AudioContext | null> => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
      const master = ctxRef.current.createGain();
      master.gain.value = 0;
      master.connect(ctxRef.current.destination);
      masterGainRef.current = master;
    }
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch (err) {
        console.warn("[AmbientMixer] AudioContext resume failed:", err);
      }
    }
    return ctx;
  }, []);

  const stopTrackSources = useCallback((wired: WiredTrack) => {
    if (wired.bufferSource) {
      try {
        wired.bufferSource.stop();
      } catch {
        /* ignore */
      }
      wired.bufferSource.disconnect();
      wired.bufferSource = undefined;
    }
    wired.audio.pause();
    try {
      wired.audio.currentTime = 0;
    } catch {
      /* ignore */
    }
  }, []);

  const silenceEverything = useCallback(() => {
    const ctx = ctxRef.current;
    const now = ctx?.currentTime ?? 0;

    for (const wired of wiredRef.current.values()) {
      if (ctx) {
        wired.gainNode.gain.cancelScheduledValues(now);
        wired.gainNode.gain.setValueAtTime(0, now);
      }
      stopTrackSources(wired);
    }

    if (masterGainRef.current && ctx) {
      masterGainRef.current.gain.cancelScheduledValues(now);
      masterGainRef.current.gain.setValueAtTime(0, now);
    }

    if (ctx?.state === "running") {
      void ctx.suspend();
    }
  }, [stopTrackSources]);

  const wireAudioElement = useCallback(
    async (audioUrl: string): Promise<WiredTrack | null> => {
      const cached = wiredRef.current.get(audioUrl);
      if (cached) return cached;

      const ctx = await ensureContext();
      if (!ctx || !masterGainRef.current) return null;

      const master = masterGainRef.current;
      const audio = new Audio();
      audio.loop = true;
      audio.preload = "auto";
      audio.crossOrigin = "anonymous";
      audio.src = audioUrl;

      try {
        await new Promise<void>((resolve, reject) => {
          const onReady = () => {
            audio.removeEventListener("canplaythrough", onReady);
            audio.removeEventListener("error", onErr);
            resolve();
          };
          const onErr = () => {
            audio.removeEventListener("canplaythrough", onReady);
            audio.removeEventListener("error", onErr);
            reject(new Error("load failed"));
          };
          if (audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
            resolve();
            return;
          }
          audio.addEventListener("canplaythrough", onReady, { once: true });
          audio.addEventListener("error", onErr, { once: true });
          audio.load();
        });

        try {
          const source = ctx.createMediaElementSource(audio);
          const gainNode = ctx.createGain();
          gainNode.gain.value = 0;
          source.connect(gainNode);
          gainNode.connect(master);
          const wired: WiredTrack = {
            audio,
            gainNode,
            usesBuffer: false,
          };
          wiredRef.current.set(audioUrl, wired);
          return wired;
        } catch (err) {
          console.warn(
            "[AmbientMixer] MediaElementSource failed, using buffer path:",
            err
          );
        }
      } catch {
        /* fall through to buffer fetch */
      }

      try {
        const resp = await fetch(audioUrl);
        const raw = await resp.arrayBuffer();
        let buffer = await ctx.decodeAudioData(raw.slice(0));
        buffer = await normalizeBuffer(buffer);
        bufferCacheRef.current.set(audioUrl, buffer);

        const gainNode = ctx.createGain();
        gainNode.gain.value = 0;
        gainNode.connect(master);
        const wired: WiredTrack = {
          audio,
          gainNode,
          usesBuffer: true,
        };
        wiredRef.current.set(audioUrl, wired);
        return wired;
      } catch (err) {
        console.error("[AmbientMixer] Load failed:", audioUrl, err);
        return null;
      }
    },
    [ensureContext]
  );

  const startBufferOnWired = useCallback(
    (wired: WiredTrack, audioUrl: string) => {
      const ctx = ctxRef.current;
      const buffer = bufferCacheRef.current.get(audioUrl);
      if (!ctx || !buffer) return;

      stopTrackSources(wired);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(wired.gainNode);
      source.start();
      wired.bufferSource = source;
    },
    [stopTrackSources]
  );

  const playTrackAudio = useCallback(
    async (audioUrl: string, crossfade: boolean) => {
      if (!isEnabledRef.current || !isStoryPlayingRef.current) return;

      const session = ++playSessionRef.current;
      const ctx = await ensureContext();
      if (!ctx || !masterGainRef.current || session !== playSessionRef.current) return;

      if (!isStoryPlayingRef.current) {
        silenceEverything();
        return;
      }

      const wired = await wireAudioElement(audioUrl);
      if (!wired || session !== playSessionRef.current) return;

      const targetGain = gainRef.current;
      const master = masterGainRef.current;
      const now = ctx.currentTime;

      const sameTrack = activeUrlRef.current === audioUrl;
      if (sameTrack) {
        const hasSource =
          wired.usesBuffer ? !!wired.bufferSource : !wired.audio.paused;
        if (hasSource) {
          wired.gainNode.gain.cancelScheduledValues(now);
          wired.gainNode.gain.setValueAtTime(targetGain, now);
          master.gain.cancelScheduledValues(now);
          master.gain.setValueAtTime(1, now);
          return;
        }
      }

      // Stop every other track immediately (prevents stacking / loud sums)
      for (const [url, w] of wiredRef.current.entries()) {
        if (url === audioUrl) continue;
        w.gainNode.gain.cancelScheduledValues(now);
        w.gainNode.gain.setValueAtTime(0, now);
        stopTrackSources(w);
      }

      if (!sameTrack) {
        stopTrackSources(wired);
      }

      activeUrlRef.current = audioUrl;

      const t1 = ctx.currentTime;
      wired.gainNode.gain.cancelScheduledValues(t1);
      if (crossfade) {
        wired.gainNode.gain.setValueAtTime(0, t1);
        wired.gainNode.gain.linearRampToValueAtTime(
          targetGain,
          t1 + CROSSFADE_MS / 1000
        );
      } else {
        wired.gainNode.gain.setValueAtTime(targetGain, t1);
      }

      if (wired.usesBuffer) {
        startBufferOnWired(wired, audioUrl);
      } else {
        try {
          await wired.audio.play();
        } catch {
          /* blocked until user gesture */
        }
      }

      if (session !== playSessionRef.current) return;

      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(1, ctx.currentTime);
    },
    [ensureContext, wireAudioElement, silenceEverything, startBufferOnWired]
  );

  const playActiveVibe = useCallback(
    async (crossfade: boolean) => {
      const tracks = tracksRef.current;
      if (!tracks.length) return;

      let vibeIdx = 0;
      if (duration > 0) {
        const frac = currentTime / duration;
        for (let i = tracks.length - 1; i >= 0; i--) {
          if (frac >= tracks[i].start_fraction) {
            vibeIdx = i;
            break;
          }
        }
      }

      const t = tracks[vibeIdx];
      if (!t?.audio_url) return;

      activeVibeRef.current = vibeIdx;
      setTrackLabel(t.label);
      await playTrackAudio(t.audio_url, crossfade);
    },
    [currentTime, duration, playTrackAudio]
  );

  const resumeAmbientForStory = useCallback(async () => {
    if (!isEnabledRef.current || !isStoryPlayingRef.current) return;

    await ensureContext();
    const url = activeUrlRef.current;
    if (url) {
      await playTrackAudio(url, false);
      return;
    }
    if (tracksRef.current.length > 0) {
      await playActiveVibe(false);
    }
  }, [ensureContext, playTrackAudio, playActiveVibe]);

  useEffect(() => {
    if (!isStoryPlaying) {
      silenceEverything();
    }
  }, [isStoryPlaying, silenceEverything]);

  useEffect(() => {
    if (!storyId || !currentPage) return;
    let cancelled = false;
    let pollHandle: ReturnType<typeof setInterval> | null = null;

    const fetchTracks = async () => {
      setIsLoading(true);
      activeVibeRef.current = -1;
      tracksRef.current = [];
      silenceEverything();
      activeUrlRef.current = null;

      const requestKey = `${storyId}:${currentPage}`;
      if (generateRequestedRef.current !== requestKey) {
        generateRequestedRef.current = requestKey;
        try {
          await api.generateAmbientTracks(storyId, currentPage);
        } catch {
          /* background */
        }
      }

      const waitForTracks = async (): Promise<AmbientTrack[]> => {
        const pickReady = (list: AmbientTrack[]) =>
          list.filter((t) => t.status === "ready" && t.audio_url);

        const pollUntilReady = (): Promise<AmbientTrack[]> =>
          new Promise((resolve) => {
            pollHandle = setInterval(async () => {
              if (cancelled) {
                if (pollHandle) clearInterval(pollHandle);
                return;
              }
              try {
                const fresh = await api.getAmbientTracks(storyId, currentPage);
                const ft = fresh.tracks || [];
                if (
                  ft.length &&
                  ft.every((t) => t.status === "ready" || t.status === "failed")
                ) {
                  if (pollHandle) clearInterval(pollHandle);
                  resolve(pickReady(ft));
                }
              } catch {
                /* keep polling */
              }
            }, 2000);
          });

        const res = await api.getAmbientTracks(storyId, currentPage);
        const tracks = res.tracks || [];
        if (!tracks.length) return pollUntilReady();
        if (tracks.every((t) => t.status === "ready" || t.status === "failed")) {
          return pickReady(tracks);
        }
        return pollUntilReady();
      };

      try {
        const readyTracks = await waitForTracks();
        if (cancelled) return;

        readyTracks.sort((a, b) => a.start_fraction - b.start_fraction);
        tracksRef.current = readyTracks;
        setIsLoading(false);

        if (readyTracks.length > 0) {
          const isCrossfade = prevPageRef.current > 0;
          prevPageRef.current = currentPage;
          setTrackLabel(readyTracks[0].label);

          if (isEnabledRef.current && isStoryPlayingRef.current) {
            activeVibeRef.current = 0;
            await playTrackAudio(readyTracks[0].audio_url!, isCrossfade);
          }
        } else {
          setTrackLabel(null);
          prevPageRef.current = currentPage;
        }
      } catch {
        if (!cancelled) {
          setTrackLabel(null);
          setIsLoading(false);
        }
      }
    };

    fetchTracks();

    return () => {
      cancelled = true;
      if (pollHandle) clearInterval(pollHandle);
    };
  }, [storyId, currentPage, playTrackAudio, silenceEverything]);

  useEffect(() => {
    const tracks = tracksRef.current;
    if (
      !isStoryPlayingRef.current ||
      !isEnabledRef.current ||
      tracks.length <= 1 ||
      duration <= 0
    ) {
      return;
    }

    const fraction = currentTime / duration;
    let targetVibe = 0;
    for (let i = tracks.length - 1; i >= 0; i--) {
      if (fraction >= tracks[i].start_fraction) {
        targetVibe = i;
        break;
      }
    }

    if (targetVibe !== activeVibeRef.current && tracks[targetVibe]?.audio_url) {
      activeVibeRef.current = targetVibe;
      setTrackLabel(tracks[targetVibe].label);
      void playTrackAudio(tracks[targetVibe].audio_url!, true);
    }
  }, [currentTime, duration, playTrackAudio]);

  const toggleEnabled = useCallback(() => {
    const next = !isEnabledRef.current;
    // Update ref synchronously so playTrackAudio's isEnabledRef check passes
    // before React commits the state update.
    isEnabledRef.current = next;
    setIsEnabled(next);
    if (next) {
      if (isStoryPlayingRef.current) {
        void playActiveVibe(false);
      }
    } else {
      silenceEverything();
      activeUrlRef.current = null;
    }
  }, [playActiveVibe, silenceEverything]);

  const setVolume = useCallback((slider: number) => {
    setVolumeState(slider);
    const g = outputGain(slider);
    gainRef.current = g;
    const url = activeUrlRef.current;
    if (!url) return;
    const wired = wiredRef.current.get(url);
    const ctx = ctxRef.current;
    if (wired && ctx) {
      wired.gainNode.gain.cancelScheduledValues(ctx.currentTime);
      wired.gainNode.gain.setValueAtTime(g, ctx.currentTime);
    }
  }, []);

  const syncStoryPlayback = useCallback(
    (playing: boolean) => {
      isStoryPlayingRef.current = playing;
      if (playing) {
        if (isEnabledRef.current) void resumeAmbientForStory();
      } else {
        silenceEverything();
      }
    },
    [silenceEverything, resumeAmbientForStory]
  );

  useEffect(() => {
    return () => {
      silenceEverything();
      wiredRef.current.clear();
      bufferCacheRef.current.clear();
    };
  }, [silenceEverything]);

  return {
    volume,
    isEnabled,
    isLoading,
    trackLabel,
    setVolume,
    toggleEnabled,
    syncStoryPlayback,
  };
}
