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

  // Auto-scroll the active word into view WITHOUT hijacking the page scroll.
  // `Element.scrollIntoView()` walks up every scrollable ancestor (including the
  // document), which yanks the main page around as the narrator advances. We
  // instead locate the nearest internal scroll container and adjust only its
  // scrollTop, so the surrounding page stays exactly where the user left it.
  useEffect(() => {
    const el = activeRef.current;
    if (!el) return;

    let scroller: HTMLElement | null = el.parentElement;
    while (scroller && scroller !== document.body) {
      const { overflowY } = window.getComputedStyle(scroller);
      const isScrollable =
        (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
        scroller.scrollHeight > scroller.clientHeight;
      if (isScrollable) break;
      scroller = scroller.parentElement;
    }

    if (!scroller || scroller === document.body || scroller === document.documentElement) {
      // No internal scroll container — do nothing rather than scroll the page.
      return;
    }

    const scrollerRect = scroller.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const elTopWithinScroller = elRect.top - scrollerRect.top + scroller.scrollTop;
    const target =
      elTopWithinScroller - scroller.clientHeight / 2 + el.offsetHeight / 2;

    scroller.scrollTo({
      top: Math.max(0, target),
      behavior: "smooth",
    });
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
