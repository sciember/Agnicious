import { HabitStatus } from "@prisma/client";
import { format, subDays, startOfDay, getDay, getHours } from "date-fns";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Supports charts + insights; filter via ?days= number (default 30). */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const days = Math.min(366, Math.max(1, Number(searchParams.get("days")) || 30));

  const from = subDays(new Date(), days - 1);

  const [logs, tasks, pomodoros, habits] = await Promise.all([
    prisma.habitLog.findMany({
      where: { userId: session.user.id, date: { gte: startOfDay(from) } },
      select: { date: true, status: true, completedAt: true, habitId: true },
    }),
    prisma.task.findMany({
      where: {
        userId: session.user.id,
        OR: [
          { createdAt: { gte: startOfDay(from) } },
          { completedAt: { gte: startOfDay(from) } },
        ],
      },
      select: {
        createdAt: true,
        completedAt: true,
        status: true,
        priority: true,
        dueDate: true,
      },
    }),
    prisma.pomodoroSession.findMany({
      where: { userId: session.user.id, startedAt: { gte: startOfDay(from) } },
      select: { startedAt: true, duration: true },
    }),
    prisma.habit.findMany({
      where: { userId: session.user.id, isArchived: false },
      select: { id: true, title: true },
    }),
  ]);

  const habitDailyDone = new Map<string, number>();
  const hourDayHeat = new Map<string, number>();
  const weekdayTotals = new Map<number, number>();

  for (const l of logs) {
    if (l.status !== HabitStatus.DONE) continue;
    const key = format(new Date(l.date), "yyyy-MM-dd");
    habitDailyDone.set(key, (habitDailyDone.get(key) ?? 0) + 1);
    const wd = getDay(new Date(l.date));
    weekdayTotals.set(wd, (weekdayTotals.get(wd) ?? 0) + 1);
    const hr = l.completedAt ? getHours(new Date(l.completedAt)) : getHours(new Date(l.date));
    const hk = `${wd}-${hr}`;
    hourDayHeat.set(hk, (hourDayHeat.get(hk) ?? 0) + 1);
  }

  const taskCompletedByDay = new Map<string, number>();
  const taskCreatedByDay = new Map<string, number>();
  const fromBoundary = startOfDay(from);

  for (const t of tasks) {
    if (new Date(t.createdAt) >= fromBoundary) {
      const ckey = format(new Date(t.createdAt), "yyyy-MM-dd");
      taskCreatedByDay.set(ckey, (taskCreatedByDay.get(ckey) ?? 0) + 1);
    }
    if (t.completedAt && t.status === "done") {
      const dk = format(new Date(t.completedAt), "yyyy-MM-dd");
      taskCompletedByDay.set(dk, (taskCompletedByDay.get(dk) ?? 0) + 1);
    }
  }

  const pomodoroByDay = new Map<string, number>();
  for (const p of pomodoros) {
    const key = format(new Date(p.startedAt), "yyyy-MM-dd");
    pomodoroByDay.set(key, (pomodoroByDay.get(key) ?? 0) + p.duration);
  }

  const perHabitRates = habits.map((h) => {
    const done = logs.filter((l) => l.habitId === h.id && l.status === HabitStatus.DONE).length;
    return {
      habitId: h.id,
      title: h.title,
      rate: Math.min(100, Math.round((done / Math.max(1, days)) * 100)),
    };
  });

  return NextResponse.json({
    habitDailyDone: Object.fromEntries(habitDailyDone),
    taskCompletedByDay: Object.fromEntries(taskCompletedByDay),
    taskCreatedByDay: Object.fromEntries(taskCreatedByDay),
    pomodoroByDay: Object.fromEntries(pomodoroByDay),
    hourDayHeat: Object.fromEntries(hourDayHeat),
    weekdayTotals: Object.fromEntries(weekdayTotals),
    perHabitRates,
    tasksSnapshot: tasks.map((t) => ({ priority: t.priority, status: t.status })),
  });
}
