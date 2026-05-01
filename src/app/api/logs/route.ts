import { HabitStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { habitLogSchema } from "@/lib/validations/habit";

async function awardAchievement(userId: string, code: string, title: string, description: string, xpReward = 0) {
  const achievement = await prisma.achievement.upsert({
    where: { code },
    create: { code, title, description, xpReward },
    update: {},
  });

  const alreadyAwarded = await prisma.userAchievement.findUnique({
    where: { userId_achievementId: { userId, achievementId: achievement.id } },
  });
  if (alreadyAwarded) return;

  await prisma.userAchievement.create({
    data: { userId, achievementId: achievement.id },
  });
  if (xpReward > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: { xp: { increment: xpReward } },
    });
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const logs = await prisma.habitLog.findMany({
    where: {
      userId: session.user.id,
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = habitLogSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const date = new Date(parsed.data.date);
  const previousStreak = await prisma.streak.findFirst({
    where: { habitId: parsed.data.habitId, userId: session.user.id },
  });

  const existing = await prisma.habitLog.findUnique({
    where: { habitId_date: { habitId: parsed.data.habitId, date } },
  });

  const log = existing
    ? await prisma.habitLog.update({
        where: { id: existing.id },
        data: { status: parsed.data.status as HabitStatus, note: parsed.data.note, completedAt: new Date() },
      })
    : await prisma.habitLog.create({
        data: {
          habitId: parsed.data.habitId,
          userId: session.user.id,
          date,
          status: parsed.data.status as HabitStatus,
          note: parsed.data.note,
          completedAt: new Date(),
        },
      });

  const doneCount = await prisma.habitLog.count({
    where: { habitId: parsed.data.habitId, userId: session.user.id, status: HabitStatus.DONE },
  });
  await prisma.streak.updateMany({
    where: { habitId: parsed.data.habitId, userId: session.user.id },
    data: {
      currentCount: parsed.data.status === "DONE" ? doneCount : 0,
      longestCount: Math.max(doneCount, previousStreak?.longestCount ?? 0),
    },
  });

  if (parsed.data.status === "DONE") {
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { xp: { increment: 10 } },
      select: { xp: true },
    });
    await prisma.user.update({
      where: { id: session.user.id },
      data: { level: Math.max(1, Math.floor(updatedUser.xp / 100) + 1) },
    });

    // 7-day and 30-day streak badge unlocks.
    if (doneCount >= 7) {
      await awardAchievement(
        session.user.id,
        "STREAK_7",
        "7-Day Streak",
        "Completed a habit for 7 successful entries.",
        25,
      );
    }
    if (doneCount >= 30) {
      await awardAchievement(
        session.user.id,
        "STREAK_30",
        "30-Day Streak",
        "Maintained a strong 30 entry streak.",
        100,
      );
    }

    // Comeback badge after recovering from a break.
    if ((previousStreak?.currentCount ?? 0) === 0) {
      await awardAchievement(
        session.user.id,
        "COMEBACK",
        "Comeback",
        "Returned to the habit after a break.",
        20,
      );
    }

    // Keep social feed fresh.
    const habit = await prisma.habit.findUnique({
      where: { id: parsed.data.habitId },
      select: { title: true },
    });
    await prisma.activity.create({
      data: {
        userId: session.user.id,
        message: `Completed habit: ${habit?.title ?? "Habit"}`,
        metadata: { habitId: parsed.data.habitId, status: parsed.data.status },
      },
    });
  }

  // Update active challenges.
  const activeChallenges = await prisma.userChallenge.findMany({
    where: { userId: session.user.id, completedAt: null },
    include: { challenge: true },
  });
  for (const challenge of activeChallenges) {
    const progress = await prisma.habitLog.count({
      where: {
        userId: session.user.id,
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

  return NextResponse.json(log, { status: 201 });
}
