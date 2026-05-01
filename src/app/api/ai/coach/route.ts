import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prompt } = await request.json();
  if (!prompt) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "GROQ_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        temperature: 0.6,
        messages: [
          {
            role: "system",
            content:
              "You are an expert habit coach. Give concise, practical, motivating advice with clear next actions.",
          },
          { role: "user", content: String(prompt) },
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

    return NextResponse.json({ response: content });
  } catch {
    return NextResponse.json({ error: "AI coach unavailable right now" }, { status: 500 });
  }
}
