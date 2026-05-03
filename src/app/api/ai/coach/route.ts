import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { FEATURE_SHOP_AND_BADGES } from "@/lib/feature-gamification";
import { buildCoachSystemPrompt } from "@/lib/ai/coach-system-prompt";
import { buildAnalyticsOverview } from "@/lib/analytics-overview";
import { BADGE_BY_CODE } from "@/lib/gamification/badges";
import { tryAwardBadge } from "@/lib/gamification/award-badge";
import { prisma } from "@/lib/prisma";

/** Vercel + Next: keep handler on Node (Prisma + Groq both expect this). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

function resolveGroqApiKey(): string | null {
  const raw = process.env.GROQ_API_KEY ?? process.env.GROQ_KEY ?? "";
  const key = raw.trim();
  return key.length > 0 ? key : null;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const prompt = body?.prompt as string | undefined;
  const detailReport = Boolean(body?.detailReport);

  if (!prompt) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });

  const apiKey = resolveGroqApiKey();
  if (!apiKey) {
    const hasRawGroq = Boolean(process.env.GROQ_API_KEY?.length || process.env.GROQ_KEY?.length);
    console.error(
      "[api/ai/coach] Missing usable Groq API key (after trim). GROQ_API_KEY set:",
      Boolean(process.env.GROQ_API_KEY?.trim()),
      "GROQ_KEY set:",
      Boolean(process.env.GROQ_KEY?.trim()),
      "raw length (may be whitespace only):",
      hasRawGroq,
    );
    return NextResponse.json(
      {
        code: "GROQ_KEY_MISSING",
        error: "AI Coach needs GROQ_API_KEY configured in environment variables",
      },
      { status: 503 },
    );
  }

  const overview = await buildAnalyticsOverview(session.user.id);
  const systemContent = buildCoachSystemPrompt(overview);

  const userContent =
    detailReport || /weekly report|full report|analyze my productivity/i.test(prompt)
      ? `${prompt}\n\nProduce a multi-section response with: What went well; What needs improvement; Patterns you notice; Three actionable recommendations for tomorrow. Use headings or bold labels for each section.`
      : prompt;

  try {
    const response = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.55,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const errorPayload = await response.text();
      console.error("[api/ai/coach] Groq HTTP error:", response.status, errorPayload);
      return NextResponse.json(
        {
          error: "Groq request failed",
          details: `${response.status}: ${errorPayload.slice(0, 500)}`,
        },
        { status: 502 },
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content =
      data.choices?.[0]?.message?.content ??
      "Focus on one keystone habit daily and track it right after completion.";

    let newBadge: { code: string; title: string; description: string } | null = null;
    if (FEATURE_SHOP_AND_BADGES) {
      const afterTurn = await prisma.user.update({
        where: { id: session.user.id },
        data: { aiCoachTurns: { increment: 1 } },
        select: { aiCoachTurns: true },
      });
      if (afterTurn.aiCoachTurns >= 10) {
        const def = BADGE_BY_CODE["AI_CURIOUS"];
        if (def) {
          newBadge = await tryAwardBadge(session.user.id, def.code, def.title, def.description, def.xpReward);
        }
      }
    }

    return NextResponse.json({
      response: content,
      contextScore: overview.productivity.score,
      newBadge,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/ai/coach] Groq or handler error:", err);
    return NextResponse.json(
      {
        error: "AI coach request failed",
        details: message,
      },
      { status: 500 },
    );
  }
}
