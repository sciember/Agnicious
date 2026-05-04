import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAuthUser } from "@/lib/server-auth-user";
import { habitSchema } from "@/lib/validations/habit";

export async function GET() {
  const authUser = await resolveAuthUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const habits = await prisma.habit.findMany({
    where: { userId: authUser.id, isArchived: false },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(habits);
}

export async function POST(request: Request) {
  const authUser = await resolveAuthUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = habitSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const habit = await prisma.habit.create({
    data: {
      ...parsed.data,
      userId: authUser.id,
    },
  });
  await prisma.streak.create({
    data: { userId: authUser.id, habitId: habit.id },
  });
  return NextResponse.json(habit, { status: 201 });
}
