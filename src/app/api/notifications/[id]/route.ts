import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { communityPhotoUrl } from "@/lib/social-avatar";
import { atHandle } from "@/lib/user-handle";
import { publicDisplayName } from "@/lib/user-public";

function mapNotificationRow(n: {
  id: string;
  type: string;
  message: string;
  read: boolean;
  data: string | null;
  createdAt: Date;
  from: {
    id: string;
    username: string | null;
    displayName: string | null;
    name: string | null;
    avatarUrl: string | null;
  } | null;
}) {
  return {
    id: n.id,
    type: n.type,
    message: n.message,
    read: n.read,
    data: n.data,
    createdAt: n.createdAt.toISOString(),
    from: n.from
      ? {
          id: n.from.id,
          username: n.from.username,
          displayName: publicDisplayName(n.from.displayName, n.from.name),
          photoUrl: communityPhotoUrl(n.from.avatarUrl),
        }
      : null,
  };
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as
    | { read?: boolean; resolution?: { action: "accepted" | "declined" } }
    | null;

  if (body?.resolution) {
    const action = body.resolution.action;
    if (action !== "accepted" && action !== "declined") {
      return NextResponse.json({ error: "Invalid resolution action" }, { status: 400 });
    }

    const row = await prisma.notification.findFirst({
      where: { id, userId: session.user.id },
      include: {
        from: { select: { id: true, username: true, displayName: true, name: true, avatarUrl: true } },
      },
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (row.type !== "friend_request" && row.type !== "challenge_invite") {
      return NextResponse.json({ error: "Notification type cannot be resolved this way" }, { status: 400 });
    }

    let existingData: Record<string, unknown> = {};
    if (row.data) {
      try {
        existingData = JSON.parse(row.data) as Record<string, unknown>;
      } catch {
        existingData = {};
      }
    }
    if (existingData.resolved === true) {
      const again = await prisma.notification.findFirst({
        where: { id, userId: session.user.id },
        include: {
          from: { select: { id: true, username: true, displayName: true, name: true, avatarUrl: true } },
        },
      });
      if (!again) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ notification: mapNotificationRow(again) });
    }

    const fromLabel = row.from ? atHandle(row.from.username, row.from.displayName, row.from.name) : "someone";

    let newMessage: string;
    if (row.type === "friend_request") {
      newMessage =
        action === "accepted" ? `You accepted ${fromLabel}'s friend request` : `You declined ${fromLabel}'s friend request`;
    } else {
      newMessage =
        action === "accepted" ? `You joined ${fromLabel}'s challenge` : `You declined ${fromLabel}'s challenge invite`;
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: {
        message: newMessage,
        read: true,
        data: JSON.stringify({ ...existingData, resolved: true, resolution: action }),
      },
      include: {
        from: { select: { id: true, username: true, displayName: true, name: true, avatarUrl: true } },
      },
    });

    return NextResponse.json({ notification: mapNotificationRow(updated) });
  }

  if (body?.read === true) {
    const row = await prisma.notification.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "read: true or resolution required" }, { status: 400 });
}
