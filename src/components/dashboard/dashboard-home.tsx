"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, startOfDay, subDays } from "date-fns";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import clsx from "clsx";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuthModal } from "@/components/auth/auth-modal-context";
import { BadgeEarnedModal, type BadgeEarned } from "@/components/gamification/badge-earned-modal";
import { LevelUpModal } from "@/components/gamification/level-up-modal";
import type { XpFloatItem } from "@/components/gamification/xp-float-label";
import { XpFloatLayer } from "@/components/gamification/xp-float-label";
import { AiGamePlanCard } from "./ai-game-plan-card";
import { CountUp } from "@/components/ui/count-up";
import { EmptyState } from "@/components/ui/empty-state";
import { MiniSparkline } from "@/components/ui/mini-sparkline";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { fireHabitConfetti } from "@/lib/confetti-burst";
import { parseHabitUiMeta } from "@/lib/habit-ui-meta";
import { levelDisplayName } from "@/lib/gamification/levels";
import type { AnalyticsOverviewPayload } from "@/lib/analytics-overview";

type Overview = {
  habitsCount: number;
  completedCount: number;
  currentStreak: number;
  longestStreak: number;
  xp: number;
  level: number;
  streakFreezes: number;
  badges: number;
  coins?: number;
  xpToNext?: number;
  levelProgress?: number;
};

type DailyChallengeRow = {
  key: string;
  text: string;
  progress: number;
  targetCount: number;
  completed: boolean;
  xpReward: number;
};

const MOOD_QUICK = [
  { score: 1, emoji: "😣", label: "Rough" },
  { score: 2, emoji: "😕", label: "Low" },
  { score: 3, emoji: "😐", label: "OK" },
  { score: 4, emoji: "🙂", label: "Good" },
  { score: 5, emoji: "😄", label: "Great" },
] as const;

type HabitRow = {
  id: string;
  title: string;
  description: string | null;
  lifeArea: string;
};

type LogRow = {
  id: string;
  habitId: string;
  date: string;
  status: "DONE" | "SKIP" | "FAIL";
};

function greeting(name: string | null | undefined) {
  const h = new Date().getHours();
  if (h < 12) return `Good morning${name ? `, ${name}` : ""}! 👋`;
  if (h < 18) return `Good afternoon${name ? `, ${name}` : ""}! 👋`;
  return `Good evening${name ? `, ${name}` : ""}! 👋`;
}

function computeCurrentStreakForHabit(habitId: string, logs: LogRow[]): number {
  const doneDays = new Set(
    logs
      .filter((l) => l.habitId === habitId && l.status === "DONE")
      .map((l) => format(startOfDay(new Date(l.date)), "yyyy-MM-dd")),
  );
  let count = 0;
  for (let i = 0; i < 400; i++) {
    const d = subDays(startOfDay(new Date()), i);
    const key = format(d, "yyyy-MM-dd");
    if (doneDays.has(key)) count += 1;
    else break;
  }
  return count;
}

function weekDots(
  habitId: string,
  logsByDay: Map<string, Set<string>>,
  todayKey: string,
) {
  const days = Array.from({ length: 7 }, (_, i) => subDays(startOfDay(new Date()), 6 - i));
  return days.map((d) => {
    const key = format(d, "yyyy-MM-dd");
    const done = logsByDay.get(key)?.has(habitId);
    const isToday = key === todayKey;
    return { key, done, isToday };
  });
}

