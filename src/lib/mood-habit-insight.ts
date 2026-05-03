import { HabitStatus } from "@prisma/client";
import { format, startOfDay, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";

export type MoodHabitInsightPayload = {
  windowDays: number;
  /** Days with at least one mood log in window */
  daysWithMood: number;
  avgMoodHeavyDays: number | null;
  avgMoodLightDays: number | null;
  heavyDayCount: number;
  lightDayCount: number;
  enoughData: boolean;
  /** Heavy = same-day habit completions (DONE) ≥ this threshold */
  heavyThreshold: number;
};

const DEFAULT_WINDOW = 60;
const HEAVY_THRESHOLD = 3;
const MIN_BUCKET_DAYS = 3;

/**
 * Compare average mood on days with many habit completions vs fewer,
 * using calendar-day habit DONE counts and mood scores (last N days).
 */
export async function buildMoodHabitInsight(
  userId: string,
  windowDays: number = DEFAULT_WINDOW,
): Promise<MoodHabitInsightPayload> {
  const safeWindow = Math.min(120, Math.max(14, windowDays));
  const from = startOfDay(subDays(new Date(), safeWindow - 1));

  const [moodLogs, habitLogs] = await Promise.all([
    prisma.moodLog.findMany({
      where: { userId, loggedAt: { gte: from } },
      select: { moodScore: true, loggedAt: true },
    }),
    prisma.habitLog.findMany({
      where: {
        userId,
        status: HabitStatus.DONE,
        date: { gte: from },
      },
      select: { date: true },
    }),
  ]);

  const moodByDay = new Map<string, { sum: number; n: number }>();
  for (const m of moodLogs) {
    const k = format(new Date(m.loggedAt), "yyyy-MM-dd");
    const cur = moodByDay.get(k) ?? { sum: 0, n: 0 };
    cur.sum += m.moodScore;
    cur.n += 1;
    moodByDay.set(k, cur);
  }

  const habitsByDay = new Map<string, number>();
  for (const l of habitLogs) {
    const k = format(new Date(l.date), "yyyy-MM-dd");
    habitsByDay.set(k, (habitsByDay.get(k) ?? 0) + 1);
  }

  let heavySum = 0;
  let heavyN = 0;
  let lightSum = 0;
  let lightN = 0;

  for (const [dayKey, { sum, n }] of moodByDay) {
    const habitDone = habitsByDay.get(dayKey) ?? 0;
    const avgMood = sum / n;
    if (habitDone >= HEAVY_THRESHOLD) {
      heavySum += avgMood;
      heavyN += 1;
    } else {
      lightSum += avgMood;
      lightN += 1;
    }
  }

  const avgMoodHeavyDays = heavyN >= MIN_BUCKET_DAYS ? Math.round((heavySum / heavyN) * 10) / 10 : null;
  const avgMoodLightDays = lightN >= MIN_BUCKET_DAYS ? Math.round((lightSum / lightN) * 10) / 10 : null;
  const enoughData = heavyN >= MIN_BUCKET_DAYS && lightN >= MIN_BUCKET_DAYS;

  return {
    windowDays: safeWindow,
    daysWithMood: moodByDay.size,
    avgMoodHeavyDays,
    avgMoodLightDays,
    heavyDayCount: heavyN,
    lightDayCount: lightN,
    enoughData,
    heavyThreshold: HEAVY_THRESHOLD,
  };
}
