"use client";

import Link from "next/link";
import { useReadingLibrary } from "@/context/ReadingLibraryContext";

export default function SavedBooksPage() {
  const { saved, toggleSaved } = useReadingLibrary();

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
          Your Collection
        </p>
        <h1 className="font-headline-lg text-headline-lg text-primary">
          Saved Books
        </h1>
      </header>

      {saved.length === 0 ? (
        <div className="glass-panel bg-surface/60 rounded-xl p-12 text-center">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant mb-3 block">
            bookmark_border
          </span>
          <h3 className="font-title-lg text-title-lg text-primary mb-2">
            No saved books yet
          </h3>
          <p className="font-body-md text-on-surface-variant mb-6">
            Browse the library and bookmark stories you love.
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
          {saved.map((b) => (
            <div
              key={b.story_id}
              className="glass-panel bg-surface/60 rounded-xl p-6 flex flex-col"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center text-lg font-headline-lg">
                  {b.title.charAt(0).toUpperCase()}
                </div>
                <button
                  onClick={() => toggleSaved(b.story_id)}
                  className="text-primary hover:scale-110 transition-transform"
                  aria-label="Remove bookmark"
                >
                  <span className="material-symbols-outlined">bookmark</span>
                </button>
              </div>
              <h3 className="font-title-lg text-title-lg text-primary mb-1 line-clamp-2">
                {b.title}
              </h3>
              <p className="font-body-md text-on-surface-variant mb-1">
                {b.total_pages} pages
              </p>
              <p className="font-label-sm text-label-sm text-on-surface-variant capitalize mb-4">
                {b.status}
              </p>
              <div className="mt-auto">
                <Link
                  href={`/story/${b.story_id}`}
                  className="inline-flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-full font-label-md text-label-md hover:scale-105 transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    play_arrow
                  </span>
                  Continue Reading
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
