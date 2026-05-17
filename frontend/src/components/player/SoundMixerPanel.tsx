"use client";

import { motion, AnimatePresence } from "framer-motion";

interface SoundMixerPanelProps {
  volume: number;
  isEnabled: boolean;
  isLoading: boolean;
  trackLabel: string | null;
  onSetVolume: (vol: number) => void;
}

const LABEL_ICON_MAP: Record<string, string> = {
  rain: "water_drop",
  thunder: "bolt",
  storm: "thunderstorm",
  fire: "local_fire_department",
  fireplace: "local_fire_department",
  forest: "forest",
  birds: "nest_bird_egg",
  ocean: "waves",
  sea: "waves",
  waves: "waves",
  wind: "air",
  night: "dark_mode",
  crowd: "groups",
  city: "location_city",
  street: "directions_walk",
  church: "church",
  bells: "notifications",
  river: "water",
  creek: "water",
  library: "local_library",
  silence: "volume_off",
  music: "music_note",
  tension: "warning",
  drone: "graphic_eq",
  peaceful: "spa",
  cozy: "local_fire_department",
  warm: "local_fire_department",
  dark: "dark_mode",
  tavern: "local_bar",
  pub: "local_bar",
};

function getIconForLabel(label: string): string {
  const lower = label.toLowerCase();
  for (const [keyword, icon] of Object.entries(LABEL_ICON_MAP)) {
    if (lower.includes(keyword)) return icon;
  }
  return "graphic_eq";
}

export function SoundMixerPanel({
  volume,
  isEnabled,
  isLoading,
  trackLabel,
  onSetVolume,
}: SoundMixerPanelProps) {
  return (
    <div className="glass-panel bg-surface/60 rounded-xl p-6">
      <p className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant mb-4">
        Ambience
      </p>

      <AnimatePresence mode="wait">
        {!isEnabled ? (
          <motion.p
            key="disabled"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="font-label-sm text-label-sm text-on-surface-variant text-center py-2"
          >
            Ambience off — tap the speaker icon to enable
          </motion.p>
        ) : isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center gap-2 py-4"
          >
            <span className="material-symbols-outlined text-[16px] animate-spin text-secondary">
              progress_activity
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              Generating ambience…
            </span>
          </motion.div>
        ) : !trackLabel ? (
          <motion.p
            key="unavailable"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="font-label-sm text-label-sm text-on-surface-variant text-center py-2"
          >
            Ambience generating — will be ready shortly
          </motion.p>
        ) : (
          <motion.div
            key="track"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-[18px] text-primary">
                {getIconForLabel(trackLabel)}
              </span>
              <span className="font-label-sm text-label-sm text-on-surface truncate">
                {trackLabel}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                volume_down
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(volume * 100)}
                onChange={(e) =>
                  onSetVolume(parseInt(e.target.value, 10) / 100)
                }
                className="flex-1 h-1.5 accent-primary cursor-pointer"
              />
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                volume_up
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant w-8 text-right">
                {Math.round(volume * 100)}%
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
