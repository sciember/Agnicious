"use client";

import { format } from "date-fns";
import { motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import clsx from "clsx";
import { Skeleton } from "@/components/ui/skeleton";

const LS_KEY = "habitTrackerAiGamePlan_v1";

type Cached = { date: string; points: string[] };

export function AiGamePlanCard() {
  const { data: session, status } = useSession();
  const [points, setPoints] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = format(new Date(), "yyyy-MM-dd");

  const fetchPlan = useCallback(
    async (opts?: { skipCache?: boolean }): Promise<boolean> => {
      if (status !== "authenticated" || !session?.user) return false;
      if (!opts?.skipCache) {
        try {
          const raw = localStorage.getItem(LS_KEY);
          if (raw) {
            const c = JSON.parse(raw) as Cached;
            if (c?.date === today && Array.isArray(c.points) && c.points.length >= 3) {
              setPoints(c.points.slice(0, 3));
              setError(null);
              return true;
            }
          }
        } catch {
          /* ignore corrupt cache */
        }
      }

      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/ai/game-plan", { method: "POST" });
        const data = (await res.json().catch(() => null)) as { points?: string[]; error?: string } | null;
        if (!res.ok) {
          setError(
            data?.error === "GROQ_API_KEY is not configured"
              ? "AI is not configured yet."
              : (data?.error ?? "Could not load game plan."),
          );
          if (!opts?.skipCache) setPoints(null);
          return false;
        }
        const p = Array.isArray(data?.points) ? data.points.slice(0, 3) : [];
        setPoints(p.length ? p : null);
        if (p.length >= 3) {
          localStorage.setItem(LS_KEY, JSON.stringify({ date: today, points: p } satisfies Cached));
        }
        return p.length > 0;
      } catch {
        setError("Network error.");
        if (!opts?.skipCache) setPoints(null);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [session?.user, status, today],
  );

  useEffect(() => {
    if (status === "authenticated") void fetchPlan();
  }, [fetchPlan, status]);

  async function onRefresh() {
    localStorage.removeItem(LS_KEY);
    const ok = await fetchPlan({ skipCache: true });
    if (ok) toast.success("Game plan updated");
  }

  if (status !== "authenticated") return null;

  return (
    <div className="app-card border border-border/80">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div>
            <h2 className="text-sm font-semibold text-text">AI Game Plan</h2>
            <p className="text-[11px] text-text-muted">Personalized for today · saved in this browser until tomorrow</p>
          </div>
        </div>
        <button
          type="button"
          className="btn-ghost flex items-center gap-1.5 px-2 py-1 text-xs"
          disabled={loading}
          onClick={() => void onRefresh()}
          aria-label="Refresh game plan"
        >
          <RefreshCw className={clsx("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      <div className="mt-4">
        {loading && !points ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[92%]" />
            <Skeleton className="h-4 w-[88%]" />
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-text-muted">
            {error}{" "}
            <Link href="/ai-coach" className="font-medium text-primary hover:underline">
              Open AI Coach
            </Link>
          </p>
        ) : null}

        {points && points.length > 0 ? (
          <ol className="list-decimal space-y-2 pl-4 text-sm text-text marker:font-semibold marker:text-primary">
            {points.map((line, i) => (
              <motion.li
                key={`${i}-${line.slice(0, 24)}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                {line}
              </motion.li>
            ))}
          </ol>
        ) : null}

        {loading && points ? (
          <p className="mt-2 flex items-center gap-2 text-xs text-text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Refreshing…
          </p>
        ) : null}
      </div>

      <p className="mt-4 text-[11px] text-text-muted">
        Want a deeper chat?{" "}
        <Link href="/ai-coach" className="font-medium text-primary hover:underline">
          AI Coach →
        </Link>
      </p>
    </div>
  );
}
