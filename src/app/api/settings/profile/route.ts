import { WeekStart } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { maskEmail } from "@/lib/user-public";

function normalizeDisplayName(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 40);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      image: true,
      timezone: true,
      weekStartsOn: true,
      email: true,
    },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { email, ...rest } = user;
  return NextResponse.json({
    ...rest,
    emailMasked: maskEmail(email),
  });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    displayName?: string;
    bio?: string | null;
    timezone?: string;
    weekStartsOn?: "MONDAY" | "SUNDAY";
  };

  const data: {
    displayName?: string;
    bio?: string | null;
    timezone?: string;
    weekStartsOn?: WeekStart;
  } = {};

  if (body.displayName !== undefined) {
    const displayName = normalizeDisplayName(body.displayName);
    if (displayName.length < 2) {
      return NextResponse.json({ error: "Display name must be at least 2 characters." }, { status: 400 });
    }
    data.displayName = displayName;
  }

  if (body.bio !== undefined) {
    const bio = body.bio == null ? null : String(body.bio).slice(0, 140);
    data.bio = bio;
  }

  if (body.timezone !== undefined) {
    const tz = String(body.timezone).trim().slice(0, 64);
    if (!tz) return NextResponse.json({ error: "Invalid timezone." }, { status: 400 });
    data.timezone = tz;
  }

  if (body.weekStartsOn !== undefined) {
    if (body.weekStartsOn !== "MONDAY" && body.weekStartsOn !== "SUNDAY") {
      return NextResponse.json({ error: "weekStartsOn must be MONDAY or SUNDAY." }, { status: 400 });
    }
    data.weekStartsOn = body.weekStartsOn === "MONDAY" ? WeekStart.MONDAY : WeekStart.SUNDAY;
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
      bio: true,
      avatarUrl: true,
      image: true,
      timezone: true,
      weekStartsOn: true,
      email: true,
    },
  });

  const { email, ...rest } = user;
  return NextResponse.json({
    ...rest,
    emailMasked: maskEmail(email),
  });
}
