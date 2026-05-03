import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { buildCoachSystemPrompt } from "@/lib/ai/coach-system-prompt";
import { parseGamePlanPoints } from "@/lib/ai/parse-game-plan";
import { buildAnalyticsOverview } from "@/lib/analytics-overview";

const GAME_PLAN_SUFFIX = `

SPECIAL OUTPUT MODE (mandatory):
Respond with ONLY a valid JSON array of exactly 3 strings. No markdown fences, no keys, no commentary before or after the array.
Each string is ONE concrete action for TODAY (max 140 characters), personalized using the user's data above.
Example format: ["First action","Second action","Third action"]`;

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "GROQ_API_KEY is not configured" }, { status: 500 });
  }

  const overview = await buildAnalyticsOverview(session.user.id);
  const systemContent = buildCoachSystemPrompt(overview) + GAME_PLAN_SUFFIX;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        temperature: 0.45,
        max_tokens: 400,
        messages: [
          { role: "system", content: systemContent },
          {
            role: "user",
            content:
              "Generate today's 3-point game plan now. Output only the JSON array as specified.",
          },
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
    const raw = data.choices?.[0]?.message?.content ?? "";
    const points = parseGamePlanPoints(raw);

    return NextResponse.json({ points });
  } catch {
    return NextResponse.json({ error: "AI game plan unavailable right now" }, { status: 500 });
  }
}
