import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { endOfDay, startOfDay } from "date-fns";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const tasks = await prisma.task.findMany({
    where: {
      userId: session.user.id,
      OR: [
        { dueDate: { gte: todayStart, lte: todayEnd } },
        { completedAt: { gte: todayStart, lte: todayEnd } },
      ],
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    include: {
      project: { select: { id: true, name: true, color: true, icon: true } },
    },
  });

  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "done").length;
  const completionRate = total <= 0 ? 0 : Math.round((completed / total) * 100);

  return NextResponse.json({
    tasks,
    stats: {
      total,
      completed,
      completionRate,
      todo: tasks.filter((t) => t.status === "todo").length,
      inprogress: tasks.filter((t) => t.status === "inprogress").length,
      done: completed,
    },
  });
}
