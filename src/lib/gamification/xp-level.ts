/** XP thresholds for levels 1–10 (level L requires xp >= THRESHOLDS[L-1]). */
export const LEVEL_XP_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500] as const;

const MAX_LEVEL = LEVEL_XP_THRESHOLDS.length;

export function levelFromXp(xp: number): number {
  if (xp < 0) return 1;
  let level = 1;
  for (let i = 1; i < LEVEL_XP_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_XP_THRESHOLDS[i]) level = i + 1;
  }
  return Math.min(level, MAX_LEVEL);
}

/** XP needed to reach the next level (0 if max). */
export function xpToNextLevel(xp: number): number {
  const level = levelFromXp(xp);
  if (level >= MAX_LEVEL) return 0;
  const nextThreshold = LEVEL_XP_THRESHOLDS[level];
  return Math.max(0, nextThreshold - xp);
}

export function currentLevelThreshold(xp: number): number {
  const level = levelFromXp(xp);
  return LEVEL_XP_THRESHOLDS[level - 1] ?? 0;
}

/** Progress 0–1 within current level band. */
export function levelProgress01(xp: number): number {
  const level = levelFromXp(xp);
  if (level >= MAX_LEVEL) return 1;
  const low = LEVEL_XP_THRESHOLDS[level - 1];
  const high = LEVEL_XP_THRESHOLDS[level];
  const span = high - low;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (xp - low) / span));
}
