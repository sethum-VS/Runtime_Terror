"use client";

import type { Character } from "@/lib/types";

const COLORS = [
  "#031f41",
  "#735c00",
  "#1d3557",
  "#b04a3c",
  "#3a5a40",
  "#6a4c93",
  "#0a7e8c",
];

export function getCharacterColor(characterId: string, allIds: string[]): string {
  const idx = allIds.indexOf(characterId);
  if (idx < 0) return COLORS[0];
  return COLORS[idx % COLORS.length];
}

interface CharacterPanelProps {
  characters: Character[];
  activeCharacterId?: string | null;
}

export function CharacterPanel({
  characters,
  activeCharacterId,
}: CharacterPanelProps) {
  const allIds = characters.map((c) => c.character_id);

  return (
    <aside className="glass-panel bg-surface/60 rounded-xl p-6">
      <p className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant mb-4">
        Cast
      </p>
      <ul className="space-y-3">
        {characters.map((c) => {
          const color = getCharacterColor(c.character_id, allIds);
          const isSpeaking = activeCharacterId === c.character_id;
          return (
            <li
              key={c.character_id}
              className={`flex items-center gap-3 rounded-lg px-2 py-1.5 transition-all duration-200 ${
                isSpeaking
                  ? "bg-primary/8 ring-1 ring-primary/20"
                  : ""
              }`}
            >
              <span
                className={`shrink-0 rounded-full transition-all duration-200 ${
                  isSpeaking ? "w-4 h-4 shadow-md" : "w-3 h-3"
                }`}
                style={{
                  backgroundColor: color,
                  boxShadow: isSpeaking ? `0 0 8px ${color}60` : undefined,
                }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p
                  className={`font-title-lg text-[16px] leading-tight truncate transition-colors duration-200 ${
                    isSpeaking ? "text-primary font-semibold" : "text-primary"
                  }`}
                >
                  {c.name}
                </p>
                <p className="font-label-sm text-label-sm text-on-surface-variant capitalize">
                  {isSpeaking ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-flex items-end gap-[2px] h-[10px]"
                        aria-label="Speaking"
                      >
                        <span className="wave-bar h-[10px]" />
                        <span className="wave-bar h-[10px]" />
                        <span className="wave-bar h-[10px]" />
                      </span>
                      Speaking
                    </span>
                  ) : (
                    c.role ?? ""
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
