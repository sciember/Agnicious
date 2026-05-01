import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { challengeId } = (await request.json()) as { challengeId?: string };
  if (!challengeId) return NextResponse.json({ error: "challengeId required" }, { status: 400 });

  const joined = await prisma.userChallenge.upsert({
    where: { userId_challengeId: { userId: session.user.id, challengeId } },
    create: { userId: session.user.id, challengeId },
    update: {},
  });

  return NextResponse.json(joined);
}
