import { LifeArea } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { parseHabitSuggestionsFromModel } from "@/lib/ai/parse-habit-suggestions";
import {
  parseStoredOnboardingGoal,
  suggestionsForGoal,
  type OnboardingGoalKey,
  type SuggestedHabit,
} from "@/lib/onboarding";
import { prisma } from "@/lib/prisma";

const EXTRAS: SuggestedHabit[] = [
  { title: "Hydrate after waking", emoji: "💧", accent: "#0ea5e9", lifeArea: LifeArea.HEALTH },
  { title: "10-minute tidy space", emoji: "🧹", accent: "#94a3b8", lifeArea: LifeArea.CAREER },
  { title: "No phone first 30 min", emoji: "📵", accent: "#64748b", lifeArea: LifeArea.MIND },
  { title: "Protein-rich breakfast", emoji: "🍳", accent: "#f97316", lifeArea: LifeArea.HEALTH },
  { title: "One deep breath before work", emoji: "🌬️", accent: "#22c55e", lifeArea: LifeArea.MIND },
  { title: "Review calendar for tomorrow", emoji: "🗓️", accent: "#6366f1", lifeArea: LifeArea.CAREER },
];

function existingTitleSet(titles: string[]) {
  return new Set(titles.map((t) => t.trim().toLowerCase()).filter(Boolean));
}

function mergeUnique(
  preferred: SuggestedHabit[],
  fallback: SuggestedHabit[],
  taken: Set<string>,
  limit: number,
): SuggestedHabit[] {
  if (limit <= 0) return [];
  const out: SuggestedHabit[] = [];
  for (const list of [preferred, fallback]) {
    for (const s of list) {
      const k = s.title.trim().toLowerCase();
      if (!k || taken.has(k)) continue;
      taken.add(k);
      out.push(s);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [user, habitRows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { onboardingGoal: true },
    }),
    prisma.habit.findMany({
      where: { userId: session.user.id, isArchived: false },
      select: { title: true },
    }),
  ]);

  const { goal, customLabel } = parseStoredOnboardingGoal(user?.onboardingGoal);
  const taken = existingTitleSet(habitRows.map((h) => h.title));

  const catalog = [...suggestionsForGoal(goal, customLabel), ...EXTRAS];
  const goalLine =
    goal === "CUSTOM"
      ? `Custom goal: ${customLabel ?? "personal focus"}`
      : `Primary goal area: ${goal}`;

  const existingList = habitRows.map((h) => h.title).join("; ") || "none yet";

  let aiItems: SuggestedHabit[] = [];

  if (process.env.GROQ_API_KEY) {
    const system = `You suggest small, realistic DAILY habits (not huge projects). Output ONLY valid JSON — no markdown, no commentary.`;

    const userMsg = `${goalLine}
Existing habit names (do not duplicate or trivially rephrase): ${existingList}

Return ONLY a JSON array of exactly 5 objects. Each object: {"title": string (max 72 chars), "lifeArea": "HEALTH"|"CAREER"|"MIND", "emoji": "single emoji", "accent": "#RRGGBB hex color"}.
Habits must fit the user's goal theme. Be specific and actionable.`;

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          temperature: 0.65,
          max_tokens: 700,
          messages: [
            { role: "system", content: system },
            { role: "user", content: userMsg },
          ],
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const raw = data.choices?.[0]?.message?.content ?? "";
        const parsed = parseHabitSuggestionsFromModel(raw, 8);
        aiItems = parsed.map((p) => ({
          title: p.title.trim(),
          emoji: p.emoji.trim().slice(0, 8),
          accent: p.accent,
          lifeArea: p.lifeArea,
        }));
      }
    } catch {
      aiItems = [];
    }
  }

  const suggestions = mergeUnique(aiItems, catalog, taken, 5);

  if (suggestions.length < 5) {
    const padTaken = existingTitleSet([...habitRows.map((h) => h.title), ...suggestions.map((s) => s.title)]);
    const more = mergeUnique(catalog, EXTRAS, padTaken, 5 - suggestions.length);
    suggestions.push(...more);
  }

  const padTaken2 = existingTitleSet([...habitRows.map((h) => h.title), ...suggestions.map((s) => s.title)]);
  let n = 1;
  while (suggestions.length < 5 && catalog.length > 0) {
    const base = catalog[(suggestions.length + n) % catalog.length]!;
    const title = `${base.title} (${n})`;
    if (!padTaken2.has(title.toLowerCase())) {
      suggestions.push({ ...base, title });
      padTaken2.add(title.toLowerCase());
    }
    n += 1;
    if (n > 40) break;
  }

  return NextResponse.json({
    suggestions: suggestions.slice(0, 5),
    goal: goal as OnboardingGoalKey,
    customLabel: goal === "CUSTOM" ? customLabel ?? null : null,
  });
}
