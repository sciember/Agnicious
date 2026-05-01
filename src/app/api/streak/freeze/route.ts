import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { habitId } = (await request.json()) as { habitId?: string };
  if (!habitId) return NextResponse.json({ error: "habitId required" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { streakFreezeCount: true },
  });
  if (!user || user.streakFreezeCount <= 0) {
    return NextResponse.json({ error: "No streak freezes left" }, { status: 400 });
  }

  await prisma.streak.updateMany({
    where: { habitId, userId: session.user.id },
    data: { freezeUsedAt: new Date() },
  });
  await prisma.user.update({
    where: { id: session.user.id },
    data: { streakFreezeCount: { decrement: 1 } },
  });

  await prisma.activity.create({
    data: {
      userId: session.user.id,
      message: "Used streak freeze to protect consistency.",
      metadata: { habitId },
    },
  });

  return NextResponse.json({ ok: true });
}
