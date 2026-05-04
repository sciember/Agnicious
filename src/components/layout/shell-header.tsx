"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useAuthModal } from "@/components/auth/auth-modal-context";
import { FEATURE_SHOP_AND_BADGES } from "@/lib/feature-gamification";
import { Menu } from "lucide-react";
import { useMobileSidebar } from "@/components/layout/mobile-sidebar-context";

type HeaderStats = { xp: number; level: number; coins: number };

export function ShellHeader() {
  const { data: session, status } = useSession();
  const { openAuthModal } = useAuthModal();
  const { openSidebar } = useMobileSidebar();
  const [stats, setStats] = useState<HeaderStats | null>(null);

  useEffect(() => {
    if (!session?.user) {
      setStats(null);
      return;
    }
    let cancelled = false;
    fetch("/api/stats/overview")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: HeaderStats | null) => {
        if (!cancelled && d && typeof d.xp === "number") {
          setStats({ xp: d.xp, level: d.level, coins: d.coins });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session?.user]);

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card/80 text-text shadow-sm backdrop-blur-sm transition hover:border-primary/40 hover:bg-primary-soft/50 md:hidden"
          aria-label="Open menu"
          onClick={openSidebar}
        >
          <Menu className="h-4 w-4" />
        </button>
        {session?.user && stats ? (
          <div className="flex min-w-0 items-center gap-3 text-[11px] font-mono text-text-muted sm:text-xs">
            <span className="truncate">
              Lvl <span className="font-semibold text-text">{stats.level}</span>
            </span>
            <span className="hidden sm:inline">{stats.xp} XP</span>
            {FEATURE_SHOP_AND_BADGES ? (
              <span className="truncate">
                🪙 <span className="font-semibold text-text">{stats.coins}</span>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {status !== "loading" && !session?.user ? (
        <button type="button" className="btn-primary text-xs sm:text-sm" onClick={openAuthModal}>
          Sign In
        </button>
      ) : (
        <span className="w-px" aria-hidden />
      )}
    </header>
  );
}
