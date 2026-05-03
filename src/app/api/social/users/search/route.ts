import { FriendStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { communityPhotoUrl } from "@/lib/social-avatar";
import { publicDisplayName } from "@/lib/user-public";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const uid = session.user.id;
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  const users = await prisma.user.findMany({
    where: {
      id: { not: uid },
      AND: [
        {
          OR: [
            { sentFriendships: { some: { addresseeId: uid, status: FriendStatus.ACCEPTED } } },
            { receivedFriendships: { some: { requesterId: uid, status: FriendStatus.ACCEPTED } } },
          ],
        },
        q
          ? {
              OR: [
                { username: { contains: q, mode: "insensitive" } },
                { displayName: { contains: q, mode: "insensitive" } },
                { name: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      name: true,
      avatarUrl: true,
    },
    orderBy: [{ username: "asc" }, { displayName: "asc" }],
    take: 12,
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: publicDisplayName(u.displayName, u.name),
      photoUrl: communityPhotoUrl(u.avatarUrl),
    })),
  );
}
