import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.GROQ_API_KEY) return NextResponse.json({ error: "GROQ_API_KEY missing" }, { status: 500 });

  const { habitId } = (await request.json()) as { habitId?: string };
  if (!habitId) return NextResponse.json({ error: "habitId required" }, { status: 400 });

  const [habit, recentLogs] = await Promise.all([
    prisma.habit.findFirst({ where: { id: habitId, userId: session.user.id } }),
    prisma.habitLog.findMany({
      where: { habitId, userId: session.user.id },
      orderBy: { date: "desc" },
      take: 20,
    }),
  ]);
  if (!habit) return NextResponse.json({ error: "Habit not found" }, { status: 404 });

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "Analyze habit failures and provide concise practical suggestions. Use bullet-like short advice.",
        },
        {
          role: "user",
          content: `Habit: ${habit.title}\nRecent logs: ${JSON.stringify(
            recentLogs.map((l) => ({ date: l.date, status: l.status, note: l.note })),
          )}`,
        },
      ],
    }),
  });

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return NextResponse.json({
    analysis:
      payload.choices?.[0]?.message?.content ??
      "Track trigger moments, reduce friction, and time-block a smaller version of this habit.",
  });
}
