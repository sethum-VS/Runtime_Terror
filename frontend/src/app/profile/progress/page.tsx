"use client";

import Link from "next/link";
import { useReadingLibrary } from "@/context/ReadingLibraryContext";

export default function ReadingProgressPage() {
  const { recent } = useReadingLibrary();

  return (
    <main className="pt-[160px] pb-section-margin px-container-padding-mobile md:px-container-padding-desktop max-w-[1280px] mx-auto">
      <Link
        href="/profile"
        className="inline-flex items-center gap-1 font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors mb-4"
      >
        <span className="material-symbols-outlined text-[16px]">
          arrow_back
        </span>
        Profile
      </Link>

      <header className="mb-10">
        <p className="font-label-sm text-label-sm uppercase tracking-widest text-secondary mb-2">
          Your Activity
        </p>
        <h1 className="font-headline-lg text-headline-lg text-primary">
          Reading Progress
        </h1>
      </header>

      {recent.length === 0 ? (
        <div className="glass-panel bg-surface/60 rounded-xl p-12 text-center">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant mb-3 block">
            trending_up
          </span>
          <h3 className="font-title-lg text-title-lg text-primary mb-2">
            No reading history yet
          </h3>
          <p className="font-body-md text-on-surface-variant mb-6">
            Start reading a story to track your progress.
          </p>
          <Link
            href="/library"
            className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-full font-label-md text-label-md hover:scale-105 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">
              menu_book
            </span>
            Browse Library
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-card-gap">
          {recent.map((r) => {
            const pct =
              r.total_pages > 0
                ? Math.round((r.last_page / r.total_pages) * 100)
                : 0;
            return (
              <div
                key={r.story_id}
                className="glass-panel bg-surface/60 rounded-xl p-6 flex flex-col"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px]">
                      auto_stories
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-title-lg text-title-lg text-primary line-clamp-2 text-sm">
                      {r.title}
                    </h3>
                    <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">
                      Page {r.last_page} / {r.total_pages}
                    </p>
                  </div>
                </div>

                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      {pct}% complete
                    </span>
                  </div>
                  <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <p className="font-label-sm text-label-sm text-on-surface-variant mb-4">
                  Last opened:{" "}
                  {new Date(r.updated_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>

                <div className="mt-auto">
                  <Link
                    href={`/story/${r.story_id}`}
                    className="inline-flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-full font-label-md text-label-md hover:scale-105 transition-all"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      play_arrow
                    </span>
                    Continue Reading
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
