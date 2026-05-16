"use client";

interface PlayerControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  currentPage: number;
  totalPages: number;
  nextPageStatus: "idle" | "generating" | "ready";
  canPlay?: boolean;
  pageLoading?: boolean;
  onTogglePlay: () => void;
  onSeek: (s: number) => void;
  onPrev: () => void;
  onNext: () => void;
}

export function PlayerControls({
  isPlaying,
  currentTime,
  duration,
  currentPage,
  totalPages,
  nextPageStatus,
  canPlay = true,
  pageLoading = false,
  onTogglePlay,
  onSeek,
  onPrev,
  onNext,
}: PlayerControlsProps) {
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const playDisabled = pageLoading || (!canPlay && !isPlaying);

  return (
    <div className="glass-panel bg-surface/80 rounded-xl p-6 shadow-[0_20px_40px_rgba(0,0,0,0.06)]">
      {/* Progress bar */}
      <div
        role="slider"
        tabIndex={0}
        aria-valuenow={currentTime}
        aria-valuemin={0}
        aria-valuemax={duration}
        className="h-2 bg-surface-container-high rounded-full cursor-pointer overflow-hidden"
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          const pct = (e.clientX - rect.left) / rect.width;
          onSeek(pct * duration);
        }}
      >
        <div
          className="h-full bg-secondary rounded-full transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <div className="flex justify-between mt-2 font-label-sm text-label-sm text-on-surface-variant">
        <span>{formatTime(currentTime)}</span>
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-8 mt-6">
        <button
          onClick={onPrev}
          disabled={currentPage <= 1}
          className="text-on-surface-variant hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          aria-label="Previous page"
        >
          <span className="material-symbols-outlined text-[36px]">
            skip_previous
          </span>
        </button>

        <button
          onClick={onTogglePlay}
          disabled={playDisabled && !isPlaying}
          className="w-16 h-16 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-[0_10px_20px_rgba(3,31,65,0.25)] hover:scale-105 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          <span className="material-symbols-outlined text-[36px]">
            {isPlaying ? "pause" : "play_arrow"}
          </span>
        </button>

        <button
          onClick={onNext}
          disabled={currentPage >= totalPages}
          className="text-on-surface-variant hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          aria-label="Next page"
        >
          <span className="material-symbols-outlined text-[36px]">
            skip_next
          </span>
        </button>
      </div>

      {nextPageStatus === "generating" && (
        <p className="text-center mt-4 font-label-sm text-label-sm text-secondary uppercase tracking-widest flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-[16px] animate-spin">
            progress_activity
          </span>
          Buffering next page…
        </p>
      )}
      {nextPageStatus === "ready" && currentPage < totalPages && (
        <p className="text-center mt-4 font-label-sm text-label-sm text-primary uppercase tracking-widest flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-[16px]">
            check_circle
          </span>
          Next page ready
        </p>
      )}
    </div>
  );
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
