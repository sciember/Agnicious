"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format, isBefore, startOfDay, subDays } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { ChevronLeft, ChevronRight, MoreHorizontal, Trash2, Pencil } from "lucide-react";
import clsx from "clsx";
import { PomodoroTimer } from "./pomodoro-timer";
import { parseHabitUiMeta } from "@/lib/habit-ui-meta";

type Project = {
  id: string;
  name: string;
  color: string;
  icon: string;
  taskCount?: number;
};

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  dueDate: string | null;
  estimatedMins: number | null;
  completedAt: string | null;
  createdAt: string;
  project: { id: string; name: string; color: string; icon: string } | null;
};

type HabitMini = { id: string; title: string; description: string | null };

const PRIORITY_COLORS: Record<string, string> = {
  low: "#60a5fa",
  medium: "#f5a623",
  high: "#fb923c",
  urgent: "#f06060",
};

function priorityLabel(p: string) {
  return p.charAt(0).toUpperCase() + p.slice(1);
}

export function TasksPageClient() {
  const { data: session } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [habits, setHabits] = useState<HabitMini[]>([]);
  const [overviewScore, setOverviewScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"all" | "today">("today");
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [dayCursor, setDayCursor] = useState(() => startOfDay(new Date()));
  const [statusFilter, setStatusFilter] = useState<"all" | "todo" | "inprogress" | "done">("all");
  const [sortBy, setSortBy] = useState<"priority" | "due" | "created">("priority");
  const [formOpen, setFormOpen] = useState(false);
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null);
  const [linkedTask, setLinkedTask] = useState<{ id: string; title: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newProject, setNewProject] = useState({ name: "", icon: "📁", color: "#6366f1" });
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium",
    projectId: "" as string,
    dueDate: "",
    estimatedMins: "" as string | number,
  });

  const dayKey = format(dayCursor, "yyyy-MM-dd");

  const loadProjects = useCallback(async () => {
    const res = await fetch("/api/projects");
    if (!res.ok) return;
    setProjects(await res.json());
  }, []);

  const loadTasks = useCallback(async () => {
    const params = new URLSearchParams();
    if (scope !== "all") params.set("date", dayKey);
    if (projectFilter) params.set("projectId", projectFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    const res = await fetch(`/api/tasks?${params}`);
    if (!res.ok) return;
    let list: TaskRow[] = await res.json();
    if (scope === "today") {
      const start = startOfDay(dayCursor);
      const end = addDays(start, 1);
      list = list.filter((t) => {
        const due = t.dueDate ? new Date(t.dueDate) : null;
        const done = t.completedAt ? new Date(t.completedAt) : null;
        const inDue = due && due >= start && due < end;
        const doneToday = done && done >= start && done < end;
        return inDue || doneToday;
      });
    }
    setTasks(list);
  }, [dayKey, dayCursor, projectFilter, statusFilter, scope]);

  const loadHabitsSummary = useCallback(async () => {
    const [h, o] = await Promise.all([
      fetch("/api/habits").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/analytics/overview").then((r) => (r.ok ? r.json() : null)),
    ]);
    setHabits(Array.isArray(h) ? h : []);
    setOverviewScore(typeof o?.productivity?.score === "number" ? o.productivity.score : null);
  }, []);

  const loadAll = useCallback(async () => {
    if (!session?.user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    await Promise.all([loadProjects(), loadTasks(), loadHabitsSummary()]);
    setLoading(false);
  }, [session?.user, loadProjects, loadTasks, loadHabitsSummary]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!session?.user) return;
    void loadTasks();
  }, [session?.user, loadTasks]);

  const sortedTasks = useMemo(() => {
    const rank = (p: string) =>
      ({ urgent: 4, high: 3, medium: 2, low: 1 }[p] ?? 0);
    const copy = [...tasks];
    copy.sort((a, b) => {
      if (sortBy === "priority") return rank(b.priority) - rank(a.priority);
      if (sortBy === "due") {
        const ad = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        const bd = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        return ad - bd;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return copy;
  }, [tasks, sortBy]);

  const grouped = useMemo(() => {
    const todo = sortedTasks.filter((t) => t.status === "todo");
    const prog = sortedTasks.filter((t) => t.status === "inprogress");
    const done = sortedTasks.filter((t) => t.status === "done");
    return { todo, prog, done };
  }, [sortedTasks]);

  const stats = useMemo(() => {
    const total = sortedTasks.length;
    const c = sortedTasks.filter((t) => t.status === "done").length;
    const pct = total ? Math.round((c / total) * 100) : 0;
    const overdue = sortedTasks.filter(
      (t) =>
        t.status !== "done" &&
        t.dueDate &&
        isBefore(new Date(t.dueDate), startOfDay(new Date())),
    ).length;
    return { total, done: c, pct, overdue, inprog: grouped.prog.length };
  }, [sortedTasks, grouped.prog.length]);

  async function createProject() {
    if (!newProject.name.trim()) return;
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newProject),
    });
    if (!res.ok) {
      toast.error("Could not create project");
      return;
    }
    toast.success("Project created");
    setNewProject({ name: "", icon: "📁", color: "#6366f1" });
    setProjectFormOpen(false);
    await loadProjects();
  }

  async function createTask() {
    if (!newTask.title.trim()) return;
    const payload = {
      title: newTask.title.trim(),
      description: newTask.description || undefined,
      priority: newTask.priority,
      projectId: newTask.projectId || undefined,
      dueDate: newTask.dueDate
        ? new Date(newTask.dueDate + "T12:00:00").toISOString()
        : undefined,
      estimatedMins: newTask.estimatedMins === "" ? undefined : Number(newTask.estimatedMins),
    };
    const res = editingId
      ? await fetch(`/api/tasks/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
    if (!res.ok) {
      toast.error(editingId ? "Could not update task" : "Could not create task");
      return;
    }
    toast.success(editingId ? "Task updated" : "Task created");
    setNewTask({
      title: "",
      description: "",
      priority: "medium",
      projectId: "",
      dueDate: "",
      estimatedMins: "",
    });
    setEditingId(null);
    setFormOpen(false);
    await loadTasks();
    await loadProjects();
  }

  async function toggleDone(task: TaskRow) {
    const next = task.status === "done" ? "todo" : "done";
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) {
      toast.error("Update failed");
      return;
    }
    await loadTasks();
    await loadProjects();
  }

  async function deleteTask(id: string) {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Delete failed");
    toast.success("Task deleted");
    setMenuTaskId(null);
    await loadTasks();
    await loadProjects();
  }

  if (!session?.user) {
    return (
      <div className="app-card py-16 text-center">
        <p className="text-text-muted">Sign in to manage tasks.</p>
        <Link href="/sign-in" className="btn-primary mt-4 inline-block">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 xl:flex-row">
      {/* Left — projects */}
      <aside className="w-full shrink-0 space-y-3 xl:w-[240px]">
        <div className="app-card space-y-3">
          <button
            type="button"
            className="btn-primary w-full text-sm"
            onClick={() => setProjectFormOpen((v) => !v)}
          >
            + New Project
          </button>
          <AnimatePresence>
            {projectFormOpen ? (
              <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} className="space-y-2 overflow-hidden">
                <input
                  className="input-field text-sm"
                  placeholder="Project name"
                  value={newProject.name}
                  onChange={(e) => setNewProject((s) => ({ ...s, name: e.target.value }))}
                />
                <input
                  className="input-field text-sm"
                  placeholder="Emoji"
                  value={newProject.icon}
                  onChange={(e) => setNewProject((s) => ({ ...s, icon: e.target.value }))}
                />
                <div className="flex gap-2">
                  <button type="button" className="btn-primary flex-1 text-xs" onClick={() => void createProject()}>
                    Save
                  </button>
                  <button type="button" className="btn-ghost flex-1 text-xs" onClick={() => setProjectFormOpen(false)}>
                    Cancel
                  </button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <div className="space-y-1 border-t border-border-subtle pt-3">
            <button
              type="button"
              onClick={() => {
                setScope("all");
                setProjectFilter(null);
              }}
              className={clsx(
                "flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm",
                scope === "all" && !projectFilter ? "bg-primary-soft text-primary" : "hover:bg-card",
              )}
            >
              All Tasks
            </button>
            <button
              type="button"
              onClick={() => {
                setScope("today");
                setProjectFilter(null);
                setDayCursor(startOfDay(new Date()));
              }}
              className={clsx(
                "flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm",
                scope === "today" ? "bg-primary-soft text-primary" : "hover:bg-card",
              )}
            >
              Today
            </button>
          </div>
          <div className="space-y-1">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setProjectFilter(p.id);
                  setScope("all");
                }}
                className={clsx(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm",
                  projectFilter === p.id ? "bg-primary-soft text-primary" : "hover:bg-card",
                )}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="flex-1 truncate">{p.icon} {p.name}</span>
                <span className="rounded-full bg-surface px-1.5 text-[10px] text-text-muted">
                  {p.taskCount ?? 0}
                </span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Middle */}
      <main className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-border-subtle p-2"
              onClick={() => setDayCursor((d) => subDays(d, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="min-w-[140px] text-center font-medium text-text">
              {format(dayCursor, "EEEE, MMM d")}
            </p>
            <button
              type="button"
              className="rounded-full border border-border-subtle p-2"
              onClick={() => setDayCursor((d) => addDays(d, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button type="button" className="btn-primary" onClick={() => setFormOpen(true)}>
            Add Task
          </button>
        </div>

        <p className="text-sm text-text-muted">
          {stats.done} of {stats.total} tasks done {stats.total ? `(${stats.pct}%)` : ""}
        </p>

        <div className="flex flex-wrap gap-2">
          {(["all", "todo", "inprogress", "done"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={clsx(
                "rounded-full px-3 py-1 text-xs font-semibold capitalize",
                statusFilter === s ? "bg-primary text-white" : "bg-card text-text-muted border border-border-subtle",
              )}
            >
              {s === "inprogress" ? "In Progress" : s}
            </button>
          ))}
          <select
            className="ml-auto rounded-full border border-border-subtle bg-card px-3 py-1 text-xs text-text"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          >
            <option value="priority">Sort: Priority</option>
            <option value="due">Sort: Due date</option>
            <option value="created">Sort: Created</option>
          </select>
        </div>

        <AnimatePresence>
          {formOpen ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="app-card space-y-3">
              <input
                className="input-field text-lg font-medium"
                placeholder="What needs to be done?"
                value={newTask.title}
                onChange={(e) => setNewTask((s) => ({ ...s, title: e.target.value }))}
              />
              <textarea
                className="input-field min-h-[72px] text-sm"
                placeholder="Description (optional)"
                value={newTask.description}
                onChange={(e) => setNewTask((s) => ({ ...s, description: e.target.value }))}
              />
              <div className="flex flex-wrap gap-2">
                {(["low", "medium", "high", "urgent"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setNewTask((s) => ({ ...s, priority: p }))}
                    className={clsx(
                      "rounded-full px-3 py-1 text-xs font-semibold capitalize",
                      newTask.priority === p ? "ring-2 ring-white/30" : "opacity-80",
                    )}
                    style={{ backgroundColor: PRIORITY_COLORS[p], color: "#0d0d14" }}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <select
                className="input-field text-sm"
                value={newTask.projectId}
                onChange={(e) => setNewTask((s) => ({ ...s, projectId: e.target.value }))}
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                className="input-field text-sm"
                value={newTask.dueDate}
                onChange={(e) => setNewTask((s) => ({ ...s, dueDate: e.target.value }))}
              />
              <input
                type="number"
                className="input-field text-sm"
                placeholder="Estimated minutes"
                value={newTask.estimatedMins}
                onChange={(e) => setNewTask((s) => ({ ...s, estimatedMins: e.target.value }))}
              />
              <div className="flex gap-2">
                <button type="button" className="btn-primary" onClick={() => void createTask()}>
                  Save
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setFormOpen(false);
                    setEditingId(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {loading ? (
          <p className="text-text-muted">Loading…</p>
        ) : (
          <div className="space-y-8">
            {[
              { key: "todo", label: "To do", items: grouped.todo },
              { key: "inprogress", label: "In progress", items: grouped.prog },
              { key: "done", label: "Completed", items: grouped.done },
            ].map((section) =>
              section.items.length ? (
                <div key={section.key}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {section.label}
                  </h3>
                  <ul className="space-y-2">
                    {section.items.map((task) => (
                      <li key={task.id} className="app-card relative flex gap-3 py-3">
                        <button
                          type="button"
                          className={clsx(
                            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                            task.status === "done"
                              ? "border-success bg-success text-background"
                              : "border-border-subtle",
                          )}
                          onClick={() => void toggleDone(task)}
                          aria-label="Toggle done"
                        >
                          {task.status === "done" ? "✓" : ""}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p
                            className={clsx(
                              "font-medium text-text",
                              task.status === "done" && "text-text-muted line-through",
                            )}
                          >
                            {task.title}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                            <span
                              className="rounded-full px-2 py-0.5 font-semibold"
                              style={{
                                backgroundColor: `${PRIORITY_COLORS[task.priority] ?? "#a0a0c0"}33`,
                                color: PRIORITY_COLORS[task.priority] ?? "#a0a0c0",
                              }}
                            >
                              {priorityLabel(task.priority)}
                            </span>
                            {task.project ? (
                              <span className="flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-text-muted">
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ backgroundColor: task.project.color }}
                                />
                                {task.project.name}
                              </span>
                            ) : null}
                            {task.dueDate ? (
                              <span
                                className={clsx(
                                  task.status !== "done" &&
                                    isBefore(new Date(task.dueDate), startOfDay(new Date()))
                                    ? "text-danger"
                                    : "text-text-muted",
                                )}
                              >
                                Due {format(new Date(task.dueDate), "MMM d")}
                              </span>
                            ) : null}
                            {task.estimatedMins != null ? (
                              <span className="text-text-muted">~{task.estimatedMins}m</span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <button
                            type="button"
                            className="text-lg"
                            title="Link to Pomodoro"
                            onClick={() =>
                              setLinkedTask((prev) =>
                                prev?.id === task.id ? null : { id: task.id, title: task.title },
                              )
                            }
                          >
                            🍅
                          </button>
                          <div className="relative">
                            <button
                              type="button"
                              className="rounded-full p-1 text-text-muted hover:text-text"
                              onClick={() => setMenuTaskId(menuTaskId === task.id ? null : task.id)}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {menuTaskId === task.id ? (
                              <div className="absolute right-0 top-full z-10 mt-1 w-36 rounded-xl border border-border-subtle bg-card py-1 shadow-xl">
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                                  onClick={() => {
                                    setEditingId(task.id);
                                    setFormOpen(true);
                                    setNewTask((s) => ({
                                      ...s,
                                      title: task.title,
                                      description: task.description ?? "",
                                      priority: task.priority,
                                      projectId: task.project?.id ?? "",
                                      dueDate: task.dueDate
                                        ? format(new Date(task.dueDate), "yyyy-MM-dd")
                                        : "",
                                      estimatedMins: task.estimatedMins ?? "",
                                    }));
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" /> Edit
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger"
                                  onClick={() => void deleteTask(task.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Delete
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
          </div>
        )}
      </main>

      {/* Right */}
      <aside className="w-full shrink-0 space-y-4 xl:w-[280px]">
        <div className="app-card flex flex-col items-center">
          <div className="relative h-36 w-36">
            <svg viewBox="0 0 100 100" className="-rotate-90">
              <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#6366f1"
                strokeWidth="10"
                strokeDasharray={251}
                strokeDashoffset={251 * (1 - stats.pct / 100)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-2xl font-bold text-text">{stats.pct}%</span>
              <span className="text-[11px] text-text-muted">
                {stats.done}/{stats.total}
              </span>
            </div>
          </div>
          <div className="mt-4 grid w-full grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-xl bg-surface p-2">
              <p className="text-text-muted">Total</p>
              <p className="font-mono text-lg text-text">{stats.total}</p>
            </div>
            <div className="rounded-xl bg-surface p-2">
              <p className="text-text-muted">Done</p>
              <p className="font-mono text-lg text-success">{stats.done}</p>
            </div>
            <div className="rounded-xl bg-surface p-2">
              <p className="text-text-muted">In prog.</p>
              <p className="font-mono text-lg text-info">{stats.inprog}</p>
            </div>
            <div className="rounded-xl bg-surface p-2">
              <p className="text-text-muted">Overdue</p>
              <p className="font-mono text-lg text-danger">{stats.overdue}</p>
            </div>
          </div>
        </div>

        <PomodoroTimer
          linkedTaskId={linkedTask?.id ?? null}
          linkedTaskTitle={linkedTask?.title ?? null}
          onSessionComplete={() => void loadTasks()}
        />

        <div className="app-card">
          <p className="mb-2 text-xs font-semibold uppercase text-text-muted">Today&apos;s habits</p>
          <ul className="space-y-2">
            {habits.slice(0, 6).map((h) => {
              const meta = parseHabitUiMeta(h.description);
              return (
                <li key={h.id} className="flex items-center gap-2 text-sm">
                  <span style={{ color: meta.accent }}>{meta.emoji}</span>
                  <span className="truncate text-text">{h.title}</span>
                </li>
              );
            })}
          </ul>
          <Link href="/habits" className="mt-3 inline-block text-xs font-medium text-primary">
            View habits →
          </Link>
        </div>

        {overviewScore != null ? (
          <div className="app-card text-center">
            <p className="text-xs text-text-muted">Productivity score</p>
            <p className="font-mono text-3xl font-bold text-primary">{overviewScore}</p>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
