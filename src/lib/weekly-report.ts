import { HabitStatus } from "@prisma/client";
import { endOfDay, format, startOfDay, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";

export type WeeklyReportPayload = {
  rangeLabel: string;
  rangeStart: string;
  rangeEnd: string;
  habitCompletions: number;
  tasksCompleted: number;
  pomodoroMinutes: number;
  moodAvg: number | null;
  moodCheckIns: number;
  uniqueMoodDays: number;
  bestDay: { label: string; completions: number } | null;
  badgesEarned: { title: string }[];
  estimatedXpFromActivity: number;
  dailyHabitCounts: { date: string; done: number }[];
};

/** Rolling last 7 calendar days (today inclusive), local boundary via date-fns. */
export async function buildWeeklyReport(userId: string): Promise<WeeklyReportPayload> {
  const now = new Date();
  const rangeStart = startOfDay(subDays(now, 6));
  const rangeEnd = endOfDay(now);

  const [habitLogs, tasks, moods, pomodoros, badges] = await Promise.all([
    prisma.habitLog.findMany({
      where: {
        userId,
        status: HabitStatus.DONE,
        date: { gte: rangeStart, lte: rangeEnd },
      },
      select: { date: true },
    }),
    prisma.task.findMany({
      where: {
        userId,
        status: "done",
        completedAt: { gte: rangeStart, lte: rangeEnd },
      },
      select: { id: true },
    }),
    prisma.moodLog.findMany({
      where: { userId, loggedAt: { gte: rangeStart, lte: rangeEnd } },
      select: { moodScore: true, loggedAt: true },
    }),
    prisma.pomodoroSession.findMany({
      where: { userId, startedAt: { gte: rangeStart, lte: rangeEnd } },
      select: { duration: true },
    }),
    prisma.userAchievement.findMany({
      where: {
        userId,
        earnedAt: { gte: rangeStart, lte: rangeEnd },
      },
      include: { achievement: { select: { title: true } } },
    }),
  ]);

  const habitCompletions = habitLogs.length;

  const byDay = new Map<string, number>();
  for (const l of habitLogs) {
    const k = format(new Date(l.date), "yyyy-MM-dd");
    byDay.set(k, (byDay.get(k) ?? 0) + 1);
  }

  const dailyHabitCounts: { date: string; done: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = startOfDay(subDays(now, 6 - i));
    const k = format(d, "yyyy-MM-dd");
    dailyHabitCounts.push({ date: k, done: byDay.get(k) ?? 0 });
  }

  let bestDay: { label: string; completions: number } | null = null;
  for (const [k, v] of byDay) {
    if (v <= 0) continue;
    if (!bestDay || v > bestDay.completions) {
      bestDay = {
        label: format(new Date(`${k}T12:00:00`), "EEE MMM d"),
        completions: v,
      };
    }
  }

  const moodCheckIns = moods.length;
  const moodAvg =
    moodCheckIns > 0 ? Math.round((moods.reduce((s, m) => s + m.moodScore, 0) / moodCheckIns) * 10) / 10 : null;
  const uniqueMoodDays = new Set(moods.map((m) => format(new Date(m.loggedAt), "yyyy-MM-dd"))).size;

  const pomodoroMinutes = pomodoros.reduce((s, p) => s + p.duration, 0);

  const estimatedXpFromActivity = habitCompletions * 10 + tasks.length * 15;

  return {
    rangeLabel: `${format(rangeStart, "MMM d")} – ${format(now, "MMM d, yyyy")}`,
    rangeStart: format(rangeStart, "yyyy-MM-dd"),
    rangeEnd: format(now, "yyyy-MM-dd"),
    habitCompletions,
    tasksCompleted: tasks.length,
    pomodoroMinutes,
    moodAvg,
    moodCheckIns,
    uniqueMoodDays,
    bestDay,
    badgesEarned: badges.map((b) => ({ title: b.achievement.title })),
    estimatedXpFromActivity,
    dailyHabitCounts,
  };
}
