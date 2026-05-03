"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import clsx from "clsx";
import { useAuthGate } from "@/components/auth/auth-gate-context";

type Mode = "focus" | "short" | "long";

const MODE_SEC: Record<Mode, number> = {
  focus: 25 * 60,
  short: 5 * 60,
  long: 15 * 60,
};

function formatMmSs(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function PomodoroTimer(props: {
  linkedTaskId: string | null;
  linkedTaskTitle: string | null;
  onSessionComplete?: () => void;
}) {
  const { linkedTaskId, linkedTaskTitle, onSessionComplete } = props;
  const { data: session } = useSession();
  const { openAuthModal } = useAuthGate();
  const [mode, setMode] = useState<Mode>("focus");
  const [remaining, setRemaining] = useState(MODE_SEC.focus);
  const [running, setRunning] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const circumference = 2 * Math.PI * 45;
  const total = MODE_SEC[mode];
  const progress = 1 - remaining / total;
  const offset = circumference * (1 - progress);

  const loadToday = useCallback(async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const res = await fetch(`/api/pomodoro?from=${encodeURIComponent(start.toISOString())}`);
    if (!res.ok) return;
    const sessions = (await res.json()) as unknown[];
    setTodayCount(sessions.length);
  }, []);

  useEffect(() => {
    void loadToday();
  }, [loadToday]);

  const completeRound = useCallback(async () => {
    const m = modeRef.current;
    const durMin = Math.round(MODE_SEC[m] / 60);
    try {
      if (m === "focus") {
        await fetch("/api/pomodoro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId: linkedTaskId,
            duration: durMin,
            completed: true,
          }),
        });
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("Focus session complete", {
            body: linkedTaskTitle ? `Nice work on “${linkedTaskTitle}”` : "Take a short break.",
          });
        }
        await loadToday();
        onSessionComplete?.();
        setMode("short");
        modeRef.current = "short";
        setRemaining(MODE_SEC.short);
        setRunning(true);
      } else {
        await fetch("/api/pomodoro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: null, duration: durMin, completed: true }),
        });
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("Break complete", { body: "Back to focus when ready." });
        }
        await loadToday();
        setMode("focus");
        modeRef.current = "focus";
        setRemaining(MODE_SEC.focus);
        setRunning(false);
      }
    } catch {
      /* ignore */
    }
  }, [linkedTaskId, linkedTaskTitle, loadToday, onSessionComplete]);

  useEffect(() => {
    if (!running) {
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }
    tickRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          void completeRound();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [running, completeRound]);

  function startPause() {
    if (!session?.user && !running) {
      openAuthModal();
      return;
    }
    if (!running && remaining === MODE_SEC[mode]) {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        void Notification.requestPermission();
      }
    }
    if (!running && remaining === 0) {
      setRemaining(MODE_SEC[mode]);
    }
    setRunning((x) => !x);
  }

  function reset() {
    setRunning(false);
    setRemaining(MODE_SEC[mode]);
  }

  function switchMode(m: Mode) {
    setMode(m);
    modeRef.current = m;
    setRunning(false);
    setRemaining(MODE_SEC[m]);
  }

  const tomatoSlots = 8;
  const filled = Math.min(todayCount, tomatoSlots);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="mb-2 text-center text-[11px] font-medium uppercase tracking-wide text-text-muted">
        Pomodoro
      </p>
      {linkedTaskTitle ? (
        <p className="mb-3 truncate text-center text-xs text-primary" title={linkedTaskTitle}>
          🎯 {linkedTaskTitle}
        </p>
      ) : (
        <p className="mb-3 text-center text-xs text-text-muted">Pick a task and tap 🍅 below</p>
      )}

      <div className="mb-3 flex justify-center gap-1">
        {(["focus", "short", "long"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={clsx(
              "rounded-full px-2 py-1 text-[10px] font-semibold capitalize",
              mode === m ? "bg-primary text-white" : "bg-canvas text-text-muted hover:text-text",
            )}
          >
            {m === "focus" ? "Focus" : m === "short" ? "Short" : "Long"}
          </button>
        ))}
      </div>

      <div className="relative mx-auto h-36 w-36">
        <svg className="-rotate-90 transform" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#E5E7EB" strokeWidth="8" />
          <motion.circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#6366f1"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.35 }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-mono text-2xl font-semibold text-text">
          {formatMmSs(remaining)}
        </div>
      </div>

      <div className="mt-4 flex justify-center gap-2">
        <button type="button" className="btn-primary px-4 py-2 text-sm" onClick={startPause}>
          {running ? "Pause" : "Start"}
        </button>
        <button type="button" className="btn-ghost px-4 py-2 text-sm" onClick={reset}>
          Reset
        </button>
      </div>

      <p className="mt-3 text-center text-[11px] text-text-muted">Sessions today</p>
      <div className="mt-1 flex justify-center gap-0.5 text-base">
        {Array.from({ length: tomatoSlots }, (_, i) => (
          <span key={i}>{i < filled ? "🍅" : "○"}</span>
        ))}
      </div>
      <p className="mt-1 text-center font-mono text-xs text-text-muted">{todayCount} completed</p>
    </div>
  );
}
