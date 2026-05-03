import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const leaders = await prisma.user.findMany({
    select: { id: true, displayName: true, name: true, image: true, xp: true, streaks: { select: { currentCount: true } } },
    orderBy: [{ xp: "desc" }],
    take: 10,
  });

  return NextResponse.json(
    leaders.map((leader) => ({
      id: leader.id,
      displayName: leader.displayName ?? leader.name ?? "User",
      image: leader.image,
      xp: leader.xp,
      streakCount: leader.streaks.reduce((max, streak) => Math.max(max, streak.currentCount), 0),
    })),
  );
}
