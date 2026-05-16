"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Story } from "@/lib/types";

export default function LibraryPage() {
  const [stories, setStories] = useState<Story[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listStories()
      .then(setStories)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  return (
    <main className="pt-[160px] pb-section-margin px-container-padding-mobile md:px-container-padding-desktop max-w-[1280px] mx-auto">
      <header className="mb-10">
        <p className="font-label-sm text-label-sm uppercase tracking-widest text-secondary mb-2">
          Your Audiobooks
        </p>
        <h1 className="font-headline-lg text-headline-lg text-primary">
          My Library
        </h1>
        <p className="font-body-lg text-on-surface-variant mt-3 max-w-xl">
          Every story you&apos;ve ever uploaded. Resume listening, share, or
          start a new tale.
        </p>
      </header>

      {error && (
        <div className="glass-panel bg-error-container/40 rounded-xl p-4 text-on-error-container mb-6">
          {error}
        </div>
      )}

      {!stories && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-card-gap">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="glass-panel bg-surface/50 rounded-xl p-6 h-44 shimmer"
            />
          ))}
        </div>
      )}

      {stories && stories.length === 0 && (
        <div className="glass-panel bg-surface/60 rounded-xl p-12 text-center">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant mb-3 block">
            menu_book
          </span>
          <h3 className="font-title-lg text-title-lg text-primary mb-2">
            No stories yet
          </h3>
          <p className="font-body-md text-on-surface-variant mb-6">
            Upload a PDF to bring your first story to life.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-full font-label-md text-label-md hover:scale-105 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">
              cloud_upload
            </span>
            Upload a Story
          </Link>
        </div>
      )}

      {stories && stories.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-card-gap">
          {stories.map((s) => (
            <Link
              key={s.id}
              href={`/story/${s.id}`}
              className="glass-panel bg-surface/60 rounded-xl p-6 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">
                    auto_stories
                  </span>
                </div>
                <StatusBadge status={s.status} />
              </div>
              <h3 className="font-title-lg text-title-lg text-primary mb-1 line-clamp-2">
                {s.title}
              </h3>
              <p className="font-body-md text-on-surface-variant">
                {s.total_pages} {s.total_pages === 1 ? "page" : "pages"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: Story["status"] }) {
  const map: Record<Story["status"], { label: string; cls: string }> = {
    uploaded: { label: "Uploaded", cls: "bg-surface-variant text-on-surface-variant" },
    parsing: { label: "Parsing", cls: "bg-secondary-container text-on-secondary-container" },
    parsed: { label: "Parsed", cls: "bg-secondary-container text-on-secondary-container" },
    profiling: { label: "Casting voices", cls: "bg-secondary-container text-on-secondary-container" },
    profiled: { label: "Voices ready", cls: "bg-primary-container text-on-primary-container" },
    generating_page1: { label: "Generating", cls: "bg-secondary-container text-on-secondary-container" },
    ready: { label: "Ready", cls: "bg-primary text-on-primary" },
    failed: { label: "Failed", cls: "bg-error-container text-on-error-container" },
  };
  const { label, cls } = map[status];
  return (
    <span
      className={`px-3 py-1 rounded-full font-label-sm text-label-sm ${cls}`}
    >
      {label}
    </span>
  );
}
