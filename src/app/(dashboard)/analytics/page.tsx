 "use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = {
  date: string;
  key: string;
  done: number;
  skip: number;
  fail: number;
  completion: number;
  heat: number;
  low: number;
  high: number;
  open: number;
  close: number;
};

type GraphType = "line" | "bar" | "candle";

function GraphPanel({ data, type }: { data: Point[]; type: GraphType }) {
  if (type === "line") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
          <XAxis dataKey="date" tick={{ fill: "#a1a1aa", fontSize: 12 }} />
          <YAxis tick={{ fill: "#a1a1aa", fontSize: 12 }} />
          <Tooltip />
          <Line type="monotone" dataKey="done" stroke="#6366f1" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    );
  }
  if (type === "bar") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
          <XAxis dataKey="date" tick={{ fill: "#a1a1aa", fontSize: 12 }} />
          <YAxis tick={{ fill: "#a1a1aa", fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="done" fill="#22c55e" />
          <Bar dataKey="fail" fill="#ef4444" />
        </BarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ScatterChart>
        <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
        <XAxis dataKey="open" type="number" name="Open" tick={{ fill: "#a1a1aa", fontSize: 12 }} />
        <YAxis dataKey="close" type="number" name="Close" tick={{ fill: "#a1a1aa", fontSize: 12 }} />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} />
        <Scatter data={data.map((d) => ({ open: d.open, close: d.close }))} fill="#f59e0b" />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [a, setA] = useState<GraphType>("line");
  const [b, setB] = useState<GraphType>("bar");
  const [fullscreen, setFullscreen] = useState<"a" | "b" | null>(null);

  useEffect(() => {
    fetch("/api/stats/charts")
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load analytics");
        return r.json();
      })
      .then((d) => setData(d.series ?? []))
      .catch(() => {
        setData([]);
        setError("Could not load analytics right now.");
      })
      .finally(() => setLoading(false));
  }, []);

  const heatmapDays = useMemo(() => data.slice(-84), [data]);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Analytics</h1>
      {loading ? <div className="app-card text-zinc-400">Loading analytics...</div> : null}
      {error ? <div className="app-card border-rose-900 text-rose-300">{error}</div> : null}
      <div className="app-card">
        <h2 className="mb-3 text-lg font-semibold">Heatmap (last 12 weeks)</h2>
        <div className="grid grid-cols-14 gap-1" aria-label="Habit heatmap">
          {heatmapDays.map((day) => (
            <div
              key={day.key}
              title={`${day.key}: ${day.heat} completed`}
              className="h-4 rounded-sm"
              style={{
                backgroundColor:
                  day.heat === 0 ? "#27272a" : day.heat === 1 ? "#14532d" : day.heat === 2 ? "#16a34a" : "#22c55e",
              }}
            />
          ))}
        </div>
        {!loading && heatmapDays.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No tracking data yet. Mark habits to see heatmap activity.</p>
        ) : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="app-card">
          <div className="mb-3 flex items-center justify-between">
            <select
              value={a}
              onChange={(e) => setA(e.target.value as GraphType)}
              className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1"
            >
              <option value="line">Line</option>
              <option value="bar">Bar</option>
              <option value="candle">Candle</option>
            </select>
            <button className="rounded-md border border-zinc-700 px-2 py-1" onClick={() => setFullscreen("a")}>
              Fullscreen
            </button>
          </div>
          <GraphPanel data={data} type={a} />
        </div>
        <div className="app-card">
          <div className="mb-3 flex items-center justify-between">
            <select
              value={b}
              onChange={(e) => setB(e.target.value as GraphType)}
              className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1"
            >
              <option value="line">Line</option>
              <option value="bar">Bar</option>
              <option value="candle">Candle</option>
            </select>
            <button className="rounded-md border border-zinc-700 px-2 py-1" onClick={() => setFullscreen("b")}>
              Fullscreen
            </button>
          </div>
          <GraphPanel data={data} type={b} />
        </div>
      </div>
      {fullscreen ? (
        <div className="fixed inset-0 z-50 bg-black/80 p-6">
          <div className="app-card mx-auto h-full w-full max-w-6xl">
            <div className="mb-3 flex justify-end">
              <button className="rounded-md border border-zinc-700 px-2 py-1" onClick={() => setFullscreen(null)}>
                Close
              </button>
            </div>
            <GraphPanel data={data} type={fullscreen === "a" ? a : b} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
