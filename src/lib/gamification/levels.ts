/** Display names aligned with the expanded level system (Phase 2 thresholds coming later). */
export const LEVEL_NAMES = [
  "Seedling",
  "Sprout",
  "Apprentice",
  "Warrior",
  "Champion",
  "Expert",
  "Master",
  "Legend",
  "Mythic",
  "Ascendant",
] as const;

export function levelDisplayName(level: number): string {
  if (level < 1) return LEVEL_NAMES[0];
  const idx = Math.min(level, LEVEL_NAMES.length) - 1;
  return LEVEL_NAMES[idx] ?? `Level ${level}`;
}
