"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, startOfDay, subDays } from "date-fns";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CountUp } from "@/components/ui/count-up";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthGate } from "@/components/auth/auth-gate-context";
import { parseHabitUiMeta } from "@/lib/habit-ui-meta";

type Overview = {
  habitsCount: number;
  completedCount: number;
  currentStreak: number;
  longestStreak: number;
  xp: number;
  level: number;
  streakFreezes: number;
  badges: number;
};

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
  const { requireAuth } = useAuthGate();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const todayKey = format(startOfDay(new Date()), "yyyy-MM-dd");

  const load = useCallback(async () => {
    if (!session?.user?.id) {
      setOverview(null);
      setHabits([]);
      setLogs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const from = subDays(new Date(), 84).toISOString();
    const [o, h, l] = await Promise.all([
      fetch("/api/stats/overview").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/habits").then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/logs?from=${encodeURIComponent(from)}`).then((r) => (r.ok ? r.json() : [])),
    ]);
    setOverview(o);
    setHabits(Array.isArray(h) ? h : []);
    setLogs(Array.isArray(l) ? l : []);
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

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

  async function checkHabit(habitId: string) {
    const res = await fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        habitId,
        status: "DONE",
        date: new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      toast.error("Could not log habit.");
      return;
    }
    toast.success("Habit logged! 🔥 Keep it up");
    await load();
  }

  const firstName = session?.user?.name?.split(" ")[0] ?? session?.user?.name;

  return (
    <div className="space-y-8">
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading && session?.user ? (
          <>
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </>
        ) : (
          <>
            <StatCard
              label="Current Streak"
              value={overview?.currentStreak ?? 0}
              badge={{ text: "On track", tone: "green" }}
            />
            <StatCard
              label="Total Habits"
              value={overview?.habitsCount ?? habits.length}
              badge={{ text: "Active", tone: "blue" }}
            />
            <StatCard
              label="Streak Freezes"
              value={overview?.streakFreezes ?? 0}
              badge={{ text: "Saved", tone: "amber" }}
            />
            <StatCard
              label="XP Earned"
              value={overview?.xp ?? 0}
              badge={{ text: `Lvl ${overview?.level ?? 1}`, tone: "indigo" }}
            />
          </>
        )}
      </div>

      {!loading && !session?.user ? (
        <div className="app-card flex flex-col items-center justify-center py-16 text-center">
          <p className="max-w-md text-text-muted">
            Sign in to sync habits, streaks, and XP. You can browse the app — actions will prompt you to authenticate.
          </p>
          <Link href="/sign-in" className="btn-primary mt-6">
            Sign In
          </Link>
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
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <p className="text-text-muted">No habits yet. Create one to start your streak.</p>
              <Link href="/habits" className="btn-primary mt-4">
                Create habit
              </Link>
            </div>
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
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-border-subtle bg-surface/40 px-3 py-3 sm:flex-nowrap"
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
                            d.done ? "border-success/40 bg-success" : "border-border-subtle bg-card",
                            d.isToday && !d.done ? "ring-2 ring-primary ring-offset-2 ring-offset-surface" : "",
                            d.isToday && d.done ? "ring-2 ring-success/50 ring-offset-2 ring-offset-surface" : "",
                          ].join(" ")}
                        />
                      ))}
                    </div>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.92 }}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-card text-lg text-primary transition hover:bg-primary-soft disabled:opacity-40"
                      disabled={done}
                      onClick={requireAuth(() => void checkHabit(habit.id))}
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
                    ? "bg-card"
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
                  <XAxis dataKey="label" tick={{ fill: "#a0a0c0", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      background: "#1a1a28",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 12,
                      color: "#f0f0f8",
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
}: {
  label: string;
  value: number;
  badge: { text: string; tone: "green" | "amber" | "blue" | "indigo" };
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
      className="app-card relative overflow-hidden"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <p className="text-xs font-medium text-text-muted">{label}</p>
      <p className="mt-1 font-mono text-3xl font-semibold tracking-tight text-text tabular-nums">
        <CountUp value={value} />
      </p>
      <span className={`mt-3 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeCls}`}>
        {badge.text}
      </span>
    </motion.div>
  );
}
