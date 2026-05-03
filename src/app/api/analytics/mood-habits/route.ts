import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { buildMoodHabitInsight } from "@/lib/mood-habit-insight";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days"));
  const insight = await buildMoodHabitInsight(session.user.id, Number.isFinite(days) ? days : undefined);
  return NextResponse.json(insight);
}
