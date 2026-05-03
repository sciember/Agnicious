import { ChallengeParticipantStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { atHandle } from "@/lib/user-handle";
import { normalizeUsername, validateUsernameFormat } from "@/lib/username";

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

async function resolveUsernameInvites(rawList: string[], selfId: string): Promise<string[]> {
  const ids: string[] = [];
  for (const raw of rawList) {
    const norm = normalizeUsername(raw);
    if (!validateUsernameFormat(norm).ok) continue;
    const u = await prisma.user.findUnique({
      where: { username: norm },
      select: { id: true },
    });
    if (u && u.id !== selfId) ids.push(u.id);
  }
  return [...new Set(ids)];
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: challengeId } = await ctx.params;
  const uid = session.user.id;

  const ch = await prisma.socialChallenge.findUnique({ where: { id: challengeId } });
  if (!ch || ch.creatorId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json()) as { userIds?: string[]; usernames?: string[] };
  const userIds = Array.isArray(body.userIds) ? body.userIds.filter((x): x is string => typeof x === "string") : [];
  const usernames = Array.isArray(body.usernames) ? body.usernames.filter((x): x is string => typeof x === "string") : [];
  const fromNames = await resolveUsernameInvites(usernames, uid);
  const unique = [...new Set([...userIds, ...fromNames])].filter((id) => id !== uid);

  if (unique.length === 0) {
    return NextResponse.json({ error: "userIds or usernames required" }, { status: 400 });
  }

  for (const fid of unique) {
    if (!(await isAcceptedFriend(uid, fid))) {
      return NextResponse.json({ error: "You can only invite accepted friends." }, { status: 400 });
    }
  }

  const inviter = await prisma.user.findUnique({
    where: { id: uid },
    select: { username: true, displayName: true, name: true },
  });
  const inviterLabel = atHandle(inviter?.username, inviter?.displayName, inviter?.name);
  const safeTitle = ch.title.slice(0, 120);

  for (const fid of unique) {
    const existing = await prisma.socialChallengeParticipant.findUnique({
      where: { challengeId_userId: { challengeId, userId: fid } },
    });
    let shouldNotify = false;
    if (!existing) {
      await prisma.socialChallengeParticipant.create({
        data: {
          challengeId,
          userId: fid,
          status: ChallengeParticipantStatus.PENDING,
          progressDays: 0,
        },
      });
      shouldNotify = true;
    } else if (existing.status === ChallengeParticipantStatus.DECLINED) {
      await prisma.socialChallengeParticipant.update({
        where: { id: existing.id },
        data: { status: ChallengeParticipantStatus.PENDING },
      });
      shouldNotify = true;
    }
    if (shouldNotify) {
      await prisma.notification.create({
        data: {
          userId: fid,
          fromId: uid,
          type: "challenge_invite",
          message: `${inviterLabel} invited you to ${safeTitle}`,
          data: JSON.stringify({ challengeId }),
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