export function DashboardHome() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { requireAuth } = useAuthModal();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsOverviewPayload | null>(null);
  const [todayTasks, setTodayTasks] = useState<{ id: string; title: string; priority: string; status: string }[]>([]);
  const [quickTask, setQuickTask] = useState("");
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [xpFloats, setXpFloats] = useState<XpFloatItem[]>([]);
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const [levelUpLevel, setLevelUpLevel] = useState(1);
  const prevLevelRef = useRef<number | null>(null);
  const [badgeEarned, setBadgeEarned] = useState<BadgeEarned | null>(null);
  const [challenges, setChallenges] = useState<DailyChallengeRow[]>([]);
  const [topBadgeTitles, setTopBadgeTitles] = useState<string[]>([]);
  const [moodToday, setMoodToday] = useState<{ moodScore: number } | null>(null);

  const todayKey = format(startOfDay(new Date()), "yyyy-MM-dd");

  const load = useCallback(async () => {
    if (!session?.user?.id) {
      setOverview(null);
      setHabits([]);
      setLogs([]);
      setChallenges([]);
      setTopBadgeTitles([]);
      setMoodToday(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const from = subDays(new Date(), 84).toISOString();
    const [o, h, l, ax, tt, ch, bd, mo] = await Promise.all([
      fetch("/api/stats/overview").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/habits").then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/logs?from=${encodeURIComponent(from)}`).then((r) => (r.ok ? r.json() : [])),
      fetch("/api/analytics/overview").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/tasks/today").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/gamification/daily-challenges").then((r) => (r.ok ? r.json() : { challenges: [] })),
      fetch("/api/gamification/badges").then((r) => (r.ok ? r.json() : { earned: [] })),
      fetch("/api/mood").then((r) => (r.ok ? r.json() : { todayLog: null })),
    ]);
    setOverview(o);
    setAnalytics(ax);
    setTodayTasks(Array.isArray(tt?.tasks) ? tt.tasks.slice(0, 8) : []);
    setHabits(Array.isArray(h) ? h : []);
    setLogs(Array.isArray(l) ? l : []);
    setChallenges(Array.isArray(ch.challenges) ? ch.challenges : []);
    setTopBadgeTitles(
      Array.isArray(bd.earned)
        ? bd.earned.slice(0, 3).map((e: { achievement: { title: string } }) => e.achievement.title)
        : [],
    );
    setMoodToday(
      mo?.todayLog && typeof mo.todayLog.moodScore === "number"
        ? { moodScore: mo.todayLog.moodScore }
        : null,
    );
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get("welcome") !== "1") return;
    toast.success("You're all set — your journey starts now! ✨");
    router.replace(pathname || "/", { scroll: false });
  }, [searchParams, router, pathname]);

  useEffect(() => {
    if (!overview) return;
    const L = overview.level;
    if (prevLevelRef.current !== null && L > prevLevelRef.current) {
      setLevelUpLevel(L);
      setLevelUpOpen(true);
    }
    prevLevelRef.current = L;
  }, [overview?.level]);

  const logsByDay = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const log of logs) {
      if (log.status !== "DONE") continue;
      const key = format(new Date(log.date), "yyyy-MM-dd");
      if (!m.has(key)) m.set(key, new Set());
      m.get(key)!.add(log.habitId);
    }
    return m;
  }, [logs]);

  const doneTodayByHabit = useMemo(() => {
    const set = new Set<string>();
    for (const log of logs) {
      if (log.status !== "DONE") continue;
      if (format(new Date(log.date), "yyyy-MM-dd") !== todayKey) continue;
      set.add(log.habitId);
    }
    return set;
  }, [logs, todayKey]);

  const remainingToday = useMemo(() => {
    if (!habits.length) return 0;
    return habits.filter((h) => !doneTodayByHabit.has(h.id)).length;
  }, [habits, doneTodayByHabit]);

  const heatmap14 = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const d = subDays(startOfDay(new Date()), 13 - i);
      const key = format(d, "yyyy-MM-dd");
      const count = logsByDay.get(key)?.size ?? 0;
      return { key, count, label: format(d, "EEE") };
    });
  }, [logsByDay]);

  const weeklyBars = useMemo(() => {
    const weeks: { label: string; total: number }[] = [];
    for (let w = 0; w < 8; w++) {
      const end = subDays(startOfDay(new Date()), w * 7);
      const start = subDays(end, 6);
      let total = 0;
      for (const log of logs) {
        if (log.status !== "DONE") continue;
        const d = new Date(log.date);
        if (d >= start && d <= end) total += 1;
      }
      weeks.push({
        label: `W${8 - w}`,
        total,
      });
    }
    return weeks.reverse();
  }, [logs]);

  const weekSpark = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = subDays(startOfDay(new Date()), 6 - i);
      const key = format(d, "yyyy-MM-dd");
      return logsByDay.get(key)?.size ?? 0;
    });
  }, [logsByDay]);

  function pushXpFloat(clientX: number, clientY: number) {
    const id = crypto.randomUUID();
    setXpFloats((f) => [...f, { id, amount: 10, x: clientX, y: clientY }]);
    window.setTimeout(() => {
      setXpFloats((f) => f.filter((item) => item.id !== id));
    }, 1200);
  }

  async function checkHabit(habitId: string, sourceEl: HTMLElement | null) {
    const dateIso = new Date().toISOString();
    const pendingLogId = `pending-${habitId}-${todayKey}`;
    const optimisticLog: LogRow = { id: pendingLogId, habitId, date: dateIso, status: "DONE" };
    const prevLogs = logs;
    setLogs((l) => [...l, optimisticLog]);
    const res = await fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        habitId,
        status: "DONE",
        date: dateIso,
      }),
    });
    if (!res.ok) {
      setLogs(prevLogs);
      toast.error("Could not log habit.");
      return;
    }
    const payload = (await res.json()) as {
      id: string;
      habitId: string;
      date: string;
      status: LogRow["status"];
      gamification?: { newBadges?: BadgeEarned[] };
    };
    setLogs((l) => [
      ...l.filter((x) => x.id !== pendingLogId),
      { id: payload.id, habitId: payload.habitId, date: payload.date, status: payload.status },
    ]);
    const nb = payload.gamification?.newBadges;
    if (nb?.length) {
      setBadgeEarned(nb[0]);
      for (let i = 1; i < nb.length; i++) {
        toast.success(`Badge: ${nb[i].title}`);
      }
    }
    fireHabitConfetti(sourceEl);
    if (sourceEl) {
      const r = sourceEl.getBoundingClientRect();
      pushXpFloat(r.left + r.width / 2, r.top);
    }
    toast.success("Habit logged! 🔥 Keep it up");
    void load();
  }

  async function logMood(score: number) {
    const res = await fetch("/api/mood", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moodScore: score }),
    });
    if (!res.ok) {
      toast.error("Could not save mood.");
      return;
    }
    const payload = (await res.json()) as {
      moodScore: number;
      gamification?: { newBadges?: BadgeEarned[]; level?: number };
    };
    setMoodToday({ moodScore: payload.moodScore });
    const nb = payload.gamification?.newBadges;
    if (nb?.length) {
      setBadgeEarned(nb[0]);
      for (let i = 1; i < nb.length; i++) {
        toast.success(`Badge: ${nb[i].title}`);
      }
    }
    toast.success("Mood saved");
    void load();
  }

  async function quickAddTask() {
    const title = quickTask.trim();
    if (!title) return;
    const tempId = crypto.randomUUID();
    const optimistic = {
      id: tempId,
      title,
      priority: "medium",
      status: "todo",
    };
    const prevToday = todayTasks;
    setTodayTasks((t) => [optimistic, ...t].slice(0, 8));
    setQuickTask("");
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        priority: "medium",
        dueDate: new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      setTodayTasks(prevToday);
      setQuickTask(title);
      toast.error("Could not add task");
      return;
    }
    const server = (await res.json()) as {
      id: string;
      title: string;
      priority: string;
      status: string;
    };
    setTodayTasks((t) =>
      t.map((x) => (x.id === tempId ? { id: server.id, title: server.title, priority: server.priority, status: server.status } : x)).slice(0, 8),
    );
    toast.success("Task added");
    void load();
  }

  const firstName = session?.user?.name?.split(" ")[0] ?? session?.user?.name;
  const score = analytics?.productivity.score ?? 0;
  const scoreColor =
    score >= 70 ? "text-success" : score >= 40 ? "text-amber" : "text-danger";
  const focusMin = analytics?.pomodoro.totalMinutesToday ?? 0;

  return (
    <div className="space-y-8">
      <XpFloatLayer items={xpFloats} />
      <LevelUpModal open={levelUpOpen} level={levelUpLevel} onClose={() => setLevelUpOpen(false)} />
      <BadgeEarnedModal badge={badgeEarned} onClose={() => setBadgeEarned(null)} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-2xl font-semibold tracking-tight text-text md:text-3xl">
            {greeting(firstName)}
          </p>
          <p className="mt-1 text-sm text-text-muted">
            {format(new Date(), "EEEE, MMMM d, yyyy")} ·{" "}
            <span className="font-mono text-text">{remainingToday}</span> habits remaining today
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/habits"
            onClick={(e) => {
              if (!session?.user) {
                e.preventDefault();
                requireAuth(() => router.push("/habits"))();
              }
            }}
            className="btn-primary px-5"
          >
            + Add Habit
          </Link>
        </div>
      </div>

      {session?.user && !session.user.username ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          <Link href="/setup-profile" className="font-medium underline">
            Complete your profile to use community features →
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {loading && session?.user ? (
          <>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} className="h-28" lines={2} />
            ))}
          </>
        ) : (
          <>
            <StatCard
              label="Habit streak"
              value={analytics?.habits.currentStreak ?? overview?.currentStreak ?? 0}
              badge={{ text: "Habits", tone: "green" }}
              sparkline={weekSpark}
              accent="#10b981"
            />
            <StatCard
              label="Tasks today"
              value={analytics?.tasks.completedToday ?? 0}
              badge={{
                text: `${analytics?.tasks.totalToday ?? 0} total`,
                tone: "blue",
              }}
              sparkline={weekSpark}
              accent="#3b82f6"
            />
            <StatCard
              label="Focus time"
              value={Math.round(focusMin)}
              badge={{ text: "min today", tone: "indigo" }}
              sparkline={weekSpark}
              accent="#6366f1"
            />
            <StatCard
              label="XP"
              value={overview?.xp ?? 0}
              badge={{ text: `Lvl ${overview?.level ?? 1}`, tone: "indigo" }}
              sparkline={weekSpark}
              accent="#a855f7"
            />
            <StatCard
              label="Completion rate"
              value={analytics?.tasks.completionRate ?? 0}
              badge={{ text: "% tasks", tone: "amber" }}
              sparkline={weekSpark}
              accent="#f59e0b"
            />
            <StatCard
              label="Productivity"
              value={score}
              badge={{ text: "/100", tone: "green" }}
              sparkline={weekSpark}
              accent="#10b981"
            />
          </>
        )}
      </div>

      {session?.user ? <AiGamePlanCard /> : null}

      {session?.user && overview ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="app-card lg:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Level progress</p>
            <p className="mt-1 text-lg font-semibold text-text">{levelDisplayName(overview.level)}</p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-canvas">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${Math.round((overview.levelProgress ?? 0) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-text-muted">
              <span className="font-mono text-text">{overview.xp}</span> XP
              {overview.xpToNext != null && overview.xpToNext > 0 ? (
                <> · <span className="font-mono">{overview.xpToNext}</span> XP to next</>
              ) : (
                <> · max level</>
              )}
            </p>
            {typeof overview.coins === "number" ? (
              <p className="mt-1 text-xs text-text-muted">
                🪙 <span className="font-mono font-semibold text-text">{overview.coins}</span> coins
              </p>
            ) : null}
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Mood check-in</p>
              {moodToday ? (
                <p className="mt-2 text-sm text-text">
                  Logged today: <span className="text-lg">{MOOD_QUICK.find((m) => m.score === moodToday.moodScore)?.emoji ?? "—"}</span>{" "}
                  <span className="text-text-muted">
                    {MOOD_QUICK.find((m) => m.score === moodToday.moodScore)?.label ?? ""}
                  </span>
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {MOOD_QUICK.map((m) => (
                    <button
                      key={m.score}
                      type="button"
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-canvas text-lg transition hover:border-primary hover:bg-primary-soft"
                      aria-label={m.label}
                      title={m.label}
                      onClick={requireAuth(() => void logMood(m.score))}
                    >
                      {m.emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="app-card lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-text">Today&apos;s challenges</h2>
              <Link href="/shop" className="text-[11px] font-medium text-primary">
                Spend coins →
              </Link>
            </div>
            {challenges.length === 0 ? (
              <p className="mt-3 text-sm text-text-muted">Loading challenges…</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {challenges.map((c) => (
                  <li
                    key={c.key}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border bg-canvas px-3 py-2 text-sm"
                  >
                    <span className={c.completed ? "font-medium text-success" : "text-text"}>{c.text}</span>
                    <span className="shrink-0 font-mono text-[11px] text-text-muted">
                      {c.progress}/{c.targetCount}
                      {c.completed ? " ✓" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {session?.user && topBadgeTitles.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-text-muted">Top badges</span>
          {topBadgeTitles.map((t) => (
            <span key={t} className="rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
              {t}
            </span>
          ))}
          <Link href="/badges" className="text-xs font-medium text-primary">
            View all →
          </Link>
        </div>
      ) : null}

      {session?.user ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="app-card flex flex-col items-center justify-center py-8">
            <p className="text-xs font-medium uppercase text-text-muted">Productivity score</p>
            <div className="relative mt-4 h-40 w-40">
              <svg viewBox="0 0 100 100" className="-rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#E5E7EB" strokeWidth="10" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="10"
                  strokeDasharray={264}
                  strokeDashoffset={264 * (1 - score / 100)}
                  strokeLinecap="round"
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={clsx("font-mono text-4xl font-bold", scoreColor)}>{score}</span>
                <span className="mt-1 text-center text-[11px] text-text-muted">
                  {analytics?.productivity.trend ?? "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="app-card lg:col-span-2">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-text">Today&apos;s tasks</h2>
              <Link href="/tasks" className="text-sm font-medium text-primary">
                View all tasks →
              </Link>
            </div>
            <div className="mb-4 flex gap-2">
              <input
                className="input-field flex-1 text-sm"
                placeholder="Quick add task…"
                value={quickTask}
                onChange={(e) => setQuickTask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") requireAuth(() => void quickAddTask())();
                }}
              />
              <button type="button" className="btn-primary shrink-0 px-4 text-sm" onClick={requireAuth(() => void quickAddTask())}>
                Add
              </button>
            </div>
            <ul className="space-y-2">
              {todayTasks.slice(0, 5).map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-canvas px-3 py-2 text-sm"
                >
                  <span className="truncate text-text">{t.title}</span>
                  <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold capitalize text-primary">
                    {t.priority}
                  </span>
                </li>
              ))}
              {todayTasks.length === 0 ? (
                <div className="py-4">
                  <EmptyState
                    illustration="tasks"
                    title="Your journey starts here"
                    description="Add a task for today and ship one meaningful win."
                    ctaLabel="+ Add your first task"
                    ctaHref="/tasks"
                  />
                </div>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}

      {!loading && !session?.user ? (
        <div className="app-card flex flex-col items-center justify-center py-16 text-center">
          <p className="max-w-md text-text-muted">
            Explore everything freely. We&apos;ll ask you to sign in only when you try to save data.
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="app-card">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-text">Today&apos;s Habits</h2>
          </div>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : habits.length === 0 ? (
            <EmptyState
              illustration="journey"
              title="Your journey starts here"
              description="One small habit, logged daily, becomes unstoppable momentum."
              ctaLabel="+ Add your first habit"
              onCta={() => requireAuth(() => router.push("/habits"))()}
            />
          ) : (
            <ul className="space-y-3">
              {habits.map((habit) => {
                const meta = parseHabitUiMeta(habit.description);
                const streak = computeCurrentStreakForHabit(habit.id, logs);
                const dots = weekDots(habit.id, logsByDay, todayKey);
                const done = doneTodayByHabit.has(habit.id);
                return (
                  <li
                    key={habit.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-canvas px-3 py-3 sm:flex-nowrap"
                  >
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg"
                      style={{ backgroundColor: `${meta.accent}22`, color: meta.accent }}
                      aria-hidden
                    >
                      {meta.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-text">{habit.title}</p>
                      <p className="text-xs text-text-muted">
                        Streak · <span className="font-mono text-text">{streak}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {dots.map((d) => (
                        <span
                          key={d.key}
                          title={d.key}
                          className={[
                            "h-2.5 w-2.5 rounded-full border",
                            d.done ? "border-success/40 bg-success" : "border-border bg-card",
                            d.isToday && !d.done ? "ring-2 ring-primary ring-offset-2 ring-offset-surface" : "",
                            d.isToday && d.done ? "ring-2 ring-success/50 ring-offset-2 ring-offset-surface" : "",
                          ].join(" ")}
                        />
                      ))}
                    </div>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.88 }}
                      animate={done ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-lg text-primary transition hover:bg-primary-soft disabled:opacity-40"
                      disabled={done}
                      onClick={(e) => {
                        requireAuth(() => void checkHabit(habit.id, e.currentTarget))();
                      }}
                      aria-label={done ? "Already logged" : "Log habit"}
                    >
                      ✓
                    </motion.button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="app-card space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-text">14-day activity</h2>
            <p className="text-xs text-text-muted">Completions per day</p>
            <div className="mt-4 flex gap-1">
              {heatmap14.map((d) => {
                const intensity =
                  d.count === 0 ? 0 : d.count === 1 ? 1 : d.count === 2 ? 2 : 3;
                const bg =
                  intensity === 0
                    ? "border border-border bg-canvas"
                    : intensity === 1
                      ? "bg-primary/25"
                      : intensity === 2
                        ? "bg-primary/55"
                        : "bg-primary";
                return (
                  <div key={d.key} className="flex-1">
                    <div
                      className={`mx-auto h-8 max-w-[28px] rounded-md ${bg}`}
                      title={`${d.key}: ${d.count}`}
                    />
                    <p className="mt-1 text-center text-[10px] text-text-muted">{d.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text">Weekly completions</h3>
            <div className="mt-3 h-44 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyBars}>
                  <CartesianGrid stroke="#E5E7EB" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#6B7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      background: "#FFFFFF",
                      border: "1px solid #E5E7EB",
                      borderRadius: 12,
                      color: "#111827",
                    }}
                  />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]} animationDuration={600}>
                    {weeklyBars.map((_, i) => (
                      <Cell key={i} fill="#6366f1" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  badge,
  sparkline,
  accent,
}: {
  label: string;
  value: number;
  badge: { text: string; tone: "green" | "amber" | "blue" | "indigo" };
  sparkline: number[];
  accent: string;
}) {
  const badgeCls =
    badge.tone === "green"
      ? "bg-success/15 text-success"
      : badge.tone === "amber"
        ? "bg-amber/15 text-amber"
        : badge.tone === "blue"
          ? "bg-info/15 text-info"
          : "bg-primary-soft text-primary";

  return (
    <motion.div
      className="app-card relative overflow-hidden border-l-4 pl-[calc(var(--card-padding)-4px)]"
      style={{ borderLeftColor: accent }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <p className="text-xs font-medium text-text-muted">{label}</p>
      <p className="mt-1 font-mono text-3xl font-semibold tracking-tight text-text tabular-nums">
        <CountUp value={value} />
      </p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeCls}`}>
          {badge.text}
        </span>
        <MiniSparkline values={sparkline} accent={accent} className="opacity-90" />
      </div>
    </motion.div>
  );
}
