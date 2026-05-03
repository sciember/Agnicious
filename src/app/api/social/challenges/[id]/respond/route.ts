import { ChallengeParticipantStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: challengeId } = await ctx.params;
  const uid = session.user.id;

  const { action } = (await request.json()) as { action?: "accept" | "decline" };
  if (action !== "accept" && action !== "decline") {
    return NextResponse.json({ error: "action must be accept or decline" }, { status: 400 });
  }

  const row = await prisma.socialChallengeParticipant.findUnique({
    where: { challengeId_userId: { challengeId, userId: uid } },
  });
  if (!row || row.status !== ChallengeParticipantStatus.PENDING) {
    return NextResponse.json({ error: "No pending invite" }, { status: 400 });
  }

  await prisma.socialChallengeParticipant.update({
    where: { id: row.id },
    data: {
      status: action === "accept" ? ChallengeParticipantStatus.ACCEPTED : ChallengeParticipantStatus.DECLINED,
    },
  });

  return NextResponse.json({ ok: true });
}
