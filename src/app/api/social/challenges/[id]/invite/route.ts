import { ChallengeParticipantStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function isAcceptedFriend(a: string, b: string) {
  const row = await prisma.friend.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: a, addresseeId: b },
        { requesterId: b, addresseeId: a },
      ],
    },
  });
  return !!row;
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: challengeId } = await ctx.params;
  const uid = session.user.id;

  const ch = await prisma.socialChallenge.findUnique({ where: { id: challengeId } });
  if (!ch || ch.creatorId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { userIds } = (await request.json()) as { userIds?: string[] };
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: "userIds required" }, { status: 400 });
  }

  const unique = [...new Set(userIds.filter((x): x is string => typeof x === "string"))].filter((id) => id !== uid);

  for (const fid of unique) {
    if (!(await isAcceptedFriend(uid, fid))) {
      return NextResponse.json({ error: "You can only invite accepted friends." }, { status: 400 });
    }
    const existing = await prisma.socialChallengeParticipant.findUnique({
      where: { challengeId_userId: { challengeId, userId: fid } },
    });
    if (!existing) {
      await prisma.socialChallengeParticipant.create({
        data: {
          challengeId,
          userId: fid,
          status: ChallengeParticipantStatus.PENDING,
          progressDays: 0,
        },
      });
    } else if (existing.status === ChallengeParticipantStatus.DECLINED) {
      await prisma.socialChallengeParticipant.update({
        where: { id: existing.id },
        data: { status: ChallengeParticipantStatus.PENDING },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
