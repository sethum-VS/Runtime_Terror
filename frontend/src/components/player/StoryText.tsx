"use client";

import { useEffect, useRef } from "react";
import type { WordToken } from "@/hooks/useStoryPlayer";

interface StoryTextProps {
  words: WordToken[];
  activeIndex: number;
}

export function StoryText({ words, activeIndex }: StoryTextProps) {
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

  if (words.length === 0) {
    return (
      <p className="font-body-lg text-on-surface-variant">
        Loading text…
      </p>
    );
  }

  return (
    <div className="font-body-lg text-body-lg leading-[2] text-on-surface select-text">
      {words.map((w, i) => {
        const isActive = i === activeIndex;
        const isSpoken = i < activeIndex;
        return (
          <span key={i}>
            <span
              ref={isActive ? activeRef : null}
              className={`word-token ${
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
