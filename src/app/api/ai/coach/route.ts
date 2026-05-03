import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { buildAnalyticsOverview } from "@/lib/analytics-overview";

function buildSystemPrompt(ctx: Awaited<ReturnType<typeof buildAnalyticsOverview>>) {
  const h = ctx.habits;
  const t = ctx.tasks;
  const p = ctx.pomodoro;
  const pr = ctx.productivity;
  const perHabit = h.perHabit
    .map((x) => `${x.title}: ${x.completionRate}% (${x.doneCount} logs in window)`)
    .join("; ");

  return `You are an elite personal productivity coach and life analyst — like a combination of a therapist, data analyst, and habit expert.

You have FULL ACCESS to the user's live data:

HABITS DATA:
- Total habits: ${h.total}
- Completed today: ${h.completedToday}
- Current streak: ${h.currentStreak} (max across habits)
- This week completion rate: ${h.weeklyRate}%
- Per habit breakdown: ${perHabit || "none"}

TASKS DATA:
- Tasks in today view: ${t.totalToday}
- Tasks completed today: ${t.completedToday}
- Completion rate: ${t.completionRate}%
- Overdue tasks: ${t.overdue}
- By priority: low ${t.byPriority.low}, medium ${t.byPriority.medium}, high ${t.byPriority.high}, urgent ${t.byPriority.urgent}

FOCUS / POMODORO DATA:
- Pomodoro sessions today: ${p.todaySessions}
- Total focus time today: ${p.totalMinutesToday} minutes
- This week focus time: ${p.weeklyMinutes} minutes

PRODUCTIVITY SCORE: ${pr.score}/100
TREND: ${pr.trend}
BEST PRODUCTIVE DAY: ${pr.bestDay}
BEST PRODUCTIVE HOUR: ${pr.bestHour}

FORMATTING RULES (follow strictly):
- Use **bold** for key insights and action items
- Use numbered lists for steps
- Use bullet points for options
- Keep responses scannable — short paragraphs
- Always end with **Your next step:** (one clear action)
- Be warm, direct, and data-driven
- Reference the user's ACTUAL data in every response
- When asked for analysis, give detailed breakdown with patterns you notice
- Use emojis sparingly (max 2 per response)`;
}

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
  const systemContent = buildSystemPrompt(overview);

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

    return NextResponse.json({ response: content, contextScore: overview.productivity.score });
  } catch {
    return NextResponse.json({ error: "AI coach unavailable right now" }, { status: 500 });
  }
}
