export type HabitUiMeta = {
  emoji: string;
  accent: string;
  note?: string;
};

const defaults: HabitUiMeta = { emoji: "✨", accent: "#6366f1" };

export function parseHabitUiMeta(description: string | null | undefined): HabitUiMeta {
  if (!description?.trim()) return { ...defaults };
  try {
    const j = JSON.parse(description) as Record<string, unknown>;
    if (j && typeof j === "object" && ("e" in j || "emoji" in j)) {
      return {
        emoji: String(j.e ?? j.emoji ?? defaults.emoji),
        accent: String(j.c ?? j.accent ?? defaults.accent),
        note: typeof j.n === "string" ? j.n : typeof j.note === "string" ? j.note : undefined,
      };
    }
  } catch {
    // Plain-text legacy descriptions are treated as notes only.
  }
  return { ...defaults, note: description };
}

export function serializeHabitUiMeta(meta: HabitUiMeta): string | undefined {
  const payload = {
    e: meta.emoji,
    c: meta.accent,
    ...(meta.note?.trim() ? { n: meta.note.trim() } : {}),
  };
  const s = JSON.stringify(payload);
  return s.length > 500 ? JSON.stringify({ e: meta.emoji, c: meta.accent }) : s;
}
