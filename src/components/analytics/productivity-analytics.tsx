"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { CountUp } from "@/components/ui/count-up";
import type { AnalyticsOverviewPayload } from "@/lib/analytics-overview";

/** Recharts — light theme */
const CHART = {
  grid: "#E5E7EB",
  tick: "#6B7280",
  tooltipBg: "#FFFFFF",
  tooltipBorder: "#E5E7EB",
  tooltipColor: "#111827",
  radialTrack: "#F3F4F6",
  primary: "#6366F1",
  green: "#10B981",
  blue: "#3B82F6",
  amber: "#F59E0B",
  red: "#EF4444",
  mutedSlice: "#9CA3AF",
} as const;

const tooltipStyle = {
  background: CHART.tooltipBg,
  border: `1px solid ${CHART.tooltipBorder}`,
  borderRadius: 12,
  color: CHART.tooltipColor,
} as const;

type RangeKey = "today" | "7d" | "30d" | "3m" | "all";

const RANGE_D: Record<RangeKey, number> = {
  today: 1,
  "7d": 7,
  "30d": 30,
  "3m": 90,
  all: 365,
};

type Overview = AnalyticsOverviewPayload;

type Report = {
  habitDailyDone: Record<string, number>;
  taskCompletedByDay: Record<string, number>;
  taskCreatedByDay: Record<string, number>;
  pomodoroByDay: Record<string, number>;
  hourDayHeat: Record<string, number>;
  weekdayTotals: Record<string, number>;
  perHabitRates: { habitId: string; title: string; rate: number }[];
  tasksSnapshot?: { priority: string; status: string }[];
};

type SeriesPoint = { key: string; date: string; done: number };

function buildDualLine(habitMap: Record<string, number>, taskMap: Record<string, number>, days: number) {
  return Array.from({ length: days }, (_, i) => {
    const d = subDays(new Date(), days - 1 - i);
    const k = format(d, "yyyy-MM-dd");
    const hCount = habitMap[k] ?? 0;
    const tCount = taskMap[k] ?? 0;
    const habitRate = Math.min(100, hCount * 20);
    const taskRate = Math.min(100, tCount * 15);
    return { label: format(d, "MMM d"), habitRate, taskRate };
  });
}

function insightCards(overview: Overview | null, report: Report | null, range: RangeKey) {
  if (!overview || !report) return [];
  const items: { icon: string; text: string }[] = [];
  const bestWd = Object.entries(report.weekdayTotals).sort((a, b) => +b[1] - +a[1])[0];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  if (bestWd) {
    items.push({
      icon: "🔥",
      text: `**${days[Number(bestWd[0])]}** tends to be your strongest day for habit check-ins in this range.`,
    });
  }
  const top = overview.habits.perHabit.sort((a, b) => b.completionRate - a.completionRate)[0];
  if (top?.completionRate) {
    items.push({
      icon: "💪",
      text: `**${top.title}** is your most consistent habit (${top.completionRate}% over the window).`,
    });
  }
  if (overview.tasks.overdue > 0) {
    items.push({
      icon: "⚠️",
      text: `You have **${overview.tasks.overdue} overdue task(s)** — consider a 15-minute clear-out block.`,
    });
  }
  items.push({
    icon: "📊",
    text: `Productivity score is **${overview.productivity.score}/100** (${range}). ${overview.productivity.trend}`,
  });
  return items.slice(0, 4);
}

