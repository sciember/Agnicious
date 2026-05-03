import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { buildCoachSystemPrompt } from "@/lib/ai/coach-system-prompt";
import { buildAnalyticsOverview } from "@/lib/analytics-overview";
import { BADGE_BY_CODE } from "@/lib/gamification/badges";
import { tryAwardBadge } from "@/lib/gamification/award-badge";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const prompt = body?.prompt as string | undefined;
  const detailReport = Boolean(body?.detailReport);

  if (!prompt) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "GROQ_API_KEY is not configured" }, { status: 500 });
  }

  const overview = await buildAnalyticsOverview(session.user.id);
  const systemContent = buildCoachSystemPrompt(overview);

  const userContent =
    detailReport || /weekly report|full report|analyze my productivity/i.test(prompt)
      ? `${prompt}\n\nProduce a multi-section response with: What went well; What needs improvement; Patterns you notice; Three actionable recommendations for tomorrow. Use headings or bold labels for each section.`
      : prompt;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        temperature: 0.55,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const errorPayload = await response.text();
      return NextResponse.json(
        { error: "Groq request failed", details: errorPayload },
        { status: 502 },
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content =
      data.choices?.[0]?.message?.content ??
      "Focus on one keystone habit daily and track it right after completion.";

    await prisma.user.update({
      where: { id: session.user.id },
      data: { aiCoachTurns: { increment: 1 } },
    });
    const turns = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { aiCoachTurns: true },
    });
    let newBadge: { code: string; title: string; description: string } | null = null;
    if ((turns?.aiCoachTurns ?? 0) >= 10) {
      const def = BADGE_BY_CODE["AI_CURIOUS"];
      if (def) {
        newBadge = await tryAwardBadge(session.user.id, def.code, def.title, def.description, def.xpReward);
      }
    }

    return NextResponse.json({
      response: content,
      contextScore: overview.productivity.score,
      newBadge,
    });
  } catch {
    return NextResponse.json({ error: "AI coach unavailable right now" }, { status: 500 });
  }
}
