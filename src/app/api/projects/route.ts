import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveAuthUser } from "@/lib/server-auth-user";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  color: z.string().max(32).optional(),
  icon: z.string().max(8).optional(),
});

export async function GET() {
  const authUser = await resolveAuthUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await prisma.project.findMany({
    where: { userId: authUser.id },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { tasks: true } },
    },
  });

  return NextResponse.json(
    projects.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.name,
      color: p.color,
      icon: p.icon,
      createdAt: p.createdAt,
      taskCount: p._count.tasks,
    })),
  );
}

export async function POST(request: Request) {
  const authUser = await resolveAuthUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const project = await prisma.project.create({
    data: {
      userId: authUser.id,
      name: parsed.data.name.trim(),
      color: parsed.data.color ?? "#6366f1",
      icon: parsed.data.icon ?? "📁",
    },
  });

  return NextResponse.json(project, { status: 201 });
}
