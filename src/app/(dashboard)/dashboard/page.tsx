import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const [habitsCount, completedCount, streaks, user, badges, activeChallenges] = userId
    ? await Promise.all([
        prisma.habit.count({ where: { userId, isArchived: false } }),
        prisma.habitLog.count({ where: { userId, status: "DONE" } }),
        prisma.streak.findMany({ where: { userId } }),
        prisma.user.findUnique({ where: { id: userId }, select: { xp: true, streakFreezeCount: true } }),
        prisma.userAchievement.count({ where: { userId } }),
        prisma.userChallenge.count({ where: { userId, completedAt: null } }),
      ])
    : [0, 0, [] as { currentCount: number }[], null, 0, 0];

  const cards = [
    { label: "Habits", value: habitsCount },
    { label: "Completed Logs", value: completedCount },
    { label: "Current Streak", value: Math.max(0, ...streaks.map((s: { currentCount: number }) => s.currentCount)) },
    { label: "XP", value: user?.xp ?? 0 },
    { label: "Streak Freezes", value: user?.streakFreezeCount ?? 0 },
    { label: "Badges", value: badges },
    { label: "Active Challenges", value: activeChallenges },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="app-card">
            <p className="text-sm text-zinc-400">{card.label}</p>
            <p className="text-3xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>
      <div className="app-card">
        <h2 className="mb-2 text-xl font-semibold">MVP includes</h2>
        <p className="text-zinc-300">
          Habit CRUD, logs, streaks, life-score API, leaderboard API, and AI coach starter endpoint.
        </p>
      </div>
    </div>
  );
}
