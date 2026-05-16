"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useStoryPlayer } from "@/hooks/useStoryPlayer";
import { StoryText } from "@/components/player/StoryText";
import { PlayerControls } from "@/components/player/PlayerControls";
import { CharacterPanel } from "@/components/player/CharacterPanel";

export default function StoryPlayerPage() {
  const params = useParams<{ id: string }>();
  const storyId = params?.id;

  const player = useStoryPlayer({ storyId: storyId || "" });

  if (!storyId) {
    return <FullscreenStatus icon="error" message="Invalid story id" />;
  }

  if (player.error) {
    return (
      <FullscreenStatus
        icon="error"
        title="Something went wrong"
        message={player.error}
      />
    );
  }

  if (!player.story) {
    return <FullscreenStatus icon="auto_stories" message="Loading story…" />;
  }

  return (
    <main className="pt-[140px] pb-section-margin px-container-padding-mobile md:px-container-padding-desktop max-w-[1280px] mx-auto">
      {/* Hidden audio element */}
      <audio
        ref={player.audioRef}
        onTimeUpdate={player.handleTimeUpdate}
        onEnded={player.handleEnded}
        onPlay={() => {
          /* state managed via togglePlay */
        }}
        onPause={() => {
          /* state managed via togglePlay */
        }}
        preload="auto"
      />

      <header className="flex items-start justify-between gap-6 mb-8">
        <div className="min-w-0">
          <Link
            href="/library"
            className="inline-flex items-center gap-1 font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors mb-2"
          >
            <span className="material-symbols-outlined text-[16px]">
              arrow_back
            </span>
            Library
          </Link>
          <h1 className="font-headline-md text-headline-md text-primary truncate">
            {player.story.title}
          </h1>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-card-gap">
        {/* Story text + controls */}
        <div className="lg:col-span-8 flex flex-col gap-card-gap">
          <motion.div
            key={player.currentPage}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="glass-panel bg-surface/70 rounded-xl p-8 min-h-[420px] max-h-[60vh] overflow-y-auto"
          >
            {player.pageLoading || !player.pageData ? (
              <PageLoader />
            ) : (
              <StoryText
                words={player.words}
                activeIndex={player.activeWordIndex}
              />
            )}
          </motion.div>

          <PlayerControls
            isPlaying={player.isPlaying}
            currentTime={player.currentTime}
            duration={player.duration}
            currentPage={player.currentPage}
            totalPages={player.story.total_pages}
            nextPageStatus={player.nextPageStatus}
            onTogglePlay={player.togglePlay}
            onSeek={player.seekTo}
            onPrev={() => player.goToPage(player.currentPage - 1)}
            onNext={() => player.goToPage(player.currentPage + 1)}
          />
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 flex flex-col gap-card-gap">
          <CharacterPanel characters={player.characters} />
          <PageGrid
            currentPage={player.currentPage}
            totalPages={player.story.total_pages}
            onJump={player.goToPage}
          />
        </div>
      </div>
    </main>
  );
}

function PageLoader() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      <div className="h-4 rounded shimmer" />
      <div className="h-4 w-11/12 rounded shimmer" />
      <div className="h-4 w-10/12 rounded shimmer" />
      <div className="h-4 w-9/12 rounded shimmer" />
      <div className="h-4 rounded shimmer" />
      <p className="mt-6 font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
        <span className="material-symbols-outlined text-[16px] animate-spin">
          progress_activity
        </span>
        Generating page audio…
      </p>
    </div>
  );
}

function PageGrid({
  currentPage,
  totalPages,
  onJump,
}: {
  currentPage: number;
  totalPages: number;
  onJump: (n: number) => void;
}) {
  return (
    <div className="glass-panel bg-surface/60 rounded-xl p-6">
      <p className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant mb-4">
        Pages
      </p>
      <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => {
          const isActive = n === currentPage;
          return (
            <button
              key={n}
              onClick={() => onJump(n)}
              className={
                isActive
                  ? "aspect-square rounded-md bg-primary text-on-primary font-label-sm text-label-sm shadow-md"
                  : "aspect-square rounded-md bg-surface-container-high text-on-surface-variant hover:bg-secondary-container hover:text-on-secondary-container font-label-sm text-label-sm transition-colors"
              }
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FullscreenStatus({
  icon,
  title,
  message,
}: {
  icon: string;
  title?: string;
  message: string;
}) {
  return (
    <main className="pt-[200px] px-container-padding-mobile md:px-container-padding-desktop max-w-[640px] mx-auto text-center">
      <div className="glass-panel bg-surface/70 rounded-xl p-12">
        <span className="material-symbols-outlined text-[56px] text-primary mb-4 block">
          {icon}
        </span>
        {title && (
          <h1 className="font-title-lg text-title-lg text-primary mb-2">
            {title}
          </h1>
        )}
        <p className="font-body-md text-on-surface-variant">{message}</p>
      </div>
    </main>
  );
}
