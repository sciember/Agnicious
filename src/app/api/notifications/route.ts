import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { communityPhotoUrl } from "@/lib/social-avatar";
import { publicDisplayName } from "@/lib/user-public";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  if (searchParams.get("summary") === "1") {
    const unreadCount = await prisma.notification.count({
      where: { userId: session.user.id, read: false },
    });
    return NextResponse.json({ unreadCount });
  }

  const unreadCount = await prisma.notification.count({
    where: { userId: session.user.id, read: false },
  });

  const items = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      from: {
        select: {
          id: true,
          username: true,
          displayName: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
  });

  return NextResponse.json({
    unreadCount,
    items: items.map((n) => ({
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
    })),
  });
}
