import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { FEATURE_SHOP_AND_BADGES } from "@/lib/feature-gamification";
import { refreshUserLevelFromXp } from "@/lib/gamification/award-badge";
import { evaluateBadgesAfterTaskDone } from "@/lib/gamification/evaluate-badges";
import { syncUserDailyChallenges } from "@/lib/gamification/sync-daily-challenges";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  status: z.enum(["todo", "inprogress", "done"]).optional(),
  projectId: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  estimatedMins: z.number().int().min(0).max(24 * 60).optional().nullable(),
  actualMins: z.number().int().min(0).optional().nullable(),
  pomodoroCount: z.number().int().min(0).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.task.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, projectId: true, status: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = parsed.data;
  if (data.projectId) {
    const proj = await prisma.project.findFirst({
      where: { id: data.projectId, userId: session.user.id },
      select: { id: true },
    });
    if (!proj) return NextResponse.json({ error: "Invalid project" }, { status: 400 });
  }

  let completedAt: Date | null | undefined;
  if (data.status !== undefined) {
    completedAt = data.status === "done" ? new Date() : null;
  }

  const nextProjectId = data.projectId !== undefined ? data.projectId : existing.projectId;

  const becameDone = data.status === "done" && existing.status !== "done";

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.status !== undefined
        ? { status: data.status, completedAt: completedAt! }
        : {}),
      ...(data.projectId !== undefined ? { projectId: data.projectId } : {}),
      ...(data.estimatedMins !== undefined ? { estimatedMins: data.estimatedMins } : {}),
      ...(data.actualMins !== undefined ? { actualMins: data.actualMins } : {}),
      ...(data.pomodoroCount !== undefined ? { pomodoroCount: data.pomodoroCount } : {}),
      ...(data.dueDate !== undefined
        ? { dueDate: data.dueDate ? new Date(data.dueDate) : null }
        : {}),
    },
    ...(nextProjectId
      ? {
          include: {
            project: { select: { id: true, name: true, color: true, icon: true } },
          },
        }
      : {}),
  });

  let gamification: { newBadges: { code: string; title: string; description: string }[]; xp: number; coinsEarned: number; level: number } | undefined;

  if (becameDone) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        xp: { increment: 15 },
        ...(FEATURE_SHOP_AND_BADGES ? { coins: { increment: 10 } } : {}),
      },
      select: { id: true },
    });
    await refreshUserLevelFromXp(session.user.id);
    const newBadges = await evaluateBadgesAfterTaskDone(session.user.id);
    await syncUserDailyChallenges(session.user.id).catch(() => undefined);
    const u = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { xp: true, level: true },
    });
    gamification = {
      newBadges,
      xp: u?.xp ?? 0,
      coinsEarned: FEATURE_SHOP_AND_BADGES ? 10 : 0,
      level: u?.level ?? 1,
    };
  }

  return NextResponse.json(gamification ? { ...task, gamification } : task);
}

export async function DELETE(_: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.task.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.task.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
