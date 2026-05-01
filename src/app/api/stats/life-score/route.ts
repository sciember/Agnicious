import { LifeArea } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const habits = await prisma.habit.findMany({
    where: { userId: session.user.id, isArchived: false },
    select: { id: true, lifeArea: true },
  });

  const scores = { HEALTH: 0, CAREER: 0, MIND: 0 } as Record<LifeArea, number>;
  const totalByArea = { HEALTH: 0, CAREER: 0, MIND: 0 } as Record<LifeArea, number>;

  for (const habit of habits) {
    totalByArea[habit.lifeArea] += 1;
    const done = await prisma.habitLog.count({
      where: { habitId: habit.id, status: "DONE" },
    });
    scores[habit.lifeArea] += done;
  }

  const health = totalByArea.HEALTH ? Math.min(100, Math.round((scores.HEALTH / (totalByArea.HEALTH * 30)) * 100)) : 0;
  const career = totalByArea.CAREER ? Math.min(100, Math.round((scores.CAREER / (totalByArea.CAREER * 30)) * 100)) : 0;
  const mind = totalByArea.MIND ? Math.min(100, Math.round((scores.MIND / (totalByArea.MIND * 30)) * 100)) : 0;

  return NextResponse.json({
    health,
    career,
    mind,
    overall: Math.round((health + career + mind) / 3),
  });
}
