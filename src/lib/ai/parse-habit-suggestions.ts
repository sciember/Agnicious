import { LifeArea } from "@prisma/client";
import { z } from "zod";

const itemSchema = z.object({
  title: z.string().min(2).max(100),
  lifeArea: z.enum(["HEALTH", "CAREER", "MIND"]),
  emoji: z.string().min(1).max(12).default("✨"),
  accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#6366f1"),
});

export type SuggestedHabitRow = {
  title: string;
  lifeArea: LifeArea;
  emoji: string;
  accent: string;
};

/** Parse Groq output into validated habit rows (max `limit`). */
export function parseHabitSuggestionsFromModel(raw: string, limit = 8): SuggestedHabitRow[] {
  let t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (fence) t = fence[1].trim();

  try {
    const parsed = JSON.parse(t) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: SuggestedHabitRow[] = [];
    for (const row of parsed) {
      const r = itemSchema.safeParse(row);
      if (!r.success) continue;
      out.push({ ...r.data, lifeArea: r.data.lifeArea as LifeArea });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}
