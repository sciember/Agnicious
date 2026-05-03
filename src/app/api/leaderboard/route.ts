import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicDisplayName } from "@/lib/user-public";

export async function GET() {
  const leaders = await prisma.user.findMany({
    select: {
      id: true,
      displayName: true,
      name: true,
      image: true,
      avatarUrl: true,
      xp: true,
      streaks: { select: { currentCount: true } },
    },
    orderBy: [{ xp: "desc" }],
    take: 10,
  });

  return NextResponse.json(
    leaders.map((leader) => ({
      id: leader.id,
      displayName: publicDisplayName(leader.displayName, leader.name),
      photoUrl: leader.avatarUrl || leader.image || null,
      xp: leader.xp,
      streakCount: leader.streaks.reduce((max, streak) => Math.max(max, streak.currentCount), 0),
    })),
  );
}
