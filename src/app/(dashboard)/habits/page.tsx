"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, startOfDay, subDays } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  BarChart3,
  RefreshCw,
  Snowflake,
  Sparkles,
} from "lucide-react";
import clsx from "clsx";
import { useAuthModal } from "@/components/auth/auth-modal-context";
import { BadgeEarnedModal, type BadgeEarned } from "@/components/gamification/badge-earned-modal";
import { LevelUpModal } from "@/components/gamification/level-up-modal";
import type { XpFloatItem } from "@/components/gamification/xp-float-label";
import { XpFloatLayer } from "@/components/gamification/xp-float-label";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { fireHabitConfetti } from "@/lib/confetti-burst";
import { parseHabitUiMeta, serializeHabitUiMeta } from "@/lib/habit-ui-meta";
import type { OnboardingGoalKey, SuggestedHabit } from "@/lib/onboarding";

type Habit = {
  id: string;
  title: string;
  description: string | null;
  type: "DAILY" | "WEEKLY" | "MONTHLY";
  repeatPattern: string;
  lifeArea: "HEALTH" | "CAREER" | "MIND";
};

type LogRow = { habitId: string; date: string; status: string };

const EMOJIS = ["🔥", "💧", "📚", "🏃", "🧘", "💤", "🍎", "✨"];
const ACCENTS = ["#6366f1", "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#a78bfa", "#ec4899", "#14b8a6"];

const defaultForm = {
  title: "",
  lifeArea: "HEALTH" as Habit["lifeArea"],
  frequency: "daily" as "daily" | "weekly",
  emoji: "🔥",
  accent: "#6366f1",
};

