import { HabitStatus } from "@prisma/client";
import { endOfDay, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { BADGE_BY_CODE } from "@/lib/gamification/badges";
import { refreshUserLevelFromXp, tryAwardBadge, type NewBadgePayload } from "@/lib/gamification/award-badge";

export async function evaluateBadgesAfterHabitDone(
  userId: string,
  ctx: {
    completedAt: Date;
    doneCountForHabit: number;
    prevStreakCurrentCount: number;
  },
): Promise<NewBadgePayload[]> {
  const earned: NewBadgePayload[] = [];

  async function push(code: string) {
    const def = BADGE_BY_CODE[code];
    if (!def) return;
    const b = await tryAwardBadge(userId, def.code, def.title, def.description, def.xpReward);
    if (b) earned.push(b);
  }

  const totalLogs = await prisma.habitLog.count({
    where: { userId, status: HabitStatus.DONE },
  });
  if (totalLogs === 1) await push("FIRST_HABIT");

  if (ctx.doneCountForHabit >= 7) await push("STREAK_7");
  if (ctx.doneCountForHabit >= 30) await push("STREAK_30");
  if (totalLogs >= 100) await push("CENTURY");

  if (ctx.prevStreakCurrentCount === 0 && ctx.doneCountForHabit >= 1) await push("COMEBACK");

  const h = ctx.completedAt.getUTCHours();
  if (h < 8) {
    const n = await prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*)::bigint AS c FROM "HabitLog"
      WHERE "userId" = ${userId} AND status = 'DONE'
      AND "completedAt" IS NOT NULL
      AND EXTRACT(HOUR FROM "completedAt" AT TIME ZONE 'UTC') < 8
    `;
    if (Number(n[0]?.c ?? 0) >= 5) await push("EARLY_BIRD");
  }
  if (h >= 22) {
    const n = await prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*)::bigint AS c FROM "HabitLog"
      WHERE "userId" = ${userId} AND status = 'DONE'
      AND "completedAt" IS NOT NULL
      AND EXTRACT(HOUR FROM "completedAt" AT TIME ZONE 'UTC') >= 22
    `;
    if (Number(n[0]?.c ?? 0) >= 5) await push("NIGHT_OWL");
  }

  const friends = await prisma.friend.count({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
  });
  if (friends >= 5) await push("SOCIAL_BUTTERFLY");

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { xp: true, coins: true, onboardingCompleted: true, aiCoachTurns: true },
  });
  if (u && u.xp >= 1000) await push("LUMINARY");
  if (u && u.coins >= 100) await push("COIN_CARRIER");
  if (u?.onboardingCompleted) await push("GOAL_SETTER");

  if ((u?.aiCoachTurns ?? 0) >= 10) await push("AI_CURIOUS");

  const dayStart = startOfDay(new Date());
  const dayEnd = endOfDay(new Date());
  const habitCount = await prisma.habit.count({ where: { userId, isArchived: false } });
  if (habitCount > 0) {
    const distinctToday = await prisma.habitLog.groupBy({
      by: ["habitId"],
      where: {
        userId,
        status: HabitStatus.DONE,
        date: { gte: dayStart, lte: dayEnd },
      },
    });
    if (distinctToday.length >= habitCount) await push("PERFECTIONIST");

    const logsToday = await prisma.habitLog.findMany({
      where: {
        userId,
        status: HabitStatus.DONE,
        date: { gte: dayStart, lte: dayEnd },
      },
      select: { habitId: true, completedAt: true },
    });
    const byHabit = new Map<string, Date>();
    for (const l of logsToday) {
      if (l.completedAt) byHabit.set(l.habitId, l.completedAt);
    }
    if (
      byHabit.size >= habitCount &&
      [...byHabit.values()].every((d) => d.getUTCHours() < 12)
    ) {
      await push("SPEED_RUNNER");
    }
  }

  const moodCount = await prisma.moodLog.count({ where: { userId } });
  if (moodCount >= 7) await push("MOOD_TRACKER");

  const activeHabits = await prisma.habit.count({ where: { userId, isArchived: false } });
  if (activeHabits >= 5) await push("HABIT_COLLECTOR");

  const pomo = await prisma.pomodoroSession.count({ where: { userId, completed: true } });
  if (pomo >= 10) await push("FOCUS_FANATIC");

  const joinedChal = await prisma.userChallenge.count({ where: { userId } });
  if (joinedChal >= 1) await push("CHALLENGE_ACCEPTED");

  const doubleDays = await prisma.$queryRaw<{ c: bigint }[]>`
    SELECT COUNT(*)::bigint AS c FROM (
      SELECT DATE("date" AT TIME ZONE 'UTC') AS d, COUNT(*) AS n FROM "HabitLog"
      WHERE "userId" = ${userId} AND status = 'DONE'
      GROUP BY DATE("date" AT TIME ZONE 'UTC') HAVING COUNT(*) >= 2
    ) sub
  `;
  if (Number(doubleDays[0]?.c ?? 0) >= 10) await push("DOUBLE_DOWN");

  await refreshUserLevelFromXp(userId);
  return earned;
}

export async function evaluateBadgesAfterMoodLog(userId: string): Promise<NewBadgePayload[]> {
  const earned: NewBadgePayload[] = [];
  const moodCount = await prisma.moodLog.count({ where: { userId } });
  if (moodCount >= 7) {
    const def = BADGE_BY_CODE["MOOD_TRACKER"];
    if (def) {
      const b = await tryAwardBadge(userId, def.code, def.title, def.description, def.xpReward);
      if (b) earned.push(b);
    }
  }
  await refreshUserLevelFromXp(userId);
  return earned;
}

export async function evaluateBadgesAfterTaskDone(userId: string): Promise<NewBadgePayload[]> {
  const earned: NewBadgePayload[] = [];
  const doneTasks = await prisma.task.count({ where: { userId, status: "done" } });
  if (doneTasks >= 50) {
    const def = BADGE_BY_CODE["TASK_MACHINE"];
    if (def) {
      const b = await tryAwardBadge(userId, def.code, def.title, def.description, def.xpReward);
      if (b) earned.push(b);
    }
  }
  await refreshUserLevelFromXp(userId);
  return earned;
}
