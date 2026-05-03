import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { endOfDay, startOfDay } from "date-fns";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const priorityEnum = z.enum(["low", "medium", "high", "urgent"]);
const statusEnum = z.enum(["todo", "inprogress", "done"]);

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: priorityEnum.optional(),
  status: statusEnum.optional(),
  projectId: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  estimatedMins: z.number().int().min(0).max(24 * 60).optional().nullable(),
});

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const status = searchParams.get("status");
  const dateStr = searchParams.get("date");

  const and: Prisma.TaskWhereInput[] = [{ userId: session.user.id }];

  if (projectId) and.push({ projectId });
  if (status && ["todo", "inprogress", "done"].includes(status)) {
    and.push({ status });
  }

  if (dateStr) {
    const d = new Date(dateStr + "T12:00:00");
    if (!Number.isNaN(d.getTime())) {
      const dayStart = startOfDay(d);
      const dayEnd = endOfDay(d);
      and.push({
        OR: [
          { dueDate: { gte: dayStart, lte: dayEnd } },
          { completedAt: { gte: dayStart, lte: dayEnd } },
        ],
      });
    }
  }

  const tasks = await prisma.task.findMany({
    where: { AND: and },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    include: {
      project: { select: { id: true, name: true, color: true, icon: true } },
    },
  });

  return NextResponse.json(tasks);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;
  if (data.projectId) {
    const proj = await prisma.project.findFirst({
      where: { id: data.projectId, userId: session.user.id },
    });
    if (!proj) return NextResponse.json({ error: "Invalid project" }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      userId: session.user.id,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      priority: data.priority ?? "medium",
      status: data.status ?? "todo",
      projectId: data.projectId ?? null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      estimatedMins: data.estimatedMins ?? null,
      completedAt: data.status === "done" ? new Date() : null,
    },
    include: {
      project: { select: { id: true, name: true, color: true, icon: true } },
    },
  });

  return NextResponse.json(task, { status: 201 });
}
