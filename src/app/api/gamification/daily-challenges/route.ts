import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { syncUserDailyChallenges } from "@/lib/gamification/sync-daily-challenges";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const challenges = await syncUserDailyChallenges(session.user.id);
  return NextResponse.json({ challenges });
}
