"use client";

import { useEffect, useState } from "react";

type Habit = {
  id: string;
  title: string;
  type: string;
  repeatPattern: string;
  lifeArea: string;
};

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
          </div>
        ))}
      </div>
    </div>
  );
}
