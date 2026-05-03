"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { motion } from "framer-motion";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { CountUp } from "@/components/ui/count-up";
import { parseHabitUiMeta } from "@/lib/habit-ui-meta";

type SeriesPoint = {
  date: string;
  key: string;
  done: number;
  skip: number;
  fail: number;
};

type Overview = {
  longestStreak: number;
  completedCount: number;
};

type Habit = { id: string; title: string; description: string | null };
type LogRow = { habitId: string; date: string; status: string };

type RangeKey = "7d" | "30d" | "3m" | "all";

const RANGE_DAYS: Record<RangeKey, number> = {
  "7d": 7,
  "30d": 30,
  "3m": 90,
  all: 90,
};

function filterSeries(series: SeriesPoint[], days: number) {
  if (series.length === 0) return [];
  return series.slice(-Math.min(days, series.length));
}

function groupWeeks(days: SeriesPoint[]) {
  const weeks: SeriesPoint[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

function heatShade(done: number) {
  if (done <= 0) return "bg-card border border-border-subtle";
  if (done === 1) return "bg-primary/25";
  if (done === 2) return "bg-primary/55";
  return "bg-primary";
}

function streakLineFromLogs(logs: LogRow[], dayKeys: string[]) {
  let streak = 0;
  return dayKeys.map((key) => {
    const anyDone = logs.some(
      (l) => l.status === "DONE" && format(new Date(l.date), "yyyy-MM-dd") === key,
    );
    streak = anyDone ? streak + 1 : 0;
    return { key, streak };
  });
}

export function AnalyticsClient() {
  const { data: session } = useSession();
  const [range, setRange] = useState<RangeKey>("30d");
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.user?.id) {
      setSeries([]);
      setOverview(null);
      setHabits([]);
      setLogs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const from = subDays(new Date(), 120).toISOString();
    const [c, o, h, l] = await Promise.all([
      fetch("/api/stats/charts").then((r) => (r.ok ? r.json() : { series: [] })),
      fetch("/api/stats/overview").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/habits").then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/logs?from=${encodeURIComponent(from)}`).then((r) => (r.ok ? r.json() : [])),
    ]);
    setSeries(Array.isArray(c.series) ? c.series : []);
    setOverview(o);
    setHabits(Array.isArray(h) ? h : []);
    setLogs(Array.isArray(l) ? l : []);
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredSeries = useMemo(() => {
    const days = RANGE_DAYS[range];
    return filterSeries(series, days);
  }, [series, range]);

  const heatmapDays = useMemo(() => {
    const span = Math.min(84, filteredSeries.length || 0);
    const slice = series.slice(-span);
    return slice.length ? slice : filteredSeries;
  }, [series, filteredSeries]);

  const heatmapWeeks = useMemo(() => groupWeeks(heatmapDays), [heatmapDays]);

  const lineData = useMemo(() => {
    const window = range === "all" ? 30 : Math.min(RANGE_DAYS[range], 30);
    const slice = filterSeries(series, window);
    return slice.map((d) => ({ ...d, label: d.date }));
  }, [series, range]);

  const barWeeks = useMemo(() => {
    const days = filteredSeries;
    const buckets: { label: string; total: number }[] = [];
    for (let i = 0; i < days.length; i += 7) {
      const chunk = days.slice(i, i + 7);
      const total = chunk.reduce((s, d) => s + d.done, 0);
      buckets.push({ label: `W${buckets.length + 1}`, total });
    }
    return buckets.slice(-8);
  }, [filteredSeries]);

  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  const donutData = useMemo(() => {
    const monthLogs = logs.filter(
      (l) =>
        l.status === "DONE" &&
        isWithinInterval(new Date(l.date), { start: monthStart, end: monthEnd }),
    );
    const byHabit = new Map<string, number>();
    for (const l of monthLogs) {
      byHabit.set(l.habitId, (byHabit.get(l.habitId) ?? 0) + 1);
    }
    const daysInMonth = Math.max(1, Math.ceil((monthEnd.getTime() - monthStart.getTime()) / 86400000) + 1);
    return habits.map((h, i) => {
      const done = byHabit.get(h.id) ?? 0;
      const pct = Math.min(100, Math.round((done / daysInMonth) * 100));
      const meta = parseHabitUiMeta(h.description);
      return {
        id: h.id,
        name: h.title,
        value: pct,
        color: meta.accent || ["#6366f1", "#3ecf8e", "#60a5fa", "#f5a623", "#f06060"][i % 5],
      };
    });
  }, [habits, logs, monthStart, monthEnd]);

  const donutOverall = useMemo(() => {
    if (!donutData.length) return 0;
    return Math.round(donutData.reduce((s, d) => s + d.value, 0) / donutData.length);
  }, [donutData]);

  const areaData = useMemo(() => {
    const daySeries = filterSeries(series, 60);
    const keys = daySeries.map((d) => d.key);
    const streaks = streakLineFromLogs(logs, keys);
    return daySeries.map((d, i) => ({
      label: d.date,
      streak: streaks[i]?.streak ?? 0,
    }));
  }, [series, logs]);

  const radialData = useMemo(() => {
    const span = RANGE_DAYS[range];
    const from = subDays(new Date(), span);
    const rangeLogs = logs.filter((l) => new Date(l.date) >= from && l.status === "DONE");
    const counts = new Map<string, number>();
    for (const l of rangeLogs) {
      counts.set(l.habitId, (counts.get(l.habitId) ?? 0) + 1);
    }
    return habits.map((h) => {
      const done = counts.get(h.id) ?? 0;
      const pct = Math.min(100, Math.round((done / Math.max(1, span)) * 100));
      const fill = pct >= 70 ? "#3ecf8e" : pct >= 40 ? "#f5a623" : "#f06060";
      return {
        name: h.title.length > 22 ? `${h.title.slice(0, 22)}…` : h.title,
        value: pct,
        fill,
      };
    });
  }, [habits, logs, range]);

  const statCards = useMemo(() => {
    const span = RANGE_DAYS[range];
    const from = subDays(new Date(), span);
    const sliceLogs = logs.filter((l) => new Date(l.date) >= from);
    const doneLogs = sliceLogs.filter((l) => l.status === "DONE");
    const avgDaily = span > 0 ? doneLogs.length / span : 0;

    let topHabit = "—";
    let topRate = -1;
    const perHabit = new Map<string, number>();
    for (const l of doneLogs) {
      if (l.status !== "DONE") continue;
      perHabit.set(l.habitId, (perHabit.get(l.habitId) ?? 0) + 1);
    }
    for (const [hid, c] of perHabit) {
      const rate = c / span;
      if (rate > topRate) {
        topRate = rate;
        topHabit = habits.find((h) => h.id === hid)?.title ?? "—";
      }
    }

    return [
      { label: "Best Streak", value: overview?.longestStreak ?? 0, suffix: "days" },
      { label: "Avg Daily Completions", value: Math.round(avgDaily * 10) / 10, suffix: "/day" },
      { label: "Most Consistent Habit", value: topHabit, suffix: "", text: true },
      { label: "Total Logs", value: doneLogs.length, suffix: "done" },
    ];
  }, [logs, range, habits, overview?.longestStreak]);

  if (!session?.user && !loading) {
    return (
      <div className="app-card flex flex-col items-center justify-center py-16 text-center">
        <p className="text-text-muted">Sign in to view your analytics.</p>
        <Link href="/sign-in" className="btn-primary mt-6">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text md:text-3xl">Analytics</h1>
          <p className="mt-1 text-sm text-text-muted">Visualize momentum, consistency, and habit health.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["7d", "30d", "3m", "all"] as RangeKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setRange(k)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                range === k ? "bg-primary text-white" : "bg-card text-text-muted hover:text-text border border-border-subtle"
              }`}
            >
              {k === "7d" ? "7D" : k === "30d" ? "30D" : k === "3m" ? "3M" : "All time"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
          : statCards.map((s) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="app-card">
                <p className="text-xs font-medium text-text-muted">{s.label}</p>
                <div className="mt-1 font-mono text-2xl font-semibold text-text tabular-nums">
                  {s.text ? (
                    <span className="text-base font-sans font-medium">{String(s.value)}</span>
                  ) : (
                    <CountUp value={Number(s.value)} />
                  )}
                </div>
                {s.suffix ? <p className="mt-1 text-[11px] text-text-muted">{s.suffix}</p> : null}
              </motion.div>
            ))}
      </div>

      <section className="app-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-text">Consistency heatmap</h2>
          <div className="flex items-center gap-2 text-[11px] text-text-muted">
            Less
            <span className="flex gap-1">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`h-3 w-3 rounded-sm ${i === 0 ? "bg-card border border-border-subtle" : i === 1 ? "bg-primary/25" : i === 2 ? "bg-primary/55" : "bg-primary"}`}
                />
              ))}
            </span>
            More
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-1" style={{ minWidth: heatmapWeeks.length * 14 }}>
              {heatmapWeeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-1">
                  {week.map((day) => (
                    <div
                      key={day.key}
                      title={`${day.key}: ${day.done} completions`}
                      className={`h-3 w-3 rounded-sm ${heatShade(day.done)}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.section className="app-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h3 className="mb-2 text-sm font-semibold text-text">Daily completions over time</h3>
          <div className="h-64 w-full min-w-0">
            {loading ? (
              <Skeleton className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#a0a0c0", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#a0a0c0", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "#1a1a28",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 12,
                      color: "#f0f0f8",
                    }}
                  />
                  <Line type="monotone" dataKey="done" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: "#6366f1" }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.section>

        <motion.section className="app-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h3 className="mb-2 text-sm font-semibold text-text">Weekly completion count</h3>
          <div className="h-64 w-full min-w-0">
            {loading ? (
              <Skeleton className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barWeeks}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#a0a0c0", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#a0a0c0", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "#1a1a28",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 12,
                      color: "#f0f0f8",
                    }}
                  />
                  <Bar dataKey="total" fill="#6366f1" radius={[6, 6, 0, 0]} animationDuration={700}>
                    {barWeeks.map((_, i) => (
                      <Cell key={i} fill="#6366f1" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.section>

        <motion.section className="app-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h3 className="mb-2 text-sm font-semibold text-text">Habit completion rate (month)</h3>
          <div className="relative h-64 w-full min-w-0">
            {loading ? (
              <Skeleton className="h-full" />
            ) : donutData.length === 0 ? (
              <p className="py-10 text-center text-sm text-text-muted">No habits yet.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={2}
                    >
                      {donutData.map((d) => (
                        <Cell key={d.id} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "#1a1a28",
                        border: "1px solid rgba(255,255,255,0.07)",
                        borderRadius: 12,
                        color: "#f0f0f8",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#a0a0c0" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="font-mono text-2xl font-semibold text-text">{donutOverall}%</span>
                </div>
              </>
            )}
          </div>
        </motion.section>

        <motion.section className="app-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h3 className="mb-2 text-sm font-semibold text-text">Streak history</h3>
          <div className="h-64 w-full min-w-0">
            {loading ? (
              <Skeleton className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={areaData}>
                  <defs>
                    <linearGradient id="streakFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#a0a0c0", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#a0a0c0", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "#1a1a28",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 12,
                      color: "#f0f0f8",
                    }}
                  />
                  <Area type="monotone" dataKey="streak" stroke="#6366f1" fill="url(#streakFill)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.section>
      </div>

      <section className="app-card">
        <h3 className="mb-3 text-sm font-semibold text-text">Per-habit performance</h3>
        <div className="h-80 w-full min-w-0 overflow-x-auto">
          {loading ? (
            <Skeleton className="h-72" />
          ) : radialData.length === 0 ? (
            <p className="py-10 text-center text-sm text-text-muted">No habits to compare.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minWidth={320}>
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="15%"
                outerRadius="90%"
                data={radialData}
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar
                  background={{ fill: "rgba(255,255,255,0.06)" }}
                  dataKey="value"
                  cornerRadius={6}
                  animationDuration={700}
                />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "#1a1a28",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 12,
                    color: "#f0f0f8",
                  }}
                />
              </RadialBarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </div>
  );
}
