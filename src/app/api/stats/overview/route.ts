import { HabitStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [habitsCount, completedCount, streaks, user, badges] = await Promise.all([
    prisma.habit.count({ where: { userId: session.user.id, isArchived: false } }),
    prisma.habitLog.count({ where: { userId: session.user.id, status: HabitStatus.DONE } }),
    prisma.streak.findMany({ where: { userId: session.user.id } }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { xp: true, level: true, streakFreezeCount: true },
    }),
    prisma.userAchievement.count({ where: { userId: session.user.id } }),
  ]);

  return NextResponse.json({
    habitsCount,
    completedCount,
    currentStreak: Math.max(0, ...streaks.map((s) => s.currentCount)),
    longestStreak: Math.max(0, ...streaks.map((s) => s.longestCount)),
    xp: user?.xp ?? 0,
    level: user?.level ?? 1,
    streakFreezes: user?.streakFreezeCount ?? 0,
    badges,
  });
}
