"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSession } from "next-auth/react";
import clsx from "clsx";
import { parseHabitUiMeta } from "@/lib/habit-ui-meta";
import { Skeleton } from "@/components/ui/skeleton";

type Habit = { id: string; title: string; description: string | null };
type LogRow = {
  id: string;
  habitId: string;
  date: string;
  status: "DONE" | "SKIP" | "FAIL";
};

export function CalendarPageClient() {
  const { data: session } = useSession();
  const [cursor, setCursor] = useState(() => new Date());
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!session?.user?.id) {
      setHabits([]);
      setLogs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const from = subMonths(new Date(), 6).toISOString();
    const [h, l] = await Promise.all([
      fetch("/api/habits").then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/logs?from=${encodeURIComponent(from)}`).then((r) => (r.ok ? r.json() : [])),
    ]);
    setHabits(Array.isArray(h) ? h : []);
    setLogs(Array.isArray(l) ? l : []);
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const logsByDay = useMemo(() => {
    const m = new Map<string, LogRow[]>();
    for (const log of logs) {
      const key = format(new Date(log.date), "yyyy-MM-dd");
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(log);
    }
    return m;
  }, [logs]);

  const habitMap = useMemo(() => new Map(habits.map((h) => [h.id, h])), [habits]);

  const streakSummary = useMemo(() => {
    const doneDays = new Set(
      logs.filter((l) => l.status === "DONE").map((l) => format(new Date(l.date), "yyyy-MM-dd")),
    );
    let current = 0;
    for (let i = 0; i < 400; i++) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = format(d, "yyyy-MM-dd");
      if (doneDays.has(key)) current += 1;
      else break;
    }

    let longest = 0;
    for (const day of doneDays) {
      const prevKey = format(subDays(new Date(day + "T12:00:00"), 1), "yyyy-MM-dd");
      if (doneDays.has(prevKey)) continue;
      let len = 0;
      let cursorDay = day;
      while (doneDays.has(cursorDay)) {
        len += 1;
        cursorDay = format(addDays(new Date(cursorDay + "T12:00:00"), 1), "yyyy-MM-dd");
      }
      longest = Math.max(longest, len);
    }

    return { current, longest };
  }, [logs]);

  const paddingStart = monthStart.getDay();
  const cells = [
    ...Array.from({ length: paddingStart }, (_, i) => ({ type: "pad" as const, key: `p-${i}` })),
    ...days.map((d) => ({ type: "day" as const, date: d, key: format(d, "yyyy-MM-dd") })),
  ];

  const selectedLogs = selected
    ? logs.filter((l) => isSameDay(new Date(l.date), selected))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text md:text-3xl">Calendar</h1>
        <p className="mt-1 text-sm text-text-muted">Tap a day to review habit logs.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="app-card">
          <div className="mb-4 flex items-center justify-between gap-2">
            <button
              type="button"
              className="rounded-full border border-border bg-card p-2 text-text-muted hover:text-text"
              aria-label="Previous month"
              onClick={() => setCursor((d) => subMonths(d, 1))}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <p className="font-mono text-lg font-semibold text-text">{format(cursor, "MMMM yyyy")}</p>
            <button
              type="button"
              className="rounded-full border border-border bg-card p-2 text-text-muted hover:text-text"
              aria-label="Next month"
              onClick={() => setCursor((d) => addMonths(d, 1))}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {loading ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <>
              <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((c) =>
                  c.type === "pad" ? (
                    <div key={c.key} className="aspect-square" />
                  ) : (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setSelected(c.date)}
                      className={clsx(
                        "flex aspect-square flex-col items-start rounded-xl border p-1.5 text-left transition",
                        isSameDay(c.date, new Date())
                          ? "border-primary ring-1 ring-primary/40"
                          : "border-border hover:border-primary/50",
                        selected && isSameDay(c.date, selected) ? "bg-primary-soft" : "bg-canvas",
                      )}
                    >
                      <span className="font-mono text-xs text-text">{format(c.date, "d")}</span>
                      <div className="mt-1 flex flex-wrap gap-0.5">
                        {(logsByDay.get(format(c.date, "yyyy-MM-dd")) ?? [])
                          .filter((l) => l.status === "DONE")
                          .slice(0, 5)
                          .map((l) => {
                            const h = habitMap.get(l.habitId);
                            const meta = parseHabitUiMeta(h?.description ?? null);
                            return (
                              <span
                                key={l.id}
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: meta.accent }}
                                title={h?.title}
                              />
                            );
                          })}
                      </div>
                    </button>
                  ),
                )}
              </div>
            </>
          )}
        </section>

        <aside className="app-card h-fit lg:sticky lg:top-24">
          <h2 className="text-sm font-semibold text-text">Day detail</h2>
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={format(selected, "yyyy-MM-dd")}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mt-3 space-y-3"
              >
                <p className="font-mono text-sm text-primary">{format(selected, "EEEE, MMM d")}</p>
                {selectedLogs.length === 0 ? (
                  <p className="text-sm text-text-muted">No logs for this day.</p>
                ) : (
                  <ul className="space-y-2">
                    {selectedLogs.map((l) => {
                      const h = habitMap.get(l.habitId);
                      const meta = parseHabitUiMeta(h?.description ?? null);
                      return (
                        <li
                          key={l.id}
                          className="flex items-center justify-between rounded-xl border border-border bg-canvas px-3 py-2 text-sm"
                        >
                          <span className="flex items-center gap-2 truncate">
                            <span style={{ color: meta.accent }}>{meta.emoji}</span>
                            <span className="truncate text-text">{h?.title ?? "Habit"}</span>
                          </span>
                          <span
                            className={clsx(
                              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              l.status === "DONE"
                                ? "bg-success/15 text-success"
                                : l.status === "SKIP"
                                  ? "bg-amber/15 text-amber"
                                  : "bg-danger/15 text-danger",
                            )}
                          >
                            {l.status}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </motion.div>
            ) : (
              <p className="mt-3 text-sm text-text-muted">Select a date on the calendar.</p>
            )}
          </AnimatePresence>
        </aside>
      </div>

      <section className="app-card flex flex-wrap gap-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Current streak</p>
          <p className="mt-1 font-mono text-3xl font-semibold text-text">{streakSummary.current}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Longest streak</p>
          <p className="mt-1 font-mono text-3xl font-semibold text-text">{streakSummary.longest}</p>
        </div>
      </section>
    </div>
  );
}
