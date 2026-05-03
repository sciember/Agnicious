import { FriendStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { createNotification } from "@/lib/create-notification";
import { prisma } from "@/lib/prisma";
import { communityPhotoUrl } from "@/lib/social-avatar";
import { atHandle } from "@/lib/user-handle";
import { publicDisplayName } from "@/lib/user-public";
import { normalizeUsername, validateUsernameFormat } from "@/lib/username";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const friends = await prisma.friend.findMany({
    where: {
      OR: [{ requesterId: session.user.id }, { addresseeId: session.user.id }],
    },
    include: {
      requester: { select: { id: true, username: true, displayName: true, name: true, avatarUrl: true } },
      addressee: { select: { id: true, username: true, displayName: true, name: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    friends.map((friend) => ({
      ...friend,
      requester: {
        id: friend.requester.id,
        username: friend.requester.username,
        displayName: publicDisplayName(friend.requester.displayName, friend.requester.name),
        photoUrl: communityPhotoUrl(friend.requester.avatarUrl),
      },
      addressee: {
        id: friend.addressee.id,
        username: friend.addressee.username,
        displayName: publicDisplayName(friend.addressee.displayName, friend.addressee.name),
        photoUrl: communityPhotoUrl(friend.addressee.avatarUrl),
      },
    })),
  );
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { targetUsername, action, requestId } = (await request.json()) as {
    targetUsername?: string;
    action?: "request" | "accept" | "decline";
    requestId?: string;
  };

  if (action === "request") {
    if (!targetUsername?.trim()) {
      return NextResponse.json({ error: "targetUsername required" }, { status: 400 });
    }
    const norm = normalizeUsername(targetUsername);
    const format = validateUsernameFormat(norm);
    if (!format.ok) {
      return NextResponse.json({ error: format.error }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { username: norm } });
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (target.id === session.user.id) return NextResponse.json({ error: "Cannot add self" }, { status: 400 });

    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { username: true, displayName: true, name: true },
    });
    const senderLabel = atHandle(me?.username, me?.displayName, me?.name);

    const reverseRequest = await prisma.friend.findUnique({
      where: { requesterId_addresseeId: { requesterId: target.id, addresseeId: session.user.id } },
    });
    if (reverseRequest?.status === FriendStatus.PENDING) {
      const accepted = await prisma.friend.update({
        where: { id: reverseRequest.id },
        data: { status: FriendStatus.ACCEPTED },
      });
      const accepter = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { username: true, displayName: true, name: true },
      });
      const accepterLabel = atHandle(accepter?.username, accepter?.displayName, accepter?.name);
      await createNotification({
        userId: target.id,
        fromId: session.user.id,
        type: "accepted",
        message: `${accepterLabel} accepted your friend request`,
        data: { friendRequestId: accepted.id },
      });
      return NextResponse.json(accepted);
    }

    const friendship = await prisma.friend.upsert({
      where: { requesterId_addresseeId: { requesterId: session.user.id, addresseeId: target.id } },
      create: { requesterId: session.user.id, addresseeId: target.id, status: FriendStatus.PENDING },
      update: { status: FriendStatus.PENDING },
    });

    await createNotification({
      userId: target.id,
      fromId: session.user.id,
      type: "friend_request",
      message: `${senderLabel} wants to be your friend`,
      data: { friendRequestId: friendship.id },
    });

    await prisma.activity.create({
      data: {
        userId: session.user.id,
        message: `Sent friend request to ${target.displayName ?? target.name ?? "a user"}`,
        metadata: { targetUserId: target.id },
      },
    });
    return NextResponse.json(friendship);
  }

  if (action === "accept") {
    if (!requestId) return NextResponse.json({ error: "requestId required" }, { status: 400 });
    const friendship = await prisma.friend.findUnique({ where: { id: requestId } });
    if (!friendship || friendship.addresseeId !== session.user.id) {
      return NextResponse.json({ error: "Friend request not found" }, { status: 404 });
    }

    const accepted = await prisma.friend.update({
      where: { id: requestId },
      data: { status: FriendStatus.ACCEPTED },
    });

    const accepter = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { username: true, displayName: true, name: true },
    });
    const accepterLabel = atHandle(accepter?.username, accepter?.displayName, accepter?.name);

    await createNotification({
      userId: friendship.requesterId,
      fromId: session.user.id,
      type: "accepted",
      message: `${accepterLabel} accepted your friend request`,
      data: { friendRequestId: requestId },
    });

    await prisma.activity.create({
      data: {
        userId: session.user.id,
        message: "Accepted a friend request.",
        metadata: { requestId },
      },
    });
    return NextResponse.json(accepted);
  }

  if (action === "decline") {
    if (!requestId) return NextResponse.json({ error: "requestId required" }, { status: 400 });
    const friendship = await prisma.friend.findUnique({ where: { id: requestId } });
    if (!friendship || friendship.addresseeId !== session.user.id) {
      return NextResponse.json({ error: "Friend request not found" }, { status: 404 });
    }
    if (friendship.status !== FriendStatus.PENDING) {
      return NextResponse.json({ error: "Not pending" }, { status: 400 });
    }
    await prisma.friend.delete({ where: { id: requestId } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
