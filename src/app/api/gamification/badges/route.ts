import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { BADGE_CATALOG } from "@/lib/gamification/badges";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const earned = await prisma.userAchievement.findMany({
    where: { userId: session.user.id },
    include: { achievement: true },
    orderBy: { earnedAt: "desc" },
  });
  const earnedCodes = new Set(earned.map((e) => e.achievement.code));

  const catalog = BADGE_CATALOG.map((b) => ({
    ...b,
    earned: earnedCodes.has(b.code),
  }));

  return NextResponse.json({ earned, catalog });
}
