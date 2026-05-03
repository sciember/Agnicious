import { HabitStatus } from "@prisma/client";
import { endOfDay, startOfDay } from "date-fns";
import { FEATURE_SHOP_AND_BADGES } from "@/lib/feature-gamification";
import { prisma } from "@/lib/prisma";
import { refreshUserLevelFromXp } from "@/lib/gamification/award-badge";
import { getDailyChallengesForDate } from "@/lib/gamification/daily-challenges";

export type ChallengeState = {
  key: string;
  text: string;
  type: string;
  targetCount: number;
  xpReward: number;
  progress: number;
  completed: boolean;
};

export async function syncUserDailyChallenges(userId: string, d = new Date()): Promise<ChallengeState[]> {
  const dayStart = startOfDay(d);
  const dayEnd = endOfDay(d);
  const defs = getDailyChallengesForDate(d);
  const out: ChallengeState[] = [];

  for (const ch of defs) {
    let progress = 0;

    switch (ch.type) {
      case "habit_logs_3":
        progress = await prisma.habitLog.count({
          where: {
            userId,
            status: HabitStatus.DONE,
            date: { gte: dayStart, lte: dayEnd },
          },
        });
        break;
      case "tasks_2":
        progress = await prisma.task.count({
          where: {
            userId,
            status: "done",
            completedAt: { gte: dayStart, lte: dayEnd },
          },
        });
        break;
      case "pomodoro_2":
        progress = await prisma.pomodoroSession.count({
          where: {
            userId,
            completed: true,
            startedAt: { gte: dayStart, lte: dayEnd },
          },
        });
        break;
      case "mood_once":
        progress = await prisma.moodLog.count({
          where: { userId, loggedAt: { gte: dayStart, lte: dayEnd } },
        });
        break;
      case "habits_before_14": {
        const habitCount = await prisma.habit.count({ where: { userId, isArchived: false } });
        if (habitCount === 0) {
          progress = 0;
          break;
        }
        const logs = await prisma.habitLog.findMany({
          where: {
            userId,
            status: HabitStatus.DONE,
            date: { gte: dayStart, lte: dayEnd },
          },
          select: { habitId: true, completedAt: true },
        });
        const byHabit = new Map<string, boolean>();
        for (const l of logs) {
          if (l.completedAt && l.completedAt.getUTCHours() < 14) byHabit.set(l.habitId, true);
        }
        progress = byHabit.size >= habitCount ? 1 : 0;
        break;
      }
      case "all_habits_today": {
        const habitCount = await prisma.habit.count({ where: { userId, isArchived: false } });
        if (habitCount === 0) {
          progress = 0;
          break;
        }
        const distinct = await prisma.habitLog.groupBy({
          by: ["habitId"],
          where: {
            userId,
            status: HabitStatus.DONE,
            date: { gte: dayStart, lte: dayEnd },
          },
        });
        progress = distinct.length >= habitCount ? 1 : 0;
        break;
      }
      case "create_item": {
        const nh = await prisma.habit.count({
          where: { userId, createdAt: { gte: dayStart, lte: dayEnd } },
        });
        const nt = await prisma.task.count({
          where: { userId, createdAt: { gte: dayStart, lte: dayEnd } },
        });
        progress = nh + nt > 0 ? 1 : 0;
        break;
      }
      default:
        progress = 0;
    }

    const capped = Math.min(progress, ch.targetCount);

    const existingRow = await prisma.userDailyChallengeProgress.findUnique({
      where: {
        userId_date_challengeKey: {
          userId,
          date: dayStart,
          challengeKey: ch.key,
        },
      },
    });

    if (existingRow?.completedAt) {
      out.push({
        key: ch.key,
        text: ch.text,
        type: ch.type,
        targetCount: ch.targetCount,
        xpReward: ch.xpReward,
        progress: ch.targetCount,
        completed: true,
      });
      continue;
    }

    const row = await prisma.userDailyChallengeProgress.upsert({
      where: {
        userId_date_challengeKey: {
          userId,
          date: dayStart,
          challengeKey: ch.key,
        },
      },
      create: {
        userId,
        date: dayStart,
        challengeKey: ch.key,
        progress: capped,
      },
      update: { progress: capped },
    });

    if (capped >= ch.targetCount && !row.completedAt) {
      await prisma.userDailyChallengeProgress.update({
        where: { id: row.id },
        data: { completedAt: new Date(), progress: ch.targetCount },
      });
      await prisma.user.update({
        where: { id: userId },
        data: {
          xp: { increment: ch.xpReward },
          ...(FEATURE_SHOP_AND_BADGES ? { coins: { increment: 20 } } : {}),
        },
        select: { id: true },
      });
      await refreshUserLevelFromXp(userId);
      out.push({
        key: ch.key,
        text: ch.text,
        type: ch.type,
        targetCount: ch.targetCount,
        xpReward: ch.xpReward,
        progress: ch.targetCount,
        completed: true,
      });
    } else {
      out.push({
        key: ch.key,
        text: ch.text,
        type: ch.type,
        targetCount: ch.targetCount,
        xpReward: ch.xpReward,
        progress: capped,
        completed: false,
      });
    }
  }

  return out;
}
