import { HabitStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const habitId = searchParams.get("habitId");
  if (!habitId) return NextResponse.json({ error: "habitId required" }, { status: 400 });

  const logs = await prisma.habitLog.findMany({
    where: { userId: session.user.id, habitId },
    orderBy: { date: "desc" },
    take: 30,
  });
  if (!logs.length) return NextResponse.json({ breakProbability: 0.2, confidence: "low" });

  const done = logs.filter((l) => l.status === HabitStatus.DONE).length;
  const fail = logs.filter((l) => l.status === HabitStatus.FAIL).length;
  const skip = logs.filter((l) => l.status === HabitStatus.SKIP).length;
  const consistency = done / logs.length;
  const breakProbability = Math.min(0.95, Math.max(0.05, 1 - consistency + fail * 0.03 + skip * 0.02));

  return NextResponse.json({
    breakProbability: Number(breakProbability.toFixed(2)),
    confidence: logs.length > 20 ? "high" : logs.length > 10 ? "medium" : "low",
  });
}
