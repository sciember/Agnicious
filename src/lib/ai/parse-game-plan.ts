const FALLBACK = [
  "Complete one keystone habit before noon and log it.",
  "Pick your top 3 tasks — finish the smallest one first for momentum.",
  "Take a 5-minute walk or stretch between focus blocks.",
] as const;

/** Parse model output into exactly 3 short action strings. */
export function parseGamePlanPoints(raw: string): string[] {
  let t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (fence) t = fence[1].trim();

  try {
    const arr = JSON.parse(t) as unknown;
    if (Array.isArray(arr)) {
      const out = arr
        .slice(0, 5)
        .map((x) => String(x).replace(/\*\*/g, "").trim())
        .filter((s) => s.length > 0)
        .slice(0, 3);
      if (out.length >= 3) return out.slice(0, 3);
      if (out.length > 0) return [...out, ...FALLBACK].slice(0, 3);
    }
  } catch {
    /* fall through */
  }

  const lines = t
    .split(/\n+/)
    .map((l) =>
      l
        .replace(/^\s*[\d]+[\).\s]+/, "")
        .replace(/^[-*•]\s*/, "")
        .replace(/\*\*/g, "")
        .trim(),
    )
    .filter((l) => l.length > 4 && !l.startsWith("["));
  if (lines.length >= 3) return lines.slice(0, 3);

  return [...FALLBACK];
}
