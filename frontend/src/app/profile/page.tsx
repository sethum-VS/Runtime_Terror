"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useReadingLibrary } from "@/context/ReadingLibraryContext";
import { api } from "@/lib/api";
import type { UserProfile } from "@/lib/types";

export default function ProfilePage() {
  const { user } = useAuth();
  const { saved, recent } = useReadingLibrary();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    api.getProfile().then(setProfile).catch(() => {});
  }, []);

  const displayName =
    profile?.full_name || user?.email?.split("@")[0] || "User";
  const initials = displayName.charAt(0).toUpperCase();
  const inProgress = saved.filter(
    (b) => b.status === "ready" || b.status === "generating_page1"
  );

  return (
    <main className="pt-[160px] pb-section-margin px-container-padding-mobile md:px-container-padding-desktop max-w-[1280px] mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-card-gap">
        <div className="glass-panel bg-surface/60 rounded-xl p-8 flex flex-col items-center text-center">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={displayName}
              className="w-24 h-24 rounded-full object-cover mb-4"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-primary text-on-primary flex items-center justify-center text-3xl font-headline-lg mb-4">
              {initials}
            </div>
          )}
          <h1 className="font-headline-lg text-headline-lg text-primary">
            {displayName}
          </h1>
          <p className="font-body-md text-on-surface-variant mt-1">
            {user?.email}
          </p>
          {profile?.bio && (
            <p className="font-body-md text-on-surface-variant mt-3">
              {profile.bio}
            </p>
          )}

          <div className="flex gap-6 mt-6">
            <div className="text-center">
              <p className="font-headline-md text-headline-md text-primary">
                {saved.length}
              </p>
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">
                Saved
              </p>
            </div>
            <div className="text-center">
              <p className="font-headline-md text-headline-md text-primary">
                {inProgress.length}
              </p>
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">
                In Progress
              </p>
            </div>
          </div>

          <Link
            href="/profile/edit"
            className="mt-6 inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-full font-label-md text-label-md hover:scale-105 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
            Edit Profile
          </Link>
        </div>

        <div className="md:col-span-2 flex flex-col gap-card-gap">
          <section className="glass-panel bg-surface/60 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="font-label-sm text-label-sm uppercase tracking-widest text-secondary">
                Continue Reading
              </p>
              <Link
                href="/profile/progress"
                className="font-label-md text-label-md text-secondary hover:underline"
              >
                View all
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="font-body-md text-on-surface-variant">
                No recently read stories yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-card-gap">
                {recent.slice(0, 3).map((r) => (
                  <Link
                    key={r.story_id}
                    href={`/story/${r.story_id}`}
                    className="bg-surface-container-high rounded-xl p-4 hover:bg-primary/5 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center mb-3">
                      <span className="material-symbols-outlined text-[20px]">
                        auto_stories
                      </span>
                    </div>
                    <p className="font-title-lg text-title-lg text-primary line-clamp-1 text-sm">
                      {r.title}
                    </p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">
                      Page {r.last_page} / {r.total_pages}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="glass-panel bg-surface/60 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="font-label-sm text-label-sm uppercase tracking-widest text-secondary">
                Saved Books
              </p>
              <Link
                href="/profile/saved"
                className="font-label-md text-label-md text-secondary hover:underline"
              >
                View all
              </Link>
            </div>
            {saved.length === 0 ? (
              <p className="font-body-md text-on-surface-variant">
                No saved stories yet. Browse the library to save some!
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-card-gap">
                {saved.slice(0, 3).map((b) => (
                  <Link
                    key={b.story_id}
                    href={`/story/${b.story_id}`}
                    className="bg-surface-container-high rounded-xl p-4 hover:bg-primary/5 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center mb-3">
                      <span className="font-label-md text-label-md">
                        {b.title.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <p className="font-title-lg text-title-lg text-primary line-clamp-1 text-sm">
                      {b.title}
                    </p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">
                      {b.total_pages} pages
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
