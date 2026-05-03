export type BadgeDefinition = {
  code: string;
  title: string;
  description: string;
  xpReward: number;
};

/** Full badge catalog (20). Codes are stable for DB `Achievement.code`. */
export const BADGE_CATALOG: BadgeDefinition[] = [
  { code: "FIRST_HABIT", title: "First Spark", description: "Logged your very first habit completion.", xpReward: 15 },
  { code: "STREAK_7", title: "Week Warrior", description: "Seven successful habit entries on one habit.", xpReward: 25 },
  { code: "CENTURY", title: "Century Club", description: "One hundred habit completions across your journey.", xpReward: 50 },
  { code: "EARLY_BIRD", title: "Early Bird", description: "Completed habits before 8am five times.", xpReward: 30 },
  { code: "NIGHT_OWL", title: "Night Owl", description: "Completed habits after 10pm five times.", xpReward: 30 },
  { code: "SOCIAL_BUTTERFLY", title: "Social Butterfly", description: "Added five accepted friends.", xpReward: 40 },
  { code: "AI_CURIOUS", title: "AI Curious", description: "Sent ten messages to the AI coach.", xpReward: 35 },
  { code: "PERFECTIONIST", title: "Perfectionist", description: "Completed every active habit at least once in a single day.", xpReward: 45 },
  { code: "COMEBACK", title: "Comeback Kid", description: "Returned after a streak reset and logged again.", xpReward: 20 },
  { code: "SPEED_RUNNER", title: "Speed Runner", description: "Finished all due habits before noon in one day.", xpReward: 40 },
  { code: "STREAK_30", title: "Monthly Mountaineer", description: "Thirty successful entries on one habit.", xpReward: 100 },
  { code: "TASK_MACHINE", title: "Task Machine", description: "Marked fifty tasks as done.", xpReward: 50 },
  { code: "FOCUS_FANATIC", title: "Focus Fanatic", description: "Completed ten Pomodoro sessions.", xpReward: 35 },
  { code: "HABIT_COLLECTOR", title: "Habit Collector", description: "Created five active habits.", xpReward: 25 },
  { code: "MOOD_TRACKER", title: "Mood Tracker", description: "Logged your mood seven times.", xpReward: 20 },
  { code: "CHALLENGE_ACCEPTED", title: "Challenge Accepted", description: "Joined a multi-day challenge.", xpReward: 25 },
  { code: "GOAL_SETTER", title: "Goal Setter", description: "Finished onboarding and set your north star.", xpReward: 15 },
  { code: "LUMINARY", title: "Luminary", description: "Reached 1000 lifetime XP.", xpReward: 50 },
  { code: "COIN_CARRIER", title: "Coin Carrier", description: "Earned your first 100 coins.", xpReward: 20 },
  { code: "DOUBLE_DOWN", title: "Double Down", description: "Completed two habits in the same day ten times.", xpReward: 30 },
];

export const BADGE_BY_CODE: Record<string, BadgeDefinition> = Object.fromEntries(
  BADGE_CATALOG.map((b) => [b.code, b]),
);
