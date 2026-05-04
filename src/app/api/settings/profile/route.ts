import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { maskEmail } from "@/lib/user-public";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email = session.user.email.trim().toLowerCase();
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        ...(session.user.name ? { name: session.user.name } : {}),
        ...(session.user.image ? { image: session.user.image } : {}),
      },
      create: {
        email,
        name: session.user.name ?? null,
        image: session.user.image ?? null,
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
        onboardingGoal: true,
      },
    });

    const { email: userEmail, ...rest } = user;
    return NextResponse.json({
      ...rest,
      emailMasked: maskEmail(userEmail),
    });
  } catch (error) {
    console.error("[api/settings/profile][GET]", error);
    // Never crash settings page for recoverable profile bootstrap issues.
    return NextResponse.json(
      {
        name: null,
        displayName: null,
        username: null,
        bio: null,
        avatarUrl: null,
        image: null,
        onboardingGoal: null,
        emailMasked: "—",
      },
      { status: 200 },
    );
  }
}
