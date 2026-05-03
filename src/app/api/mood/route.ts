import { endOfDay, format, startOfDay } from "date-fns";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { evaluateBadgesAfterMoodLog } from "@/lib/gamification/evaluate-badges";
import { syncUserDailyChallenges } from "@/lib/gamification/sync-daily-challenges";
import { prisma } from "@/lib/prisma";
import { moodLogSchema } from "@/lib/validations/mood";

const MAX_RANGE_DAYS = 400;

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  if (fromParam && toParam) {
    const rangeFrom = startOfDay(new Date(fromParam));
    const rangeTo = endOfDay(new Date(toParam));
    if (Number.isNaN(rangeFrom.getTime()) || Number.isNaN(rangeTo.getTime())) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }
    if (rangeTo.getTime() < rangeFrom.getTime()) {
      return NextResponse.json({ error: "Invalid range" }, { status: 400 });
    }
    const spanDays = (rangeTo.getTime() - rangeFrom.getTime()) / 86_400_000;
    if (spanDays > MAX_RANGE_DAYS) {
      return NextResponse.json({ error: "Range too large" }, { status: 400 });
    }

    const rows = await prisma.moodLog.findMany({
      where: {
        userId: session.user.id,
        loggedAt: { gte: rangeFrom, lte: rangeTo },
      },
      select: { moodScore: true, loggedAt: true },
    });

    const byDayMap = new Map<string, number[]>();
    for (const row of rows) {
      const k = format(startOfDay(row.loggedAt), "yyyy-MM-dd");
      if (!byDayMap.has(k)) byDayMap.set(k, []);
      byDayMap.get(k)!.push(row.moodScore);
    }

    const byDay: Record<string, number> = {};
    for (const [k, scores] of byDayMap) {
      byDay[k] = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
    }

    return NextResponse.json({ byDay });
  }

  const d = new Date();
  const dayStart = startOfDay(d);
  const dayEnd = endOfDay(d);
  const todayLog = await prisma.moodLog.findFirst({
    where: {
      userId: session.user.id,
      loggedAt: { gte: dayStart, lte: dayEnd },
    },
    orderBy: { loggedAt: "desc" },
    select: { id: true, moodScore: true, note: true, loggedAt: true },
  });
  return NextResponse.json({ todayLog });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = moodLogSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const log = await prisma.moodLog.create({
    data: {
      userId: session.user.id,
      moodScore: parsed.data.moodScore,
      note: parsed.data.note,
    },
    select: { id: true, moodScore: true, note: true, loggedAt: true },
  });

  const newBadges = await evaluateBadgesAfterMoodLog(session.user.id);
  await syncUserDailyChallenges(session.user.id).catch(() => undefined);

  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { level: true },
  });

  return NextResponse.json({
    ...log,
    gamification: {
      newBadges,
      level: u?.level ?? 1,
    },
  });
}
