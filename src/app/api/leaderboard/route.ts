import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { communityPhotoUrl } from "@/lib/social-avatar";
import { publicDisplayName } from "@/lib/user-public";

export async function GET() {
  const leaders = await prisma.user.findMany({
    select: {
      id: true,
      displayName: true,
      name: true,
      avatarUrl: true,
      xp: true,
      streaks: { select: { currentCount: true } },
    },
    orderBy: [{ xp: "desc" }],
    take: 100,
  });

  return NextResponse.json(
    leaders.map((leader) => ({
      id: leader.id,
      displayName: publicDisplayName(leader.displayName, leader.name),
      photoUrl: communityPhotoUrl(leader.avatarUrl),
      xp: leader.xp,
      streakCount: leader.streaks.reduce((max, streak) => Math.max(max, streak.currentCount), 0),
    })),
  );
}
