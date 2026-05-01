import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const defaults = [
  { title: "7-Day Challenge", durationDays: 7 },
  { title: "21-Day Challenge", durationDays: 21 },
];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  for (const c of defaults) {
    await prisma.challenge.upsert({
      where: { title: c.title },
      create: c,
      update: { durationDays: c.durationDays },
    });
  }

  const challenges = await prisma.challenge.findMany({
    orderBy: { durationDays: "asc" },
  });
  const joined = await prisma.userChallenge.findMany({
    where: { userId: session.user.id },
  });
  const joinedIds = new Set(joined.map((j) => j.challengeId));

  return NextResponse.json(
    challenges.map((c) => ({
      ...c,
      joined: joinedIds.has(c.id),
      progress: joined.find((j) => j.challengeId === c.id)?.progressDays ?? 0,
      completedAt: joined.find((j) => j.challengeId === c.id)?.completedAt ?? null,
    })),
  );
}
