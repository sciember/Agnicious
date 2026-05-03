import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { maskEmail } from "@/lib/user-public";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
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
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { email, ...rest } = user;
  return NextResponse.json({
    ...rest,
    emailMasked: maskEmail(email),
  });
}
