"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Bot,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import clsx from "clsx";

const mainNav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/habits", label: "Habits", icon: ListChecks },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

const communityNav = [
  { href: "/social", label: "Social", icon: Users },
  { href: "/ai-coach", label: "AI Coach", icon: Bot },
];

function NavLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
}) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={clsx(
        "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
        active ? "font-medium text-text" : "text-text-muted hover:bg-canvas hover:text-text",
      )}
    >
      {active ? (
        <motion.span
          layoutId="sidebar-active"
          className="absolute inset-0 rounded-xl bg-canvas"
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        />
      ) : null}
      <Icon className="relative z-10 h-4 w-4 shrink-0" strokeWidth={2} />
      <span className="relative z-10">{label}</span>
    </Link>
  );
}

function initials(name: string | null | undefined, email: string | null | undefined) {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    const s = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
    return s.toUpperCase() || "?";
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "?";
}

export function AppSidebar() {
  const { data: session } = useSession();
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    if (!session?.user) {
      setScore(null);
      return;
    }
    fetch("/api/analytics/overview")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setScore(typeof d?.productivity?.score === "number" ? d.productivity.score : null))
      .catch(() => setScore(null));
  }, [session?.user]);

  const gaugeColor =
    score == null ? "#6366f1" : score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <aside className="hidden w-[220px] shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex flex-col gap-2 border-b border-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
            A
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight text-text">Agnicious</p>
            <p className="text-xs text-text-muted">Build better habits</p>
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto p-3">
        <div>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Main</p>
          <div className="space-y-1">
            {mainNav.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Community</p>
          <div className="space-y-1">
            {communityNav.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>
        </div>
      </nav>

      <div className="mt-auto border-t border-border p-3">
        {session?.user ? (
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-canvas px-3 py-2">
            <div className="relative h-10 w-10 shrink-0">
              <svg viewBox="0 0 36 36" className="-rotate-90">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#E5E7EB"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={gaugeColor}
                  strokeWidth="3"
                  strokeDasharray={`${score ?? 0}, 100`}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] font-bold text-text">
                {score ?? "—"}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Score</p>
              <p className="truncate text-xs text-text-muted">Productivity</p>
            </div>
          </div>
        ) : null}
        <div className="flex items-center gap-3 rounded-xl bg-canvas px-2 py-2">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary"
            aria-hidden
          >
            {initials(session?.user?.name, session?.user?.email)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text">{session?.user?.name || "Guest"}</p>
            <p className="truncate text-xs text-text-muted">{session?.user?.email ?? "Not signed in"}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
