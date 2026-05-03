import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { maskEmail } from "@/lib/user-public";
import { normalizeUsername, validateUsernameFormat } from "@/lib/username";

function normalizeDisplayName(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 40);
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    displayName?: string;
    bio?: string | null;
    username?: string;
  };

  const data: {
    displayName?: string;
    bio?: string | null;
    username?: string | null;
  } = {};

  if (body.displayName !== undefined) {
    const displayName = normalizeDisplayName(body.displayName);
    if (displayName.length < 2) {
      return NextResponse.json({ error: "Display name must be at least 2 characters." }, { status: 400 });
    }
    data.displayName = displayName;
  }

  if (body.bio !== undefined) {
    data.bio = body.bio == null ? null : String(body.bio).slice(0, 140);
  }

  if (body.username !== undefined) {
    const norm = normalizeUsername(body.username);
    if (!norm) {
      return NextResponse.json({ error: "Username is required." }, { status: 400 });
    }
    const format = validateUsernameFormat(norm);
    if (!format.ok) {
      return NextResponse.json({ error: format.error }, { status: 400 });
    }
    const taken = await prisma.user.findUnique({
      where: { username: norm },
      select: { id: true },
    });
    if (taken && taken.id !== session.user.id) {
      return NextResponse.json({ error: "Username is already taken." }, { status: 400 });
    }
    data.username = norm;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: {
      name: true,
      displayName: true,
      username: true,
      bio: true,
      avatarUrl: true,
      image: true,
      email: true,
    },
  });

  const { email, ...rest } = user;
  return NextResponse.json({
    ...rest,
    emailMasked: maskEmail(email),
  });
}
