"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import type { StoryStatus } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = {
  uploaded: "Converting PDF",
  parsing: "Finding characters & scenes",
  parsed: "Casting voices",
  profiling: "Designing voices for each character",
  profiled: "Preparing first page",
  generating_page1: "Generating page 1 audio",
};

const STATUS_ORDER: StoryStatus[] = [
  "uploaded",
  "parsing",
  "parsed",
  "profiling",
  "profiled",
  "generating_page1",
];

export function HeroSection() {
  const router = useRouter();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<StoryStatus | "">("");
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please upload a PDF file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large. Max 10 MB.");
      return;
    }

    setUploading(true);
    try {
      const story = await api.uploadStory(file);
      setUploading(false);
      setProcessing(true);
      setStatus(story.status as StoryStatus);

      const interval = setInterval(async () => {
        try {
          const s = await api.getStory(story.id);
          setStatus(s.status as StoryStatus);
          if (s.status === "ready") {
            clearInterval(interval);
            router.push(`/story/${story.id}`);
          } else if (s.status === "failed") {
            clearInterval(interval);
            setProcessing(false);
            setError(s.error_message || "Processing failed. Please try again.");
          }
        } catch (e) {
          clearInterval(interval);
          setProcessing(false);
          setError(e instanceof Error ? e.message : "Polling failed");
        }
      }, 2000);
    } catch (e) {
      setUploading(false);
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const openFilePicker = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,application/pdf";
    input.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) handleFile(f);
    };
    input.click();
  };

  return (
    <section className="grid grid-cols-1 md:grid-cols-12 gap-gutter min-h-[760px] items-center">
      {/* Left side */}
      <div className="col-span-1 md:col-span-5 flex flex-col gap-6 z-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel bg-surface/30 w-fit">
          <span className="material-symbols-outlined text-secondary text-sm">
            auto_awesome
          </span>
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">
            AI-Powered Multi-Character Storytelling
          </span>
        </div>

        <h1 className="font-display-lg text-display-lg text-primary">
          Read stories.
          <br />
          Hear every voice.
          <br />
          Feel every moment.
        </h1>

        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-lg">
          Upload any PDF storybook. VoiceTale identifies the cast, designs a
          unique AI voice for each character, and narrates page by page with
          read-along highlighting.
        </p>

        {!processing ? (
          <UploadDropzone
            uploading={uploading}
            dragOver={dragOver}
            onDragOver={(over) => setDragOver(over)}
            onPick={openFilePicker}
            onFile={handleFile}
            error={error}
          />
        ) : (
          <ProcessingPanel status={status} error={error} />
        )}

        <div className="flex flex-wrap gap-3 mt-2">
          <FeaturePill icon="record_voice_over" label="Character Voices" />
          <FeaturePill icon="surround_sound" label="Read-Along Sync" />
          <FeaturePill icon="menu_book" label="Page-by-Page Audio" />
        </div>
      </div>

      {/* Right side showcase */}
      <div className="col-span-1 md:col-span-7 relative h-[600px] w-full mt-12 md:mt-0">
        <ShowcaseGraphic />
      </div>
    </section>
  );
}

// ---------- Sub-components ----------

function FeaturePill({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-high text-on-surface font-label-sm text-label-sm">
      <span className="material-symbols-outlined text-[16px] text-secondary">
        {icon}
      </span>
      {label}
    </div>
  );
}

