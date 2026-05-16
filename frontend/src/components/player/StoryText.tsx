"use client";

import { useEffect, useRef, useCallback } from "react";
import type { WordToken } from "@/hooks/useStoryPlayer";

interface StoryTextProps {
  words: WordToken[];
  activeIndex: number;
  fallbackText?: string;
  onWordClick?: (index: number) => void;
}

export function StoryText({
  words,
  activeIndex,
  fallbackText,
  onWordClick,
}: StoryTextProps) {
  const activeRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    }
  }, [activeIndex]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!onWordClick) return;
      const target = e.target as HTMLElement;
      const idx = target.closest<HTMLElement>("[data-word-idx]")?.dataset
        .wordIdx;
      if (idx != null) onWordClick(Number(idx));
    },
    [onWordClick]
  );

  if (words.length === 0) {
    if (fallbackText?.trim()) {
      return (
        <p className="font-body-lg text-body-lg leading-[2] text-on-surface whitespace-pre-wrap">
          {fallbackText}
        </p>
      );
    }
    return (
      <p className="font-body-lg text-on-surface-variant">Loading text…</p>
    );
  }

  const clickable = Boolean(onWordClick);

  return (
    <div
      className="font-body-lg text-body-lg leading-[2] text-on-surface select-text"
      onClick={handleClick}
    >
      {words.map((w, i) => {
        const isActive = i === activeIndex;
        const isSpoken = i < activeIndex;
        return (
          <span key={i}>
            <span
              ref={isActive ? activeRef : null}
              data-word-idx={i}
              className={`word-token${clickable ? " clickable" : ""} ${
                isActive ? "active" : isSpoken ? "spoken" : ""
              }`}
            >
              {w.text}
            </span>{" "}
          </span>
        );
      })}
    </div>
  );
}
