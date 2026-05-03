import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { buildAnalyticsOverview } from "@/lib/analytics-overview";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const overview = await buildAnalyticsOverview(session.user.id);
  return NextResponse.json(overview);
}
