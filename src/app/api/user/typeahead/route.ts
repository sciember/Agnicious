import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { communityPhotoUrl } from "@/lib/social-avatar";
import { publicDisplayName } from "@/lib/user-public";

/** Public user search for Add Friend (not settings). Min 1 char after @ stripped. */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get("q") ?? "").trim().replace(/^@+/, "");
  if (raw.length < 1) {
    return NextResponse.json([]);
  }

  const users = await prisma.user.findMany({
    where: {
      id: { not: session.user.id },
      OR: [
        { username: { contains: raw, mode: "insensitive" } },
        { displayName: { contains: raw, mode: "insensitive" } },
        { name: { contains: raw, mode: "insensitive" } },
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
