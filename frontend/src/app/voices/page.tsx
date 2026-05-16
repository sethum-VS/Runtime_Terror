"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { api } from "@/lib/api";
import type { Voice } from "@/lib/types";
import { pickPageVariants } from "@/lib/animations";

export default function VoicesPage() {
  const [voices, setVoices] = useState<Voice[] | null>(null);
  const [search, setSearch] = useState("");
  const reduced = useReducedMotion();
  const { item } = pickPageVariants(reduced);

  useEffect(() => {
    api
      .listVoices()
      .then(setVoices)
      .catch(() => setVoices([]));
  }, []);

  const filtered = (voices || []).filter((v) =>
    `${v.name || ""} ${v.description || ""} ${JSON.stringify(v.labels || {})}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <main className="pt-[160px] pb-section-margin px-container-padding-mobile md:px-container-padding-desktop max-w-[1280px] mx-auto">
      <motion.header variants={item} className="mb-10">
        <p className="font-label-sm text-label-sm uppercase tracking-widest text-secondary mb-2">
          ElevenLabs Voice Library
        </p>
        <h1 className="font-headline-lg text-headline-lg text-primary">
          Explore Voices
        </h1>
        <p className="font-body-lg text-on-surface-variant mt-3 max-w-xl">
          Preview the cast of available voices. VoiceTale automatically picks
          or designs the right voice per character.
        </p>

        {voices === null || voices.length > 0 ? (
          <div className="mt-6 max-w-md">
            <div className="glass-panel bg-surface/60 rounded-full px-5 py-3 flex items-center gap-3">
              <span className="material-symbols-outlined text-on-surface-variant">
                search
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, accent, age…"
                className="flex-1 bg-transparent outline-none font-body-md text-body-md placeholder:text-on-surface-variant/60"
              />
            </div>
          </div>
        ) : null}
      </motion.header>

      {voices === null && (
        <motion.div
          variants={item}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-card-gap"
        >
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="glass-panel bg-surface/50 rounded-xl p-6 h-32 shimmer"
            />
          ))}
        </motion.div>
      )}

      {voices && voices.length === 0 && (
        <motion.div
          variants={item}
          className="glass-panel bg-surface/60 rounded-xl p-12 text-center max-w-xl mx-auto"
        >
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant mb-3 block">
            record_voice_over
          </span>
          <h3 className="font-title-lg text-title-lg text-primary mb-2">
            Voice catalog coming soon
          </h3>
          <p className="font-body-md text-on-surface-variant">
            The Explore Voices library is curated by the VoiceTale team. New
            voices are added on our side—nothing for you to upload here. Check
            back later, or continue creating stories from the home page.
          </p>
        </motion.div>
      )}

      {voices && voices.length > 0 && (
        <motion.div
          variants={item}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-card-gap"
        >
          {filtered.map((v) => (
            <VoiceCard key={v.voice_id} voice={v} />
          ))}
        </motion.div>
      )}

      {voices && voices.length > 0 && filtered.length === 0 && (
        <motion.p
          variants={item}
          className="text-on-surface-variant mt-8 font-body-md"
        >
          No voices match your search.
        </motion.p>
      )}
    </main>
  );
}

function VoiceCard({ voice }: { voice: Voice }) {
  const labels = voice.labels || {};
  return (
    <div className="glass-panel bg-surface/60 rounded-xl p-6">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center">
          <span className="material-symbols-outlined text-[20px]">
            graphic_eq
          </span>
        </div>
        {voice.preview_url && (
          <button
            onClick={() => new Audio(voice.preview_url!).play()}
            className="text-primary hover:scale-110 transition-transform"
            aria-label="Play preview"
          >
            <span className="material-symbols-outlined">play_circle</span>
          </button>
        )}
      </div>
      <h3 className="font-title-lg text-title-lg text-primary mb-1">
        {voice.name}
      </h3>
      <div className="flex flex-wrap gap-2 mt-3">
        {Object.entries(labels)
          .slice(0, 4)
          .map(([k, val]) => (
            <span
              key={k}
              className="px-2 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm"
            >
              {String(val)}
            </span>
          ))}
      </div>
    </div>
  );
}
