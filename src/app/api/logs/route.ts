import { HabitStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { habitLogSchema } from "@/lib/validations/habit";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const logs = await prisma.habitLog.findMany({
    where: {
      userId: session.user.id,
      date: {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(to) : undefined,
      },
    },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(logs);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = habitLogSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const date = new Date(parsed.data.date);
  const existing = await prisma.habitLog.findUnique({
    where: { habitId_date: { habitId: parsed.data.habitId, date } },
  });

  const log = existing
    ? await prisma.habitLog.update({
        where: { id: existing.id },
        data: { status: parsed.data.status as HabitStatus, note: parsed.data.note, completedAt: new Date() },
      })
    : await prisma.habitLog.create({
        data: {
          habitId: parsed.data.habitId,
          userId: session.user.id,
          date,
          status: parsed.data.status as HabitStatus,
          note: parsed.data.note,
          completedAt: new Date(),
        },
      });

  const doneCount = await prisma.habitLog.count({
    where: { habitId: parsed.data.habitId, userId: session.user.id, status: HabitStatus.DONE },
  });
  await prisma.streak.updateMany({
    where: { habitId: parsed.data.habitId, userId: session.user.id },
    data: {
      currentCount: parsed.data.status === "DONE" ? doneCount : 0,
      longestCount: doneCount,
    },
  });

  if (parsed.data.status === "DONE") {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { xp: { increment: 10 } },
    });
  }

  return NextResponse.json(log, { status: 201 });
}
