import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publicDisplayName } from "@/lib/user-public";
import { normalizeUsername, validateUsernameFormat } from "@/lib/username";

/** Resolve @username for invites / friend requests (authenticated). */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("u") ?? "";
  const norm = normalizeUsername(raw);
  const format = validateUsernameFormat(norm);
  if (!format.ok) {
    return NextResponse.json({ found: false });
  }

  const user = await prisma.user.findUnique({
    where: { username: norm },
    select: { id: true, username: true, displayName: true, name: true },
  });

  if (!user || user.id === session.user.id) {
    return NextResponse.json({ found: false });
  }

  return NextResponse.json({
    found: true,
    id: user.id,
    username: user.username,
    displayName: publicDisplayName(user.displayName, user.name),
  });
}
