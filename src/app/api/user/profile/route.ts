import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { maskEmail } from "@/lib/user-public";
import { normalizeUsername, validateUsernameFormat } from "@/lib/username";

function normalizeDisplayName(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 40);
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
      const sessionUserId = session.user.id ?? null;
      if (taken && (!sessionUserId || taken.id !== sessionUserId)) {
        return NextResponse.json({ error: "Username is already taken." }, { status: 400 });
      }
      data.username = norm;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
    }

    const email = session.user.email.trim().toLowerCase();
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        ...(session.user.name ? { name: session.user.name } : {}),
        ...(session.user.image ? { image: session.user.image } : {}),
        ...data,
      },
      create: {
        email,
        name: session.user.name ?? null,
        image: session.user.image ?? null,
        ...data,
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        username: true,
        bio: true,
        avatarUrl: true,
        image: true,
        email: true,
      },
    });

    const { email: userEmail, ...rest } = user;
    return NextResponse.json({
      ...rest,
      emailMasked: maskEmail(userEmail),
    });
  } catch (error) {
    console.error("[api/user/profile][PATCH]", error);
    return NextResponse.json({ error: "Could not update profile." }, { status: 500 });
  }
}
