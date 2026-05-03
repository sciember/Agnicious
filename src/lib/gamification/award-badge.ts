import { prisma } from "@/lib/prisma";
import { levelFromXp } from "@/lib/gamification/xp-level";

export type NewBadgePayload = { code: string; title: string; description: string };

export async function tryAwardBadge(
  userId: string,
  code: string,
  title: string,
  description: string,
  xpReward = 0,
): Promise<NewBadgePayload | null> {
  const achievement = await prisma.achievement.upsert({
    where: { code },
    create: { code, title, description, xpReward },
    update: xpReward > 0 ? { xpReward } : {},
  });

  const existing = await prisma.userAchievement.findUnique({
    where: { userId_achievementId: { userId, achievementId: achievement.id } },
  });
  if (existing) return null;

  await prisma.userAchievement.create({
    data: { userId, achievementId: achievement.id },
  });

  if (xpReward > 0) {
    const u = await prisma.user.update({
      where: { id: userId },
      data: { xp: { increment: xpReward } },
      select: { xp: true },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { level: levelFromXp(u.xp) },
    });
  }

  return { code, title, description };
}

export async function refreshUserLevelFromXp(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { xp: true },
  });
  if (!u) return;
  await prisma.user.update({
    where: { id: userId },
    data: { level: levelFromXp(u.xp) },
  });
}
