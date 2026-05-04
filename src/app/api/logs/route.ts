import { HabitStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { FEATURE_SHOP_AND_BADGES } from "@/lib/feature-gamification";
import { refreshUserLevelFromXp } from "@/lib/gamification/award-badge";
import { evaluateBadgesAfterHabitDone } from "@/lib/gamification/evaluate-badges";
import { syncUserDailyChallenges } from "@/lib/gamification/sync-daily-challenges";
import { prisma } from "@/lib/prisma";
import { resolveAuthUser } from "@/lib/server-auth-user";
import { habitLogSchema } from "@/lib/validations/habit";

export async function GET(request: Request) {
  const authUser = await resolveAuthUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const logs = await prisma.habitLog.findMany({
    where: {
      userId: authUser.id,
      date: {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(to) : undefined,
      },
    },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(logs);
}

export async function POST(request: Request) {
  const authUser = await resolveAuthUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = habitLogSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const date = new Date(parsed.data.date);
  const previousStreak = await prisma.streak.findFirst({
    where: { habitId: parsed.data.habitId, userId: authUser.id },
    select: { currentCount: true, longestCount: true },
  });

  const existing = await prisma.habitLog.findUnique({
    where: { habitId_date: { habitId: parsed.data.habitId, date } },
    select: { id: true },
  });

  const logSelect = {
    id: true,
    habitId: true,
    date: true,
    status: true,
  } as const;

  const log = existing
    ? await prisma.habitLog.update({
        where: { id: existing.id },
        data: { status: parsed.data.status as HabitStatus, note: parsed.data.note, completedAt: new Date() },
        select: logSelect,
      })
    : await prisma.habitLog.create({
        data: {
          habitId: parsed.data.habitId,
          userId: authUser.id,
          date,
          status: parsed.data.status as HabitStatus,
          note: parsed.data.note,
          completedAt: new Date(),
        },
        select: logSelect,
      });

  const doneCount = await prisma.habitLog.count({
    where: { habitId: parsed.data.habitId, userId: authUser.id, status: HabitStatus.DONE },
  });
  await prisma.streak.updateMany({
    where: { habitId: parsed.data.habitId, userId: authUser.id },
    data: {
      currentCount: parsed.data.status === "DONE" ? doneCount : 0,
      longestCount: Math.max(doneCount, previousStreak?.longestCount ?? 0),
    },
  });

  let newBadges: { code: string; title: string; description: string }[] = [];
  let summary:
    | { newBadges: typeof newBadges; xp: number; coinsEarned: number; level: number }
    | undefined;

  if (parsed.data.status === "DONE") {
    const completedAt = new Date();
    await prisma.user.update({
      where: { id: authUser.id },
      data: {
        xp: { increment: 10 },
        ...(FEATURE_SHOP_AND_BADGES ? { coins: { increment: 5 } } : {}),
      },
      select: { id: true },
    });

    if (doneCount > 0 && doneCount % 7 === 0) {
      await prisma.user.update({
        where: { id: authUser.id },
        data: { streakFreezeCount: { increment: 1 } },
        select: { id: true },
      });
    }

    await refreshUserLevelFromXp(authUser.id);

    newBadges = await evaluateBadgesAfterHabitDone(authUser.id, {
      completedAt,
      doneCountForHabit: doneCount,
      prevStreakCurrentCount: previousStreak?.currentCount ?? 0,
    });

    await syncUserDailyChallenges(authUser.id).catch(() => undefined);

    const habit = await prisma.habit.findUnique({
      where: { id: parsed.data.habitId },
      select: { title: true },
    });
    await prisma.activity.create({
      data: {
        userId: authUser.id,
        message: `Completed habit: ${habit?.title ?? "Habit"}`,
        metadata: { habitId: parsed.data.habitId, status: parsed.data.status },
      },
    });

    const u = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { xp: true, level: true },
    });
    summary = {
      newBadges,
      xp: u?.xp ?? 0,
      coinsEarned: FEATURE_SHOP_AND_BADGES ? 5 : 0,
      level: u?.level ?? 1,
    };
  }

  const activeChallenges = await prisma.userChallenge.findMany({
    where: { userId: authUser.id, completedAt: null },
    select: {
      id: true,
      challenge: { select: { durationDays: true } },
    },
  });
  for (const challenge of activeChallenges) {
    const progress = await prisma.habitLog.count({
      where: {
        userId: authUser.id,
        status: HabitStatus.DONE,
        date: {
          gte: new Date(Date.now() - challenge.challenge.durationDays * 24 * 60 * 60 * 1000),
        },
      },
    });
    await prisma.userChallenge.update({
      where: { id: challenge.id },
      data: {
        progressDays: Math.min(progress, challenge.challenge.durationDays),
        completedAt: progress >= challenge.challenge.durationDays ? new Date() : null,
      },
    });
  }

  return NextResponse.json(
    {
      ...log,
      gamification: summary,
    },
    { status: 201 },
  );
}
