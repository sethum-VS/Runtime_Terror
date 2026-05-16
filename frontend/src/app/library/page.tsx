"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { api } from "@/lib/api";
import type { Story } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { useReadingLibrary } from "@/context/ReadingLibraryContext";
import { pickPageVariants } from "@/lib/animations";

export default function LibraryPage() {
  const [stories, setStories] = useState<Story[] | null>(null);
  const { user } = useAuth();
  const { isSaved, toggleSaved } = useReadingLibrary();
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const reduced = useReducedMotion();
  const { item } = pickPageVariants(reduced);

  useEffect(() => {
    api
      .listStories()
      .then(setStories)
      .catch(() => setStories([]));
  }, []);

  async function handleToggleBookmark(storyId: string) {
    setTogglingIds((prev) => new Set(prev).add(storyId));
    try {
      await toggleSaved(storyId);
    } catch {}
    setTogglingIds((prev) => {
      const next = new Set(prev);
      next.delete(storyId);
      return next;
    });
  }

  return (
    <main className="pt-[160px] pb-section-margin px-container-padding-mobile md:px-container-padding-desktop max-w-[1280px] mx-auto">
      <motion.header variants={item} className="mb-10">
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
      </motion.header>

      {!user && (
        <motion.div variants={item} className="glass-panel bg-primary-container/40 rounded-xl px-6 py-4 mb-8 flex items-center gap-3">
          <span className="material-symbols-outlined text-[24px] text-primary">
            info
          </span>
          <p className="font-body-md text-on-surface-variant">
            <Link
              href="/auth/sign-in"
              className="text-secondary hover:underline font-label-md"
            >
              Sign in
            </Link>{" "}
            to upload your own stories and save your favorites.
          </p>
        </motion.div>
      )}

      {stories === null && (
        <motion.div
          variants={item}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-card-gap"
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="glass-panel bg-surface/50 rounded-xl p-6 h-44 shimmer"
            />
          ))}
        </motion.div>
      )}

      {stories && stories.length === 0 && (
        <motion.div
          variants={item}
          className="glass-panel bg-surface/60 rounded-xl p-12 text-center"
        >
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant mb-3 block">
            menu_book
          </span>
          <h3 className="font-title-lg text-title-lg text-primary mb-2">
            No books available
          </h3>
          <p className="font-body-md text-on-surface-variant mb-6">
            Upload a PDF from the home page to add your first audiobook.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-full font-label-md text-label-md hover:scale-105 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">
              cloud_upload
            </span>
            Go to Home
          </Link>
        </motion.div>
      )}

      {stories && stories.length > 0 && (
        <motion.div
          variants={item}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-card-gap"
        >
          {stories.map((s) => (
            <div
              key={s.id}
              className="glass-panel bg-surface/60 rounded-xl p-6 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] transition-all duration-300 flex flex-col"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">
                    auto_stories
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {user && (
                    <button
                      onClick={() => handleToggleBookmark(s.id)}
                      disabled={togglingIds.has(s.id)}
                      className="text-primary hover:scale-110 transition-transform disabled:opacity-50"
                      aria-label={
                        isSaved(s.id) ? "Remove bookmark" : "Add bookmark"
                      }
                    >
                      <span className="material-symbols-outlined">
                        {isSaved(s.id) ? "bookmark" : "bookmark_border"}
                      </span>
                    </button>
                  )}
                  <StatusBadge status={s.status} />
                </div>
              </div>
              <Link href={`/story/${s.id}`} className="flex-1">
                <h3 className="font-title-lg text-title-lg text-primary mb-1 line-clamp-2">
                  {s.title}
                </h3>
                <p className="font-body-md text-on-surface-variant">
                  {s.total_pages} {s.total_pages === 1 ? "page" : "pages"}
                </p>
              </Link>
            </div>
          ))}
        </motion.div>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: Story["status"] }) {
  const map: Record<Story["status"], { label: string; cls: string }> = {
    uploaded: {
      label: "Uploaded",
      cls: "bg-surface-variant text-on-surface-variant",
    },
    parsing: {
      label: "Parsing",
      cls: "bg-secondary-container text-on-secondary-container",
    },
    parsed: {
      label: "Parsed",
      cls: "bg-secondary-container text-on-secondary-container",
    },
    profiling: {
      label: "Casting voices",
      cls: "bg-secondary-container text-on-secondary-container",
    },
    profiled: {
      label: "Voices ready",
      cls: "bg-primary-container text-on-primary-container",
    },
    generating_page1: {
      label: "Generating",
      cls: "bg-secondary-container text-on-secondary-container",
    },
    ready: { label: "Ready", cls: "bg-primary text-on-primary" },
    failed: {
      label: "Failed",
      cls: "bg-error-container text-on-error-container",
    },
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