export default function HabitsPage() {
  const { data: session } = useSession();
  const { requireAuth } = useAuthModal();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ title: "", lifeArea: "HEALTH" as Habit["lifeArea"] });
  const [badgeEarned, setBadgeEarned] = useState<BadgeEarned | null>(null);
  const [xpFloats, setXpFloats] = useState<XpFloatItem[]>([]);
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const [levelUpLevel, setLevelUpLevel] = useState(1);
  const prevLevelRef = useRef<number | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<SuggestedHabit[]>([]);
  const [aiSugLoading, setAiSugLoading] = useState(false);
  const [aiSugGoal, setAiSugGoal] = useState<OnboardingGoalKey | null>(null);
  const [aiSugCustomLabel, setAiSugCustomLabel] = useState<string | null>(null);
  const [addingSuggestionKey, setAddingSuggestionKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user?.id) {
      setHabits([]);
      setLogs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const from = subDays(new Date(), 120).toISOString();
    const [h, l] = await Promise.all([
      fetch("/api/habits").then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/logs?from=${encodeURIComponent(from)}`).then((r) => (r.ok ? r.json() : [])),
    ]);
    setHabits(Array.isArray(h) ? h : []);
    setLogs(Array.isArray(l) ? l : []);
    setLoading(false);
  }, [session?.user?.id]);

  function pushXpFloat(clientX: number, clientY: number) {
    const id = crypto.randomUUID();
    setXpFloats((f) => [...f, { id, amount: 10, x: clientX, y: clientY }]);
    window.setTimeout(() => {
      setXpFloats((f) => f.filter((item) => item.id !== id));
    }, 1200);
  }

  useEffect(() => {
    void load();
  }, [load]);

  const fetchAiSuggestions = useCallback(async () => {
    if (!session?.user?.id) {
      setAiSuggestions([]);
      setAiSugGoal(null);
      setAiSugCustomLabel(null);
      return;
    }
    setAiSugLoading(true);
    try {
      const res = await fetch("/api/ai/habit-suggestions", { method: "POST" });
      const data = (await res.json().catch(() => null)) as {
        suggestions?: SuggestedHabit[];
        goal?: OnboardingGoalKey;
        customLabel?: string | null;
      } | null;
      if (res.ok && Array.isArray(data?.suggestions)) {
        setAiSuggestions(data.suggestions);
        setAiSugGoal(data.goal ?? null);
        setAiSugCustomLabel(data.customLabel ?? null);
      } else {
        setAiSuggestions([]);
        setAiSugGoal(null);
        setAiSugCustomLabel(null);
      }
    } finally {
      setAiSugLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    void fetchAiSuggestions();
  }, [fetchAiSuggestions]);

  useEffect(() => {
    if (!session?.user?.id) {
      prevLevelRef.current = null;
      return;
    }
    void fetch("/api/stats/overview")
      .then((r) => (r.ok ? r.json() : null))
      .then((o: { level?: number } | null) => {
        if (typeof o?.level === "number") prevLevelRef.current = o.level;
      });
  }, [session?.user?.id]);

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

  const todayKey = format(startOfDay(new Date()), "yyyy-MM-dd");

  function weekDots(habitId: string) {
    const days = Array.from({ length: 7 }, (_, i) => subDays(startOfDay(new Date()), 6 - i));
    return days.map((d) => {
      const key = format(d, "yyyy-MM-dd");
      const done = logsByDay.get(key)?.has(habitId);
      const isToday = key === todayKey;
      return { key, done, isToday };
    });
  }

  function progressApprox(habitId: string) {
    let hit = 0;
    for (const d of weekDots(habitId)) {
      if (d.done) hit += 1;
    }
    return Math.round((hit / 7) * 100);
  }

  function habitFromApi(raw: unknown): Habit {
    const h = raw as Record<string, unknown>;
    return {
      id: h.id as string,
      title: h.title as string,
      description: (h.description as string | null) ?? null,
      type: h.type as Habit["type"],
      repeatPattern: String(h.repeatPattern),
      lifeArea: h.lifeArea as Habit["lifeArea"],
    };
  }

  async function createHabit() {
    if (!form.title.trim()) {
      toast.error("Name is required.");
      return;
    }
    const description = serializeHabitUiMeta({ emoji: form.emoji, accent: form.accent });
    const habitType = (form.frequency === "daily" ? "DAILY" : "WEEKLY") as Habit["type"];
    const body = {
      title: form.title.trim(),
      description,
      type: habitType,
      repeatPattern: "EVERYDAY",
      customWeekdays: [] as number[],
      lifeArea: form.lifeArea,
    };
    const formSnap = { ...form };
    const tempId = crypto.randomUUID();
    const optimistic: Habit = {
      id: tempId,
      title: body.title,
      description: description ?? null,
      type: habitType,
      repeatPattern: "EVERYDAY",
      lifeArea: body.lifeArea,
    };
    const prevHabits = habits;
    setHabits((h) => [optimistic, ...h]);
    setForm(defaultForm);
    setFormOpen(false);
    const res = await fetch("/api/habits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setHabits(prevHabits);
      setForm(formSnap);
      setFormOpen(true);
      toast.error("Could not create habit.");
      return;
    }
    const server = await res.json();
    setHabits((h) => h.map((x) => (x.id === tempId ? habitFromApi(server) : x)));
    toast.success("Habit created successfully");
    void load();
  }

  async function logDone(habitId: string, sourceEl: HTMLElement | null) {
    const dateIso = new Date().toISOString();
    const optimisticLog: LogRow = { habitId, date: dateIso, status: "DONE" };
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
      id?: string;
      habitId: string;
      date: string;
      status: string;
      gamification?: { newBadges?: BadgeEarned[]; level?: number };
    };
    setLogs((l) => [
      ...l.filter(
        (x) =>
          !(
            x.habitId === habitId &&
            x.status === "DONE" &&
            format(new Date(x.date), "yyyy-MM-dd") === todayKey
          ),
      ),
      { habitId: payload.habitId, date: payload.date, status: payload.status },
    ]);
    const nb = payload.gamification?.newBadges;
    if (nb?.length) {
      setBadgeEarned(nb[0]);
      for (let i = 1; i < nb.length; i++) {
        toast.success(`Badge: ${nb[i].title}`);
      }
    }
    const gl = payload.gamification?.level;
    if (typeof gl === "number") {
      if (prevLevelRef.current !== null && gl > prevLevelRef.current) {
        setLevelUpLevel(gl);
        setLevelUpOpen(true);
      }
      prevLevelRef.current = gl;
    }
    fireHabitConfetti(sourceEl);
    if (sourceEl) {
      const r = sourceEl.getBoundingClientRect();
      pushXpFloat(r.left + r.width / 2, r.top);
    }
    toast.success("Habit logged! 🔥 Keep it up");
    void load();
  }

  async function addFromSuggestion(s: SuggestedHabit) {
    const key = `${s.title}::${s.emoji}`;
    setAddingSuggestionKey(key);
    const description = serializeHabitUiMeta({ emoji: s.emoji, accent: s.accent }) ?? null;
    const body = {
      title: s.title.trim(),
      ...(description ? { description } : {}),
      type: "DAILY" as const,
      repeatPattern: "EVERYDAY" as const,
      customWeekdays: [] as number[],
      lifeArea: s.lifeArea,
    };
    const tempId = crypto.randomUUID();
    const optimistic: Habit = {
      id: tempId,
      title: body.title,
      description,
      type: "DAILY",
      repeatPattern: "EVERYDAY",
      lifeArea: body.lifeArea,
    };
    const prevHabits = habits;
    setHabits((h) => [optimistic, ...h]);
    const res = await fetch("/api/habits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setAddingSuggestionKey(null);
    if (!res.ok) {
      setHabits(prevHabits);
      toast.error("Could not add habit.");
      return;
    }
    const server = await res.json();
    setHabits((h) => h.map((x) => (x.id === tempId ? habitFromApi(server) : x)));
    setAiSuggestions((list) => list.filter((x) => x.title !== s.title));
    toast.success("Habit added");
    void load();
  }

  async function applyFreeze(habitId: string) {
    const res = await fetch("/api/streak/freeze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ habitId }),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      toast.error(payload?.error ?? "Unable to use freeze.");
      return;
    }
    toast("Streak freeze used!", { icon: "❄️" });
    await load();
  }

  async function deleteHabit(id: string) {
    const prevHabits = habits;
    const prevLogs = logs;
    setHabits((h) => h.filter((x) => x.id !== id));
    setLogs((l) => l.filter((x) => x.habitId !== id));
    setMenuOpenId(null);
    const res = await fetch(`/api/habits/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setHabits(prevHabits);
      setLogs(prevLogs);
      toast.error("Could not delete.");
      return;
    }
    toast.success("Habit archived.");
    void load();
  }

  async function saveEdit(id: string, description: string | null) {
    const prev = habits.find((h) => h.id === id);
    if (!prev) return;
    const next: Habit = {
      ...prev,
      title: editDraft.title.trim(),
      lifeArea: editDraft.lifeArea,
      description,
    };
    setHabits((hs) => hs.map((h) => (h.id === id ? next : h)));
    setEditId(null);
    const res = await fetch(`/api/habits/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editDraft.title.trim(),
        lifeArea: editDraft.lifeArea,
        description,
      }),
    });
    if (!res.ok) {
      setHabits((hs) => hs.map((h) => (h.id === id ? prev : h)));
      setEditId(id);
      setEditDraft({ title: prev.title, lifeArea: prev.lifeArea });
      toast.error("Could not save.");
      return;
    }
    const server = await res.json();
    setHabits((hs) => hs.map((h) => (h.id === id ? habitFromApi(server) : h)));
    toast.success("Habit updated.");
    void load();
  }

  const openNewForm = requireAuth(() => setFormOpen(true));

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text md:text-3xl">Habits</h1>
          <p className="mt-1 text-sm text-text-muted">Create routines, track streaks, stay consistent.</p>
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          className="btn-primary self-start px-5"
          onClick={openNewForm}
        >
          + New Habit
        </motion.button>
      </div>

      {session?.user ? (
        <section className="app-card border border-border/80">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
              <div>
                <h2 className="text-sm font-semibold text-text">AI suggestions</h2>
                <p className="mt-0.5 text-[11px] text-text-muted">
                  {aiSugGoal === "CUSTOM" && aiSugCustomLabel
                    ? `Tailored to: ${aiSugCustomLabel}. Refresh for a new mix.`
                    : aiSugGoal
                      ? `Tailored to your goal: ${aiSugGoal.toLowerCase()}. Refresh for a new mix.`
                      : "Five ideas you can add in one tap — refresh for a new mix."}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn-ghost flex items-center gap-1.5 px-2 py-1 text-xs"
              disabled={aiSugLoading}
              onClick={requireAuth(() => void fetchAiSuggestions())}
              aria-label="Refresh AI suggestions"
            >
              <RefreshCw className={clsx("h-3.5 w-3.5", aiSugLoading && "animate-spin")} />
              Refresh
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {aiSugLoading && aiSuggestions.length === 0 ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-[96%]" />
              </div>
            ) : null}
            {aiSuggestions.map((s) => {
              const rowKey = `${s.title}::${s.emoji}`;
              const busy = addingSuggestionKey === rowKey;
              return (
                <div
                  key={rowKey}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-canvas px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-lg" aria-hidden>
                      {s.emoji}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text">{s.title}</p>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">{s.lifeArea}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-primary shrink-0 px-3 py-1.5 text-xs"
                    disabled={busy || aiSugLoading}
                    onClick={requireAuth(() => void addFromSuggestion(s))}
                  >
                    {busy ? "Adding…" : "+ Add"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <AnimatePresence initial={false}>
        {formOpen ? (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="app-card space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-text">New habit</h2>
                <button type="button" className="text-sm text-text-muted hover:text-text" onClick={() => setFormOpen(false)}>
                  Close
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-text-muted">Name</span>
                  <input
                    className="input-field"
                    value={form.title}
                    onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                    placeholder="Morning run"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-text-muted">Category</span>
                  <select
                    className="input-field"
                    value={form.lifeArea}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, lifeArea: e.target.value as Habit["lifeArea"] }))
                    }
                  >
                    <option value="HEALTH">Health</option>
                    <option value="CAREER">Career</option>
                    <option value="MIND">Mind</option>
                  </select>
                </label>
              </div>
              <div>
                <span className="text-xs font-medium text-text-muted">Frequency</span>
                <div className="mt-2 flex rounded-xl border border-border bg-canvas p-1">
                  {(
                    [
                      ["daily", "Daily"],
                      ["weekly", "Weekly"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={clsx(
                        "flex-1 rounded-lg py-2 text-sm font-medium transition",
                        form.frequency === key ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-text",
                      )}
                      onClick={() => setForm((s) => ({ ...s, frequency: key }))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-xs font-medium text-text-muted">Emoji</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setForm((s) => ({ ...s, emoji: e }))}
                      className={clsx(
                        "flex h-10 w-10 items-center justify-center rounded-xl border text-lg transition",
                        form.emoji === e
                          ? "border-primary bg-primary-soft"
                          : "border-border bg-card hover:border-primary/40",
                      )}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-xs font-medium text-text-muted">Accent</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ACCENTS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Color ${c}`}
                      className={clsx(
                        "h-8 w-8 rounded-full border-2 transition",
                        form.accent === c ? "border-border ring-2 ring-primary ring-offset-2 ring-offset-card" : "border-transparent",
                      )}
                      style={{ backgroundColor: c }}
                      onClick={() => setForm((s) => ({ ...s, accent: c }))}
                    />
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <button type="button" className="btn-primary" onClick={requireAuth(() => void createHabit())}>
                  Save
                </button>
                <button type="button" className="btn-ghost" onClick={() => setFormOpen(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>

      {loading ? (
        <div className="space-y-3">
          <SkeletonCard className="h-28 w-full" lines={2} />
          <SkeletonCard className="h-28 w-full" lines={2} />
        </div>
      ) : null}

      {!loading && habits.length === 0 ? (
        <EmptyState
          illustration="journey"
          title="Your journey starts here"
          description="Small steps compound. Pick one habit, keep it visible, and log it daily."
          ctaLabel="+ Add your first habit"
          onCta={openNewForm}
        />
      ) : null}

      <div className="space-y-3">
        {!loading &&
          habits.map((habit) => {
            const meta = parseHabitUiMeta(habit.description);
            const dots = weekDots(habit.id);
            const pct = progressApprox(habit.id);
            const doneToday = logs.some(
              (l) =>
                l.habitId === habit.id &&
                l.status === "DONE" &&
                format(new Date(l.date), "yyyy-MM-dd") === todayKey,
            );
            const menuOpen = menuOpenId === habit.id;
            const editing = editId === habit.id;

            return (
              <div key={habit.id} className="app-card relative">
                {editing ? (
                  <div className="space-y-3">
                    <input
                      className="input-field"
                      value={editDraft.title}
                      onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                    />
                    <select
                      className="input-field"
                      value={editDraft.lifeArea}
                      onChange={(e) =>
                        setEditDraft((d) => ({ ...d, lifeArea: e.target.value as Habit["lifeArea"] }))
                      }
                    >
                      <option value="HEALTH">Health</option>
                      <option value="CAREER">Career</option>
                      <option value="MIND">Mind</option>
                    </select>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={requireAuth(() => void saveEdit(habit.id, habit.description))}
                      >
                        Save
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => setEditId(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 md:flex-row md:items-center">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl"
                        style={{ backgroundColor: `${meta.accent}22`, color: meta.accent }}
                      >
                        {meta.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-text">{habit.title}</p>
                          <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
                            {habit.lifeArea}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <span className="text-xs text-text-muted">
                            Streak-ready · <span className="font-mono text-text">{pct}%</span> week
                          </span>
                          <div className="flex gap-1">
                            {dots.map((d) => (
                              <span
                                key={d.key}
                                className={clsx(
                                  "h-2.5 w-2.5 rounded-full border",
                                  d.done ? "border-success/30 bg-success" : "border-border bg-card",
                                  d.isToday && !d.done ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : "",
                                )}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-canvas">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: meta.accent }}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.35 }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 md:flex-col md:items-end lg:flex-row lg:items-center">
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.9 }}
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-canvas text-lg text-primary hover:bg-primary-soft disabled:opacity-40"
                        disabled={doneToday}
                        onClick={(e) => {
                          requireAuth(() => void logDone(habit.id, e.currentTarget))();
                        }}
                        aria-label="Log done"
                      >
                        ✓
                      </motion.button>
                      <div className="relative">
                        <button
                          type="button"
                          className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-text-muted hover:text-text"
                          aria-label="Menu"
                          onClick={() => setMenuOpenId(menuOpen ? null : habit.id)}
                        >
                          <MoreHorizontal className="h-5 w-5" />
                        </button>
                        {menuOpen ? (
                          <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-xl border border-border bg-card py-1 shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text hover:bg-canvas"
                              onClick={() => {
                                setEditDraft({ title: habit.title, lifeArea: habit.lifeArea });
                                setEditId(habit.id);
                                setMenuOpenId(null);
                              }}
                            >
                              <Pencil className="h-4 w-4" /> Edit
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text hover:bg-canvas"
                              onClick={requireAuth(() => void deleteHabit(habit.id))}
                            >
                              <Trash2 className="h-4 w-4" /> Delete
                            </button>
                            <Link
                              href="/analytics"
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text hover:bg-canvas"
                              onClick={() => setMenuOpenId(null)}
                            >
                              <BarChart3 className="h-4 w-4" /> Stats
                            </Link>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text hover:bg-canvas"
                              onClick={() => {
                                setMenuOpenId(null);
                                requireAuth(() => void applyFreeze(habit.id))();
                              }}
                            >
                              <Snowflake className="h-4 w-4" /> Use streak freeze
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
    <XpFloatLayer items={xpFloats} />
    <BadgeEarnedModal badge={badgeEarned} onClose={() => setBadgeEarned(null)} />
    <LevelUpModal open={levelUpOpen} level={levelUpLevel} onClose={() => setLevelUpOpen(false)} />
    </>
  );
}
