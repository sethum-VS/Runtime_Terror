"use client";

import { useEffect, useRef, useState } from "react";
import type { SceneData } from "@/lib/types";

interface LiveBackgroundProps {
  currentScene: SceneData | null;
  nextScene?: SceneData | null;
  /** Hook-level status (loading/generating/ready/failed/disabled/idle).
   * Used to decide whether to render a shimmer placeholder while the first
   * Veo clip is still being generated. */
  hookStatus?:
    | "idle"
    | "loading"
    | "generating"
    | "ready"
    | "failed"
    | "disabled";
  /** When true, the user is in an audio-playing state; the background plays.
   * When false, the background freezes (last frame) so it doesn't loop forever. */
  isPlaying: boolean;
}

type Slot = {
  key: number;
  url: string | null;
  visible: boolean;
};

/**
 * Full-bleed fixed-position video background that crossfades between Veo clips
 * as the story page changes. Two <video> elements are kept around so the next
 * clip can be preloaded and faded in over the current one, hiding any "blank
 * frame" gap.
 *
 * Behaviour:
 *  - When `currentScene.video_url` changes, the inactive slot gets the new
 *    src, starts buffering, and a CSS opacity transition swaps it in.
 *  - `nextScene.video_url` (if ready) is hinted as a `<link rel="preload">`
 *    so the browser starts fetching it during the lead-up to the page change.
 *  - When `isPlaying` is false the active video pauses (loop is still on),
 *    so on resume it picks up where it left off without an audio-visual jump.
 *  - All videos are muted so autoplay is allowed by the browser.
 *  - A dark gradient overlay sits on top to keep text legible regardless of
 *    the underlying scene brightness.
 *  - When no scene is ready yet, the component renders nothing (falls back
 *    to the app's static background) — so the page never looks broken.
 */
export function LiveBackground({
  currentScene,
  nextScene,
  hookStatus,
  isPlaying,
}: LiveBackgroundProps) {
  const url = currentScene?.video_url ?? null;
  const sceneStatus = currentScene?.status;

  const slotsRef = useRef<[Slot, Slot]>([
    { key: 0, url: null, visible: false },
    { key: 1, url: null, visible: false },
  ]);
  const activeIndexRef = useRef(0);
  const videoARef = useRef<HTMLVideoElement | null>(null);
  const videoBRef = useRef<HTMLVideoElement | null>(null);
  const [, forceRender] = useState(0);

  // Swap the inactive slot whenever the current scene URL changes.
  useEffect(() => {
    if (!url) return;
    const slots = slotsRef.current;
    const activeIdx = activeIndexRef.current;
    if (slots[activeIdx].url === url) return; // already showing it

    const nextIdx = activeIdx === 0 ? 1 : 0;
    slots[nextIdx] = { ...slots[nextIdx], url, visible: false };
    forceRender((n) => n + 1);

    // After the new <video> has mounted with the new src, fade it in.
    const handle = requestAnimationFrame(() => {
      const newVideo = nextIdx === 0 ? videoARef.current : videoBRef.current;
      if (newVideo) {
        newVideo.currentTime = 0;
        if (isPlaying) {
          newVideo.play().catch(() => {});
        }
      }
      slotsRef.current = [
        { ...slots[0], visible: nextIdx === 0 },
        { ...slots[1], visible: nextIdx === 1 },
      ];
      activeIndexRef.current = nextIdx;
      forceRender((n) => n + 1);

      // After the CSS transition finishes, clear the now-hidden slot's src so
      // the browser can free the decoder.
      setTimeout(() => {
        const stillActive = activeIndexRef.current;
        const hiddenIdx = stillActive === 0 ? 1 : 0;
        if (slotsRef.current[hiddenIdx].url !== url) {
          // Another swap happened already — leave it alone.
          return;
        }
        slotsRef.current[hiddenIdx] = {
          ...slotsRef.current[hiddenIdx],
          url: null,
        };
        forceRender((n) => n + 1);
      }, 1100);
    });
    return () => cancelAnimationFrame(handle);
  }, [url, isPlaying]);

  // Play/pause both videos in sync with `isPlaying`. Loop is always on.
  useEffect(() => {
    const videos = [videoARef.current, videoBRef.current];
    for (const v of videos) {
      if (!v) continue;
      if (isPlaying) {
        v.play().catch(() => {});
      } else {
        try {
          v.pause();
        } catch {
          /* noop */
        }
      }
    }
  }, [isPlaying]);

  if (!url) {
    // No live background yet — render the loading shimmer behind the dark
    // overlay only when generation is in flight. Otherwise render nothing
    // so the underlying app gradient remains.
    const showShimmer =
      sceneStatus === "generating" ||
      hookStatus === "loading" ||
      hookStatus === "generating";
    if (showShimmer) {
      return (
        <div
          aria-hidden
          className="fixed inset-0 -z-10 pointer-events-none overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-surface to-surface-container-high animate-pulse" />
          <div className="absolute inset-0 bg-black/40" />
        </div>
      );
    }
    return null;
  }

  const slots = slotsRef.current;

  return (
    <>
      {nextScene?.video_url ? (
        <link
          rel="preload"
          as="video"
          href={nextScene.video_url}
          // Next.js will warn about <link> outside <head> but it still works.
          // Suppress with a key so React reconciles it stably.
          key={`preload-${nextScene.video_url}`}
        />
      ) : null}

      <div
        aria-hidden
        className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-black"
      >
        <video
          ref={videoARef}
          src={slots[0].url ?? undefined}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[1100ms] ease-in-out will-change-transform"
          style={{
            opacity: slots[0].visible && slots[0].url ? 1 : 0,
            transform: "scale(1.05)",
            animation: slots[0].visible
              ? "kenburns 22s ease-in-out infinite alternate"
              : undefined,
          }}
        />
        <video
          ref={videoBRef}
          src={slots[1].url ?? undefined}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[1100ms] ease-in-out will-change-transform"
          style={{
            opacity: slots[1].visible && slots[1].url ? 1 : 0,
            transform: "scale(1.05)",
            animation: slots[1].visible
              ? "kenburns 22s ease-in-out infinite alternate"
              : undefined,
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/55 to-black/75" />

        <style jsx global>{`
          @keyframes kenburns {
            0% {
              transform: scale(1.05) translate3d(0, 0, 0);
            }
            100% {
              transform: scale(1.12) translate3d(-1.5%, -1%, 0);
            }
          }
        `}</style>
      </div>
    </>
  );
}
