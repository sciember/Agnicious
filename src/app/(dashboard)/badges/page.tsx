"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { Lock } from "lucide-react";
import type { BadgeDefinition } from "@/lib/gamification/badges";
import { SkeletonCard } from "@/components/ui/skeleton-card";

type CatalogRow = BadgeDefinition & { earned: boolean };

type EarnedRow = {
  id: string;
  earnedAt: string;
  achievement: { code: string; title: string; description: string };
};

export default function BadgesPage() {
  const { data: session } = useSession();
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [earned, setEarned] = useState<EarnedRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.user) {
      setCatalog([]);
      setEarned([]);
      setLoading(false);
      return;
    }
    const r = await fetch("/api/gamification/badges");
    const d = (await r.json()) as { catalog?: CatalogRow[]; earned?: EarnedRow[] };
    setCatalog(Array.isArray(d.catalog) ? d.catalog : []);
    setEarned(Array.isArray(d.earned) ? d.earned : []);
    setLoading(false);
  }, [session?.user]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text md:text-3xl">Badges</h1>
        <p className="mt-1 text-sm text-text-muted">Unlock achievements as you build habits and consistency.</p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} className="min-h-[120px]" lines={3} />
          ))}
        </div>
      ) : !session?.user ? (
        <p className="text-sm text-text-muted">Sign in to track badges.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.map((b, i) => (
            <motion.div
              key={b.code}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={clsx(
                "app-card relative overflow-hidden",
                !b.earned && "opacity-75 grayscale",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={clsx(
                    "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl",
                    b.earned ? "bg-primary-soft" : "bg-canvas",
                  )}
                  aria-hidden
                >
                  <span className={clsx(!b.earned && "opacity-40")}>🏅</span>
                  {!b.earned ? (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Lock className="h-5 w-5 text-text-muted" strokeWidth={2} aria-hidden />
                    </span>
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-text">{b.title}</p>
                  <p className="mt-1 text-xs text-text-muted">{b.description}</p>
                  {b.xpReward > 0 ? (
                    <p className="mt-2 font-mono text-[11px] text-primary">+{b.xpReward} XP</p>
                  ) : null}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {earned.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-text">Recent unlocks</h2>
          <ul className="space-y-2 text-sm text-text-muted">
            {earned.slice(0, 8).map((e) => (
              <li key={e.id} className="flex justify-between gap-4 rounded-xl border border-border bg-canvas px-3 py-2">
                <span className="font-medium text-text">{e.achievement.title}</span>
                <span className="shrink-0 font-mono text-xs">{new Date(e.earnedAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
