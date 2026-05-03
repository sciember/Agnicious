import { format } from "date-fns";

export type DailyChallengeDef = {
  key: string;
  text: string;
  xpReward: number;
  type: string;
  targetCount: number;
};

const POOL: Omit<DailyChallengeDef, "key">[] = [
  { text: "Complete all habits before 2pm today", xpReward: 25, type: "habits_before_14", targetCount: 1 },
  { text: "Log your mood once", xpReward: 15, type: "mood_once", targetCount: 1 },
  { text: "Finish 2 Pomodoro sessions", xpReward: 20, type: "pomodoro_2", targetCount: 2 },
  { text: "Complete 3 habit check-ins", xpReward: 20, type: "habit_logs_3", targetCount: 3 },
  { text: "Mark 2 tasks done", xpReward: 20, type: "tasks_2", targetCount: 2 },
  { text: "Add a new habit or task", xpReward: 25, type: "create_item", targetCount: 1 },
  { text: "Hit a 1-day full streak (all habits done)", xpReward: 30, type: "all_habits_today", targetCount: 1 },
];

/** Deterministic pseudo-random index 0..max from date string. */
function seededPick(seed: string, salt: number, modulo: number): number {
  let h = salt;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return modulo > 0 ? h % modulo : 0;
}

export function getDailyChallengesForDate(d: Date): DailyChallengeDef[] {
  const seed = format(d, "yyyy-MM-dd");
  const indices = new Set<number>();
  let salt = 0;
  while (indices.size < 3 && indices.size < POOL.length) {
    const idx = seededPick(seed, salt, POOL.length);
    indices.add(idx);
    salt += 1;
  }
  return [...indices].map((i, order) => {
    const p = POOL[i];
    return {
      key: `${format(d, "yyyyMMdd")}_${p.type}_${order}`,
      text: p.text,
      xpReward: p.xpReward,
      type: p.type,
      targetCount: p.targetCount,
    };
  });
}
