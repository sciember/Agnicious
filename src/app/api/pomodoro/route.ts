import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const postSchema = z.object({
  taskId: z.string().optional().nullable(),
  duration: z.number().int().min(1).max(180),
  completed: z.boolean().optional(),
  startedAt: z.string().datetime().optional(),
});

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const sessions = await prisma.pomodoroSession.findMany({
    where: {
      userId: session.user.id,
      startedAt: {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(to) : undefined,
      },
    },
    orderBy: { startedAt: "desc" },
    take: 200,
    include: {
      task: { select: { id: true, title: true } },
    },
  });

  return NextResponse.json(sessions);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { taskId, duration, completed, startedAt } = parsed.data;

  if (taskId) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, userId: session.user.id },
    });
    if (!task) return NextResponse.json({ error: "Invalid task" }, { status: 400 });
  }

  const sessionRow = await prisma.pomodoroSession.create({
    data: {
      userId: session.user.id,
      taskId: taskId ?? null,
      duration,
      completed: completed ?? true,
      startedAt: startedAt ? new Date(startedAt) : new Date(),
    },
    include: {
      task: { select: { id: true, title: true } },
    },
  });

  if (taskId && (completed ?? true)) {
    const t = await prisma.task.findFirst({
      where: { id: taskId, userId: session.user.id },
      select: { actualMins: true },
    });
    await prisma.task.update({
      where: { id: taskId },
      data: {
        pomodoroCount: { increment: 1 },
        actualMins: (t?.actualMins ?? 0) + duration,
      },
    });
  }

  return NextResponse.json(sessionRow, { status: 201 });
}