export function ProductivityAnalytics() {
  const { data: session } = useSession();
  const [range, setRange] = useState<RangeKey>("30d");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const days = RANGE_D[range];

  const load = useCallback(async () => {
    if (!session?.user?.id) {
      setOverview(null);
      setReport(null);
      setSeries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const d = RANGE_D[range];
    const [o, r, c] = await Promise.all([
      fetch("/api/analytics/overview").then((x) => (x.ok ? x.json() : null)),
      fetch(`/api/analytics/report?days=${d}`).then((x) => (x.ok ? x.json() : null)),
      fetch("/api/stats/charts").then((x) => (x.ok ? x.json() : { series: [] })),
    ]);
    setOverview(o);
    setReport(r);
    setSeries(Array.isArray(c.series) ? c.series : []);
    setLoading(false);
  }, [session?.user?.id, range]);

  useEffect(() => {
    void load();
  }, [load]);

  const heatmapWeeks = useMemo(() => {
    const slice = series.slice(-84);
    const weeks: SeriesPoint[][] = [];
    for (let i = 0; i < slice.length; i += 7) weeks.push(slice.slice(i, i + 7));
    return weeks;
  }, [series]);

  const lineHabit = useMemo(() => {
    const s = series.slice(-Math.min(30, series.length));
    return s.map((x) => ({ label: x.date, done: x.done }));
  }, [series]);

  const radialHabits = useMemo(() => {
    if (!report?.perHabitRates?.length) return [];
    return report.perHabitRates.map((h, i) => ({
      name: h.title.slice(0, 18),
      value: h.rate,
      fill: h.rate >= 70 ? CHART.green : h.rate >= 40 ? CHART.amber : CHART.red,
      idx: i,
    }));
  }, [report]);

  const taskBarDaily = useMemo(() => {
    if (!report) return [];
    const keys = Object.keys({ ...report.taskCompletedByDay, ...report.taskCreatedByDay }).sort();
    return keys.slice(-14).map((k) => ({
      day: k.slice(5),
      done: Number(report.taskCompletedByDay[k] ?? 0),
      created: Number(report.taskCreatedByDay[k] ?? 0),
    }));
  }, [report]);

  const taskDonut = useMemo(() => {
    if (!overview) return [];
    const t = overview.tasks;
    const pending = Math.max(0, t.totalToday - t.completedToday);
    return [
      { name: "Done", value: t.completedToday, color: CHART.primary },
      { name: "Pending", value: pending, color: CHART.mutedSlice },
      { name: "Overdue", value: t.overdue, color: CHART.red },
    ].filter((x) => x.value > 0);
  }, [overview]);

  const stackedCreatedDone = useMemo(() => {
    if (!report) return [];
    const keys = [...new Set([...Object.keys(report.taskCreatedByDay), ...Object.keys(report.taskCompletedByDay)])]
      .sort()
      .slice(-30);
    return keys.map((k) => ({
      label: k.slice(5),
      created: report.taskCreatedByDay[k] ?? 0,
      completed: Number(report.taskCompletedByDay[k] ?? 0),
    }));
  }, [report]);

  const priorityBars = useMemo(() => {
    if (!report?.tasksSnapshot) return [];
    const m = { low: 0, medium: 0, high: 0, urgent: 0 };
    for (const t of report.tasksSnapshot) {
      if (t.status !== "done") continue;
      const p = t.priority as keyof typeof m;
      if (m[p] !== undefined) m[p] += 1;
      else m.medium += 1;
    }
    return Object.entries(m).map(([name, count]) => ({ name, count }));
  }, [report]);

  const heatRows = useMemo(() => {
    if (!report) return [];
    const rows: { key: string; v: number }[][] = [];
    for (let wd = 0; wd < 7; wd++) {
      const row: { key: string; v: number }[] = [];
      for (let hr = 6; hr < 24; hr++) {
        const key = `${wd}-${hr}`;
        row.push({ key, v: report.hourDayHeat[key] ?? 0 });
      }
      rows.push(row);
    }
    return rows;
  }, [report]);

  const pomodoroLine = useMemo(() => {
    if (!report) return [];
    const entries = Object.entries(report.pomodoroByDay).sort(([a], [b]) => a.localeCompare(b));
    return entries.slice(-30).map(([k, mins]) => ({ day: k.slice(5), minutes: mins }));
  }, [report]);

  const dualLine = useMemo(() => {
    if (!report) return [];
    return buildDualLine(report.habitDailyDone, report.taskCompletedByDay, Math.min(days, 30));
  }, [report, days]);

  const insights = useMemo(() => insightCards(overview, report, range), [overview, report, range]);

  const focusHrs = Math.round((overview?.pomodoro.totalMinutesToday ?? 0) / 60);

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text md:text-3xl">Analytics</h1>
          <p className="mt-1 text-sm text-text-muted">Habits, tasks, focus time, and patterns.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["today", "7d", "30d", "3m", "all"] as RangeKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setRange(k)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                range === k ? "bg-primary text-white" : "border border-border bg-card text-text-muted"
              }`}
            >
              {k === "today" ? "Today" : k === "7d" ? "7 Days" : k === "30d" ? "30 Days" : k === "3m" ? "3 Months" : "All Time"}
            </button>
          ))}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading ? (
          <>
            {[0, 1, 2, 3].map((i) => (
              <SkeletonCard key={i} className="h-24" lines={2} />
            ))}
          </>
        ) : (
          <>
            <Stat label="Productivity score" value={overview?.productivity.score ?? 0} suffix="/100" />
            <Stat label="Tasks completed (window)" value={overview?.tasks.completedToday ?? 0} suffix="" />
            <Stat label="Habit streak (max)" value={overview?.habits.currentStreak ?? 0} suffix="d" />
            <Stat label="Focus time (today)" value={focusHrs} suffix="h est." />
          </>
        )}
      </section>

      {!loading && session?.user && overview && overview.habits.total === 0 ? (
        <EmptyState
          illustration="chart"
          title="Your journey starts here"
          description="Log a few habits this week — your charts and insights will light up automatically."
          ctaLabel="+ Add your first habit"
          ctaHref="/habits"
        />
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-text">Habit analytics</h2>
        <div className="grid gap-6 lg:grid-cols-1">
          <div className="app-card overflow-x-auto">
            <p className="mb-2 text-sm font-medium text-text-muted">12-week consistency</p>
            <div className="flex gap-1 pb-2" style={{ minWidth: heatmapWeeks.length * 14 }}>
              {heatmapWeeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-1">
                  {week.map((day) => (
                    <div
                      key={day.key}
                      title={`${day.key}: ${day.done}`}
                      className={`h-3 w-3 rounded-sm ${
                        day.done === 0
                          ? "border border-border bg-canvas"
                          : day.done === 1
                            ? "bg-primary/30"
                            : day.done === 2
                              ? "bg-primary/60"
                              : "bg-primary"
                      }`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <ChartCard title="Daily habit completions">
              <div className="h-60 min-h-[240px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineHabit}>
                    <CartesianGrid stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: CHART.tick, fontSize: 10 }} />
                    <YAxis tick={{ fill: CHART.tick, fontSize: 10 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="done" stroke={CHART.primary} strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
            <ChartCard title="Per-habit completion %">
              <div className="h-60 min-h-[240px] w-full min-w-0">
                {radialHabits.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      cx="50%"
                      cy="50%"
                      innerRadius="20%"
                      outerRadius="90%"
                      data={radialHabits}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                      <RadialBar dataKey="value" cornerRadius={6} background={{ fill: CHART.radialTrack }} />
                      <Legend wrapperStyle={{ fontSize: 10, color: CHART.tick }} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-12 text-center text-sm text-text-muted">No habits yet.</p>
                )}
              </div>
            </ChartCard>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-text">Task analytics</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Tasks created vs completed">
            <div className="h-60 min-h-[240px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stackedCreatedDone}>
                  <defs>
                    <linearGradient id="ac1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART.primary} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={CHART.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: CHART.tick, fontSize: 10 }} />
                  <YAxis tick={{ fill: CHART.tick, fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="created" stackId="1" stroke={CHART.blue} fill="url(#ac1)" />
                  <Area type="monotone" dataKey="completed" stackId="2" stroke={CHART.green} fill={`${CHART.green}33`} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          <ChartCard title="Task mix">
            <div className="relative h-60 min-h-[240px] w-full min-w-0">
              {taskDonut.length ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie innerRadius={48} outerRadius={72} data={taskDonut} dataKey="value" nameKey="name" paddingAngle={2}>
                        {taskDonut.map((x, i) => (
                          <Cell key={i} fill={x.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="font-mono text-xl font-semibold text-text">{overview?.tasks.completionRate ?? 0}%</span>
                  </div>
                </>
              ) : (
                <p className="py-12 text-center text-sm text-text-muted">No task data.</p>
              )}
            </div>
          </ChartCard>
          <ChartCard title="Daily task throughput">
            <div className="h-56 min-h-[224px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={taskBarDaily}>
                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: CHART.tick, fontSize: 10 }} />
                  <YAxis tick={{ fill: CHART.tick, fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="done" fill={CHART.primary} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="created" fill={`${CHART.blue}55`} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          <ChartCard title="Completed tasks by priority">
            <div className="h-56 min-h-[224px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityBars} layout="vertical">
                  <CartesianGrid stroke={CHART.grid} horizontal={false} />
                  <XAxis type="number" tick={{ fill: CHART.tick, fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: CHART.tick, fontSize: 10 }} width={60} />
                  <Bar dataKey="count" fill={CHART.amber} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-text">Productivity patterns</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Hour × weekday heat (habit activity)">
            <div className="space-y-0.5 overflow-x-auto">
              {heatRows.map((row, wd) => (
                <div key={wd} className="flex gap-0.5">
                  {row.map((c) => (
                    <div
                      key={c.key}
                      title={c.key}
                      className="h-3 min-w-[12px] flex-1 rounded-sm"
                      style={{
                        backgroundColor: `rgba(99,102,241,${0.08 + Math.min(0.85, c.v * 0.15)})`,
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-text-muted">Rows Sun→Sat · Columns 6am–11pm</p>
          </ChartCard>
          <ChartCard title="Pomodoro minutes / day">
            <div className="h-56 min-h-[224px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pomodoroLine}>
                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: CHART.tick, fontSize: 10 }} />
                  <YAxis tick={{ fill: CHART.tick, fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="minutes" stroke={CHART.green} strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          <ChartCard title="Habit vs task momentum (indexed)" className="lg:col-span-2">
            <div className="h-56 min-h-[224px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dualLine}>
                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: CHART.tick, fontSize: 9 }} />
                  <YAxis tick={{ fill: CHART.tick, fontSize: 10 }} domain={[0, 100]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ color: CHART.tick }} />
                  <Line type="monotone" dataKey="habitRate" name="Habit momentum" stroke={CHART.primary} dot={false} />
                  <Line type="monotone" dataKey="taskRate" name="Task momentum" stroke={CHART.green} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-text">Insights</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {insights.map((ins, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="app-card flex gap-3 text-sm text-text"
            >
              <span className="text-xl">{ins.icon}</span>
              <p dangerouslySetInnerHTML={{ __html: ins.text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") }} />
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  return (
    <motion.div className="app-card" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <p className="text-xs font-medium text-text-muted">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold text-text">
        <CountUp value={value} />
        {suffix ? <span className="text-lg text-text-muted">{suffix}</span> : null}
      </p>
    </motion.div>
  );
}

function ChartCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`app-card ${className ?? ""}`}>
      <p className="mb-2 text-sm font-medium text-text-muted">{title}</p>
      {children}
    </div>
  );
}
