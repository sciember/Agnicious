import { ChallengeParticipantStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { communityPhotoUrl } from "@/lib/social-avatar";
import { atHandle } from "@/lib/user-handle";
import { publicDisplayName } from "@/lib/user-public";
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

function mapUser(u: { id: string; displayName: string | null; name: string | null; avatarUrl: string | null }) {
  return {
    id: u.id,
    displayName: publicDisplayName(u.displayName, u.name),
    photoUrl: communityPhotoUrl(u.avatarUrl),
  };
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

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const uid = session.user.id;

  const list = await prisma.socialChallenge.findMany({
    where: {
      OR: [
        { creatorId: uid },
        {
          participants: {
            some: {
              userId: uid,
              status: { in: [ChallengeParticipantStatus.PENDING, ChallengeParticipantStatus.ACCEPTED] },
            },
          },
        },
      ],
    },
    include: {
      creator: { select: { id: true, displayName: true, name: true, avatarUrl: true } },
      participants: {
        include: {
          user: { select: { id: true, displayName: true, name: true, avatarUrl: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    list.map((c) => {
      const mine = c.participants.find((p) => p.userId === uid);
      return {
        id: c.id,
        title: c.title,
        description: c.description,
        durationDays: c.durationDays,
        createdAt: c.createdAt,
        creatorId: c.creatorId,
        isCreator: c.creatorId === uid,
        myStatus: mine?.status ?? null,
        myProgressDays: mine?.progressDays ?? 0,
        myCompletedAt: mine?.completedAt ?? null,
        participants: c.participants.map((p) => ({
          ...mapUser(p.user),
          status: p.status,
          progressDays: p.progressDays,
        })),
      };
    }),
  );
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const uid = session.user.id;

  const body = (await request.json()) as {
    title?: string;
    description?: string | null;
    durationDays?: number;
    inviteUserIds?: string[];
    inviteUsernames?: string[];
  };

  const title = body.title?.trim();
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  const days = Number(body.durationDays);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    return NextResponse.json({ error: "durationDays must be 1–365" }, { status: 400 });
  }

  const inviteUserIds = Array.isArray(body.inviteUserIds) ? body.inviteUserIds.filter((x): x is string => typeof x === "string") : [];
  const inviteUsernames = Array.isArray(body.inviteUsernames) ? body.inviteUsernames.filter((x): x is string => typeof x === "string") : [];
  const fromNames = await resolveUsernameInvites(inviteUsernames, uid);
  const uniqueInvites = [...new Set([...inviteUserIds, ...fromNames])].filter((id) => id !== uid);

  for (const fid of uniqueInvites) {
    if (!(await isAcceptedFriend(uid, fid))) {
      return NextResponse.json({ error: "You can only invite accepted friends." }, { status: 400 });
    }
  }

  const description = body.description?.trim() ? body.description.trim().slice(0, 2000) : null;
  const safeTitle = title.slice(0, 120);

  const created = await prisma.$transaction(async (tx) => {
    const ch = await tx.socialChallenge.create({
      data: {
        creatorId: uid,
        title: safeTitle,
        description,
        durationDays: days,
      },
    });
    await tx.socialChallengeParticipant.create({
      data: {
        challengeId: ch.id,
        userId: uid,
        status: ChallengeParticipantStatus.ACCEPTED,
        progressDays: 0,
      },
    });

    const inviter = await tx.user.findUnique({
      where: { id: uid },
      select: { username: true, displayName: true, name: true },
    });
    const inviterLabel = atHandle(inviter?.username, inviter?.displayName, inviter?.name);

    for (const fid of uniqueInvites) {
      await tx.socialChallengeParticipant.create({
        data: {
          challengeId: ch.id,
          userId: fid,
          status: ChallengeParticipantStatus.PENDING,
          progressDays: 0,
        },
      });
      await tx.notification.create({
        data: {
          userId: fid,
          fromId: uid,
          type: "challenge_invite",
          message: `${inviterLabel} invited you to ${safeTitle}`,
          data: JSON.stringify({ challengeId: ch.id }),
        },
      });
    }
    return ch;
  });

  return NextResponse.json({ id: created.id });
}
