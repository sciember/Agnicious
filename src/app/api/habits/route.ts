import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { habitSchema } from "@/lib/validations/habit";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const habits = await prisma.habit.findMany({
    where: { userId: session.user.id, isArchived: false },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(habits);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = habitSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const habit = await prisma.habit.create({
    data: {
      ...parsed.data,
      userId: session.user.id,
    },
  });
  await prisma.streak.create({
    data: { userId: session.user.id, habitId: habit.id },
  });
  return NextResponse.json(habit, { status: 201 });
}
