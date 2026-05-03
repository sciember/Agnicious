import { LifeArea } from "@prisma/client";

export type OnboardingGoalKey = "HEALTH" | "PRODUCTIVITY" | "LEARNING" | "MINDFULNESS" | "CUSTOM";

export type SuggestedHabit = {
  title: string;
  emoji: string;
  accent: string;
  lifeArea: LifeArea;
};

const SUGGESTIONS: Record<Exclude<OnboardingGoalKey, "CUSTOM">, SuggestedHabit[]> = {
  HEALTH: [
    { title: "Morning stretch", emoji: "🧘", accent: "#10b981", lifeArea: LifeArea.HEALTH },
    { title: "Walk 20 minutes", emoji: "🚶", accent: "#3b82f6", lifeArea: LifeArea.HEALTH },
    { title: "Drink 8 glasses of water", emoji: "💧", accent: "#06b6d4", lifeArea: LifeArea.HEALTH },
    { title: "Sleep by 11pm", emoji: "💤", accent: "#8b5cf6", lifeArea: LifeArea.HEALTH },
  ],
  PRODUCTIVITY: [
    { title: "Plan top 3 tasks", emoji: "📋", accent: "#6366f1", lifeArea: LifeArea.CAREER },
    { title: "Inbox zero (15 min)", emoji: "📧", accent: "#f59e0b", lifeArea: LifeArea.CAREER },
    { title: "Deep work block", emoji: "🎯", accent: "#ef4444", lifeArea: LifeArea.CAREER },
    { title: "Review tomorrow", emoji: "🗓️", accent: "#14b8a6", lifeArea: LifeArea.CAREER },
  ],
  LEARNING: [
    { title: "Read 20 minutes", emoji: "📚", accent: "#6366f1", lifeArea: LifeArea.MIND },
    { title: "Practice a skill", emoji: "✨", accent: "#a855f7", lifeArea: LifeArea.MIND },
    { title: "Watch one lesson", emoji: "🎓", accent: "#0ea5e9", lifeArea: LifeArea.MIND },
    { title: "Journal takeaways", emoji: "📝", accent: "#10b981", lifeArea: LifeArea.MIND },
  ],
  MINDFULNESS: [
    { title: "5-minute breathing", emoji: "🌬️", accent: "#14b8a6", lifeArea: LifeArea.MIND },
    { title: "Gratitude note", emoji: "🙏", accent: "#f59e0b", lifeArea: LifeArea.MIND },
    { title: "Digital sunset", emoji: "🌅", accent: "#ec4899", lifeArea: LifeArea.MIND },
    { title: "Evening reflection", emoji: "🌙", accent: "#6366f1", lifeArea: LifeArea.MIND },
  ],
};

export function suggestionsForGoal(goal: OnboardingGoalKey, customLabel?: string): SuggestedHabit[] {
  if (goal === "CUSTOM") {
    const label = customLabel?.trim() || "your goal";
    return [
      { title: `Daily step toward: ${label}`, emoji: "🎯", accent: "#6366f1", lifeArea: LifeArea.MIND },
      { title: "10 minutes of focus", emoji: "⏱️", accent: "#10b981", lifeArea: LifeArea.CAREER },
      { title: "One healthy choice", emoji: "🌱", accent: "#22c55e", lifeArea: LifeArea.HEALTH },
      { title: "Wind-down ritual", emoji: "✨", accent: "#a78bfa", lifeArea: LifeArea.MIND },
    ];
  }
  return SUGGESTIONS[goal];
}

export function encodeStoredGoal(goal: OnboardingGoalKey, customLabel?: string): string {
  if (goal === "CUSTOM" && customLabel?.trim()) {
    return `CUSTOM:${customLabel.trim().slice(0, 80)}`;
  }
  return goal;
}

/** Decode `User.onboardingGoal` DB string into goal key + optional custom label. */
export function parseStoredOnboardingGoal(
  stored: string | null | undefined,
): { goal: OnboardingGoalKey; customLabel?: string } {
  if (!stored?.trim()) return { goal: "HEALTH" };
  const t = stored.trim();
  if (t.startsWith("CUSTOM:")) {
    return { goal: "CUSTOM", customLabel: t.slice(7).trim() || undefined };
  }
  const upper = t.toUpperCase();
  if (upper === "HEALTH" || upper === "PRODUCTIVITY" || upper === "LEARNING" || upper === "MINDFULNESS") {
    return { goal: upper as OnboardingGoalKey };
  }
  return { goal: "HEALTH" };
}
