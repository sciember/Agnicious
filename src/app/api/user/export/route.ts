import { format } from "date-fns";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function escapeCsvField(value: string | null | undefined): string {
  if (value == null || value === "") return "";
  const s = String(value).replace(/"/g, '""');
  if (/[",\n\r]/.test(s)) return `"${s}"`;
  return s;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const formatParam = searchParams.get("format") ?? "json";

  const userId = session.user.id;

  const [
    user,
    habits,
    habitLogs,
    tasks,
    projects,
    moodLogs,
    userAchievements,
    streaks,
    pomodoroSessions,
    dailyChallengeRows,
    notifications,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        username: true,
        bio: true,
        image: true,
        avatarUrl: true,
        timezone: true,
        weekStartsOn: true,
        level: true,
        xp: true,
        coins: true,
        aiCoachTurns: true,
        streakFreezeCount: true,
        shopUnlocks: true,
        onboardingGoal: true,
        onboardingCompleted: true,
        defaultReminderTime: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.habit.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.habitLog.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      include: { habit: { select: { title: true } } },
    }),
    prisma.task.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.moodLog.findMany({
      where: { userId },
      orderBy: { loggedAt: "desc" },
    }),
    prisma.userAchievement.findMany({
      where: { userId },
      include: {
        achievement: {
          select: { code: true, title: true, description: true, xpReward: true },
        },
      },
    }),
    prisma.streak.findMany({
      where: { userId },
      select: {
        habitId: true,
        currentCount: true,
        longestCount: true,
        freezeUsedAt: true,
        updatedAt: true,
      },
    }),
    prisma.pomodoroSession.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      take: 5000,
    }),
    prisma.userDailyChallengeProgress.findMany({
      where: { userId },
      orderBy: [{ date: "desc" }, { challengeKey: "asc" }],
      take: 400,
    }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ]);

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const exportSlug = format(new Date(), "yyyy-MM-dd");

  if (formatParam === "csv") {
    const header = "date,habit_id,habit_title,status,note";
    const lines = habitLogs.map((log) =>
      [
        escapeCsvField(format(new Date(log.date), "yyyy-MM-dd")),
        escapeCsvField(log.habitId),
        escapeCsvField(log.habit.title),
        escapeCsvField(log.status),
        escapeCsvField(log.note ?? ""),
      ].join(","),
    );
    const csv = [header, ...lines].join("\r\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="habit-completion-history-${exportSlug}.csv"`,
      },
    });
  }

  if (formatParam !== "json") {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    app: "habit-tracker",
    profile: user,
    habits,
    habitLogs: habitLogs.map(({ habit, ...rest }) => ({
      ...rest,
      date: rest.date.toISOString(),
      completedAt: rest.completedAt?.toISOString() ?? null,
      createdAt: rest.createdAt.toISOString(),
      habitTitle: habit.title,
    })),
    tasks: tasks.map((t) => ({
      ...t,
      dueDate: t.dueDate?.toISOString() ?? null,
      completedAt: t.completedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
    projects,
    moodLogs: moodLogs.map((m) => ({
      ...m,
      loggedAt: m.loggedAt.toISOString(),
    })),
    badges: userAchievements.map((ua) => ({
      earnedAt: ua.earnedAt.toISOString(),
      achievement: ua.achievement,
    })),
    streaks,
    pomodoroSessions: pomodoroSessions.map((p) => ({
      ...p,
      startedAt: p.startedAt.toISOString(),
    })),
    dailyChallengeProgress: dailyChallengeRows.map((r) => ({
      ...r,
      date: format(new Date(r.date), "yyyy-MM-dd"),
      completedAt: r.completedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    notifications: notifications.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    })),
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="habit-tracker-export-${exportSlug}.json"`,
    },
  });
}