function UploadDropzone({
  uploading,
  dragOver,
  onDragOver,
  onPick,
  onFile,
  error,
}: {
  uploading: boolean;
  dragOver: boolean;
  onDragOver: (over: boolean) => void;
  onPick: () => void;
  onFile: (file: File) => void;
  error: string | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className={`mt-2 glass-panel bg-surface/40 rounded-xl p-6 cursor-pointer transition-all ${
        dragOver ? "border-secondary scale-[1.01]" : ""
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(true);
      }}
      onDragLeave={() => onDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        onDragOver(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
      onClick={onPick}
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined">cloud_upload</span>
        </div>
        <div className="flex-1 min-w-0">
          {uploading ? (
            <p className="font-title-lg text-title-lg text-primary">
              Uploading…
            </p>
          ) : (
            <>
              <p className="font-title-lg text-title-lg text-primary">
                Drop your PDF here, or click to browse
              </p>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Max 10 MB · PDF only
              </p>
            </>
          )}
        </div>
        <button
          type="button"
          className="bg-primary text-on-primary px-6 py-3 rounded-full font-label-md text-label-md hover:scale-105 transition-all duration-300 shadow-[0_10px_20px_rgba(3,31,65,0.2)]"
        >
          Launch VoiceTale
        </button>
      </div>
      {error && (
        <p className="mt-3 text-sm text-error font-label-md">{error}</p>
      )}
    </motion.div>
  );
}

function ProcessingPanel({
  status,
  error,
}: {
  status: StoryStatus | "";
  error: string | null;
}) {
  const currentIdx = STATUS_ORDER.indexOf(status as StoryStatus);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mt-2 glass-panel bg-surface/60 rounded-xl p-6"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center">
          <span className="material-symbols-outlined">graphic_eq</span>
        </div>
        <div>
          <p className="font-title-lg text-title-lg text-primary">
            Preparing your story
          </p>
          <p className="font-body-md text-on-surface-variant">
            This typically takes 30–60 seconds.
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {STATUS_ORDER.map((s, i) => {
          const isActive = i === currentIdx;
          const isDone = i < currentIdx;
          return (
            <li
              key={s}
              className={`flex items-center gap-3 font-label-md text-label-md ${
                isDone
                  ? "text-primary"
                  : isActive
                    ? "text-secondary"
                    : "text-on-surface-variant/60"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {isDone ? "check_circle" : isActive ? "progress_activity" : "radio_button_unchecked"}
              </span>
              {STATUS_LABELS[s]}
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="mt-4 text-sm text-error font-label-md">{error}</p>
      )}
    </motion.div>
  );
}

function ShowcaseGraphic() {
  return (
    <div className="absolute inset-0 glass-panel rounded-xl overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.12)] bg-gradient-to-br from-primary-fixed/40 via-surface to-secondary-fixed/30">
      {/* Decorative gradient orbs */}
      <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-primary-fixed/40 blur-3xl" />
      <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-secondary-fixed/40 blur-3xl" />

      {/* Open book illustration via SVG */}
      <svg
        viewBox="0 0 600 500"
        className="absolute inset-0 w-full h-full opacity-90"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="page" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fcf9f8" />
            <stop offset="100%" stopColor="#f0eded" />
          </linearGradient>
          <linearGradient id="spine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#031f41" />
            <stop offset="100%" stopColor="#1d3557" />
          </linearGradient>
        </defs>

        <g transform="translate(60,80)">
          {/* Left page */}
          <path
            d="M0 40 Q120 0 240 40 L240 360 Q120 320 0 360 Z"
            fill="url(#page)"
            stroke="#c4c6cf"
            strokeWidth="1.5"
          />
          {/* Right page */}
          <path
            d="M240 40 Q360 0 480 40 L480 360 Q360 320 240 360 Z"
            fill="url(#page)"
            stroke="#c4c6cf"
            strokeWidth="1.5"
          />
          {/* Spine */}
          <rect x="235" y="35" width="10" height="330" fill="url(#spine)" />

          {/* Text lines (left page) */}
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <rect
              key={`l-${i}`}
              x={20 + i * 2}
              y={80 + i * 28}
              width={200 - i * 4}
              height={6}
              rx={3}
              fill={i === 3 ? "#735c00" : "#44474e"}
              opacity={i === 3 ? 0.8 : 0.25}
            />
          ))}
          {/* Text lines (right page) */}
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <rect
              key={`r-${i}`}
              x={260 + i * 2}
              y={80 + i * 28}
              width={200 - i * 4}
              height={6}
              rx={3}
              fill="#44474e"
              opacity={0.25}
            />
          ))}
        </g>
      </svg>

      {/* Floating overlays */}
      <div className="absolute top-8 left-8 glass-panel bg-surface/85 p-4 rounded-lg flex items-center gap-3 max-w-[260px] shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
          <span className="material-symbols-outlined text-on-primary text-[20px]">
            graphic_eq
          </span>
        </div>
        <div className="flex-1">
          <div className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">
            Live Narration
          </div>
          <div className="flex items-end h-4 mt-1 text-secondary">
            <span className="wave-bar h-full" />
            <span className="wave-bar h-2/3" />
            <span className="wave-bar h-4/5" />
            <span className="wave-bar h-1/2" />
            <span className="wave-bar h-full" />
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 right-8 glass-panel bg-surface/90 p-6 rounded-lg max-w-[300px] shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
        <h3 className="font-title-lg text-title-lg text-primary mb-2">
          The Whispering Woods
        </h3>
        <p className="font-body-md text-body-md text-on-surface-variant">
          As she stepped into the clearing, the ancient trees seemed to hum with
          a forgotten melody…
        </p>
      </div>
    </div>
  );
}
