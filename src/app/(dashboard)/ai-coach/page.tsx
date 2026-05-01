"use client";

import { useState } from "react";

export default function AICoachPage() {
  const [prompt, setPrompt] = useState("I keep skipping evening reading. Help me fix it.");
  const [answer, setAnswer] = useState("");

  async function askCoach() {
    const res = await fetch("/api/ai/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    setAnswer(data.response);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">AI Coach</h1>
      <div className="app-card space-y-3">
        <textarea
          className="h-28 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <button onClick={askCoach} className="rounded-lg bg-indigo-500 px-4 py-2 font-medium text-white">
          Ask AI Coach
        </button>
        {answer ? <p className="text-zinc-200">{answer}</p> : null}
      </div>
    </div>
  );
}
