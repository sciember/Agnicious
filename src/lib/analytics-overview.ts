import { HabitStatus } from "@prisma/client";
import { endOfDay, getDay, getHours, startOfDay, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";

export type PerHabitBreakdown = {
  habitId: string;
  title: string;
  completionRate: number;
  doneCount: number;
};

export type AnalyticsOverviewPayload = {
  habits: {
    total: number;
    completedToday: number;
    currentStreak: number;
    weeklyRate: number;
    perHabit: PerHabitBreakdown[];
  };
  tasks: {
    totalToday: number;
    completedToday: number;
    completionRate: number;
    byPriority: Record<string, number>;
    overdue: number;
  };
  pomodoro: {
    todaySessions: number;
    totalMinutesToday: number;
    weeklyMinutes: number;
  };
  productivity: {
    score: number;
    trend: string;
    trendDelta: number;
    bestDay: string;
    bestHour: string;
  };
  aiContext: Record<string, unknown>;
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function scoreForDate(params: {
  habitDoneToday: number;
  habitTarget: number;
  taskCompleted: number;
  taskTotal: number;
  pomodoroMins: number;
}): number {
  const { habitDoneToday, habitTarget, taskCompleted, taskTotal, pomodoroMins } = params;
  const habitPct = habitTarget <= 0 ? 100 : Math.min(100, (habitDoneToday / habitTarget) * 100);
  const taskPct = taskTotal <= 0 ? 100 : Math.min(100, (taskCompleted / taskTotal) * 100);
  const pomodoroPct = Math.min(100, (pomodoroMins / 120) * 100);
  return Math.round(habitPct * 0.35 + taskPct * 0.4 + pomodoroPct * 0.25);
}

export async function buildAnalyticsOverview(userId: string): Promise<AnalyticsOverviewPayload> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekAgo = startOfDay(subDays(now, 6));
  const yesterdayStart = startOfDay(subDays(now, 1));
  const yesterdayEnd = endOfDay(subDays(now, 1));
  const thirtyAgo = subDays(now, 29);

  const [
    habits,
    streaks,
    logsToday,
    logsWeek,
    logs30d,
    allLogsRecent,
    tasksTodayDue,
    tasksCompletedToday,
    tasksOverdue,
    pomodoroToday,
    pomodoroWeek,
    pomodoroHourWeek,
    habitsYesterday,
    tasksYest,
    tasksTotalYesterday,
    pomodoroYest,
    taskListToday,
  ] = await Promise.all([
    prisma.habit.count({ where: { userId, isArchived: false } }),
    prisma.streak.findMany({ where: { userId } }),
    prisma.habitLog.count({
      where: {
        userId,
        status: HabitStatus.DONE,
        date: { gte: todayStart, lte: todayEnd },
      },
    }),
    prisma.habitLog.findMany({
      where: { userId, date: { gte: weekAgo } },
      select: { date: true, status: true },
    }),
    prisma.habitLog.findMany({
      where: { userId, date: { gte: thirtyAgo } },
      select: { habitId: true, date: true, status: true },
    }),
    prisma.habitLog.findMany({
      where: { userId, date: { gte: subDays(now, 90) } },
      select: { date: true, status: true, completedAt: true, habitId: true },
    }),
    prisma.task.count({
      where: {
        userId,
        OR: [
          { dueDate: { gte: todayStart, lte: todayEnd } },
          { completedAt: { gte: todayStart, lte: todayEnd } },
        ],
      },
    }),
    prisma.task.count({
      where: {
        userId,
        status: "done",
        completedAt: { gte: todayStart, lte: todayEnd },
      },
    }),
    prisma.task.count({
      where: {
        userId,
        status: { not: "done" },
        dueDate: { lt: todayStart },
      },
    }),
    prisma.pomodoroSession.findMany({
      where: { userId, startedAt: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.pomodoroSession.findMany({
      where: { userId, startedAt: { gte: startOfDay(subDays(now, 6)), lte: todayEnd } },
    }),
    prisma.pomodoroSession.findMany({
      where: { userId, startedAt: { gte: weekAgo, lte: todayEnd } },
      select: { startedAt: true, duration: true },
    }),
    prisma.habitLog.count({
      where: {
        userId,
        status: HabitStatus.DONE,
        date: { gte: yesterdayStart, lte: yesterdayEnd },
      },
    }),
    prisma.task.count({
      where: {
        userId,
        status: "done",
        completedAt: { gte: yesterdayStart, lte: yesterdayEnd },
      },
    }),
    prisma.task.count({
      where: {
        userId,
        OR: [
          { dueDate: { gte: yesterdayStart, lte: yesterdayEnd } },
          { completedAt: { gte: yesterdayStart, lte: yesterdayEnd } },
        ],
      },
    }),
    prisma.pomodoroSession.findMany({
      where: { userId, startedAt: { gte: yesterdayStart, lte: yesterdayEnd } },
    }),
    prisma.task.findMany({
      where: {
        userId,
        OR: [
          { dueDate: { gte: todayStart, lte: todayEnd } },
          { completedAt: { gte: todayStart, lte: todayEnd } },
        ],
      },
      select: { priority: true },
    }),
  ]);

  const currentStreak = streaks.length ? Math.max(0, ...streaks.map((s) => s.currentCount)) : 0;

  const doneWeek = logsWeek.filter((l) => l.status === HabitStatus.DONE).length;
  const weeklyRate =
    habits <= 0 ? 0 : Math.min(100, Math.round((doneWeek / Math.max(1, habits * 7)) * 100));

  const habitRows = await prisma.habit.findMany({
    where: { userId, isArchived: false },
    select: { id: true, title: true },
  });

  const perHabit: PerHabitBreakdown[] = habitRows.map((h) => {
    const doneIn30 = logs30d.filter(
      (l) => l.habitId === h.id && l.status === HabitStatus.DONE,
    ).length;
    const completionRate = Math.min(100, Math.round((doneIn30 / 30) * 100));
    return {
      habitId: h.id,
      title: h.title,
      completionRate,
      doneCount: doneIn30,
    };
  });

  const byPriority: Record<string, number> = { low: 0, medium: 0, high: 0, urgent: 0 };
  for (const t of taskListToday) {
    const p = t.priority || "medium";
    if (byPriority[p] !== undefined) byPriority[p] += 1;
    else byPriority.medium += 1;
  }

  const totalMinutesToday = pomodoroToday.reduce((s, p) => s + p.duration, 0);
  const weeklyMinutes = pomodoroWeek.reduce((s, p) => s + p.duration, 0);

  const taskTotalToday = tasksTodayDue;
  const taskCompletedToday = tasksCompletedToday;
  const completionRate =
    taskTotalToday <= 0 ? 100 : Math.round((taskCompletedToday / taskTotalToday) * 100);

  const scoreNow = scoreForDate({
    habitDoneToday: logsToday,
    habitTarget: Math.max(habits, 1),
    taskCompleted: taskCompletedToday,
    taskTotal: Math.max(taskTotalToday, 1),
    pomodoroMins: totalMinutesToday,
  });

  const yPomMins = pomodoroYest.reduce((s, p) => s + p.duration, 0);
  const scoreYesterday = scoreForDate({
    habitDoneToday: habitsYesterday,
    habitTarget: Math.max(habits, 1),
    taskCompleted: tasksYest,
    taskTotal: Math.max(tasksTotalYesterday, 1),
    pomodoroMins: yPomMins,
  });

  const trendDelta = scoreNow - scoreYesterday;
  const trend =
    trendDelta > 0 ? `↑ +${trendDelta} from yesterday` : trendDelta < 0 ? `↓ ${trendDelta} from yesterday` : "→ same as yesterday";

  const byWeekdayCount = new Map<number, number>();
  for (const l of allLogsRecent) {
    if (l.status !== HabitStatus.DONE) continue;
    const d = getDay(new Date(l.date));
    byWeekdayCount.set(d, (byWeekdayCount.get(d) ?? 0) + 1);
  }
  let bestD = 1;
  let bestDc = -1;
  for (const [d, c] of byWeekdayCount) {
    if (c > bestDc) {
      bestDc = c;
      bestD = d;
    }
  }
  const bestDay = bestDc >= 0 ? DAYS[bestD] : "—";

  const byHour = new Map<number, number>();
  for (const p of pomodoroHourWeek) {
    const h = getHours(new Date(p.startedAt));
    byHour.set(h, (byHour.get(h) ?? 0) + p.duration);
  }
  for (const l of allLogsRecent) {
    if (l.status !== HabitStatus.DONE || !l.completedAt) continue;
    const h = getHours(new Date(l.completedAt));
    byHour.set(h, (byHour.get(h) ?? 0) + 1);
  }
  let bestH = 9;
  let bestHc = -1;
  for (const [h, c] of byHour) {
    if (c > bestHc) {
      bestHc = c;
      bestH = h;
    }
  }
  const bestHour = bestHc >= 0 ? `${bestH % 12 || 12}${bestH < 12 ? "am" : "pm"}` : "—";

  const aiContext = {
    habits: {
      total: habits,
      completedToday: logsToday,
      currentStreak,
      weeklyRate,
      perHabit,
    },
    tasks: {
      totalToday: taskTotalToday,
      completedToday: taskCompletedToday,
      completionRate,
      overdue: tasksOverdue,
      byPriority,
    },
    pomodoro: {
      todaySessions: pomodoroToday.length,
      totalMinutesToday,
      weeklyMinutes,
    },
    productivity: {
      score: scoreNow,
      trend,
      bestDay,
      bestHour,
    },
  };

  return {
    habits: {
      total: habits,
      completedToday: logsToday,
      currentStreak,
      weeklyRate,
      perHabit,
    },
    tasks: {
      totalToday: taskTotalToday,
      completedToday: taskCompletedToday,
      completionRate,
      byPriority,
      overdue: tasksOverdue,
    },
    pomodoro: {
      todaySessions: pomodoroToday.length,
      totalMinutesToday,
      weeklyMinutes,
    },
    productivity: {
      score: scoreNow,
      trend,
      trendDelta,
      bestDay,
      bestHour,
    },
    aiContext,
  };
}
