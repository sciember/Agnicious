"use client";

import { useEffect, useState } from "react";

type Habit = {
  id: string;
  title: string;
  type: string;
  repeatPattern: string;
  lifeArea: string;
};

type Prediction = Record<string, number>;

const defaultHabit = {
  title: "",
  description: "",
  type: "DAILY",
  repeatPattern: "EVERYDAY",
  customWeekdays: [],
  lifeArea: "HEALTH",
};

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [form, setForm] = useState(defaultHabit);
  const [insights, setInsights] = useState<Record<string, string>>({});
  const [predictions, setPredictions] = useState<Prediction>({});

  async function loadHabits() {
    const res = await fetch("/api/habits");
    if (res.ok) setHabits(await res.json());
  }

  async function createHabit() {
    await fetch("/api/habits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm(defaultHabit);
    await loadHabits();
  }

  async function logStatus(habitId: string, status: "DONE" | "SKIP" | "FAIL") {
    await fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ habitId, status, date: new Date().toISOString() }),
    });
    await loadHabits();
  }

  async function applyFreeze(habitId: string) {
    await fetch("/api/streak/freeze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ habitId }),
    });
  }

  async function runFailureAnalysis(habitId: string) {
    const res = await fetch("/api/ai/failure-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ habitId }),
    });
    const data = await res.json();
    setInsights((p) => ({ ...p, [habitId]: data.analysis ?? "No analysis available." }));
  }

  async function fetchPrediction(habitId: string) {
    const res = await fetch(`/api/ai/prediction?habitId=${habitId}`);
    const data = await res.json();
    setPredictions((p) => ({ ...p, [habitId]: Number(data.breakProbability ?? 0) }));
  }

  useEffect(() => {
    fetch("/api/habits")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Habit[]) => setHabits(data))
      .catch(() => setHabits([]));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Habits</h1>
      <div className="app-card space-y-3">
        <h2 className="text-lg font-semibold">Create Habit</h2>
        <input
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
          placeholder="Habit title"
          value={form.title}
          onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
        />
        <button onClick={createHabit} className="rounded-lg bg-indigo-500 px-4 py-2 font-medium text-white">
          Save Habit
        </button>
      </div>
      <div className="grid gap-3">
        {habits.map((habit) => (
          <div key={habit.id} className="app-card">
            <p className="font-semibold">{habit.title}</p>
            <p className="text-sm text-zinc-400">
              {habit.type} • {habit.repeatPattern} • {habit.lifeArea}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="rounded-md bg-emerald-600 px-2 py-1 text-sm" onClick={() => logStatus(habit.id, "DONE")}>
                Done
              </button>
              <button className="rounded-md bg-amber-600 px-2 py-1 text-sm" onClick={() => logStatus(habit.id, "SKIP")}>
                Skip
              </button>
              <button className="rounded-md bg-rose-600 px-2 py-1 text-sm" onClick={() => logStatus(habit.id, "FAIL")}>
                Fail
              </button>
              <button className="rounded-md border border-zinc-700 px-2 py-1 text-sm" onClick={() => applyFreeze(habit.id)}>
                Use Freeze
              </button>
              <button className="rounded-md border border-zinc-700 px-2 py-1 text-sm" onClick={() => runFailureAnalysis(habit.id)}>
                Failure Analysis
              </button>
              <button className="rounded-md border border-zinc-700 px-2 py-1 text-sm" onClick={() => fetchPrediction(habit.id)}>
                Break Risk
              </button>
            </div>
            {predictions[habit.id] !== undefined ? (
              <p className="mt-2 text-sm text-zinc-300">Break probability: {Math.round(predictions[habit.id] * 100)}%</p>
            ) : null}
            {insights[habit.id] ? (
              <p className="mt-2 rounded-md border border-zinc-800 bg-zinc-950 p-2 text-sm text-zinc-300">{insights[habit.id]}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
