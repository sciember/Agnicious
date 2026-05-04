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
    let user = session.user.id
      ? await prisma.user.findUnique({
          where: { id: session.user.id },
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
        })
      : null;

    if (!user) {
      await prisma.$queryRaw`
        INSERT INTO "User" ("id", "email", "name", "image", "createdAt", "updatedAt")
        VALUES (${crypto.randomUUID()}, ${email}, ${session.user.name ?? null}, ${session.user.image ?? null}, NOW(), NOW())
        ON CONFLICT ("email")
        DO UPDATE SET "updatedAt" = NOW()
      `;
      user = await prisma.user.findUnique({
        where: { email },
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
    }
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

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
