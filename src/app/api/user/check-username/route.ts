import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeUsername, validateUsernameFormat } from "@/lib/username";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("u") ?? "";
  const norm = normalizeUsername(raw);
  const format = validateUsernameFormat(norm);
  if (!format.ok) {
    return NextResponse.json({ available: false });
  }

  const session = await getServerSession(authOptions);
  const existing = await prisma.user.findUnique({
    where: { username: norm },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ available: true });
  }
  if (session?.user?.id && existing.id === session.user.id) {
    return NextResponse.json({ available: true });
  }
  return NextResponse.json({ available: false });
}
