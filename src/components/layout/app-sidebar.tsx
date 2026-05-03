"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  Settings,
  Users,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { LucideIcon } from "lucide-react";
import clsx from "clsx";
import { useAuthModal } from "@/components/auth/auth-modal-context";
import { UserAvatar } from "@/components/ui/user-avatar";
import { publicDisplayName } from "@/lib/user-public";

const mainNav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/habits", label: "Habits", icon: ListChecks },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

const prefetchRoutes = [
  "/",
  "/tasks",
  "/habits",
  "/calendar",
  "/analytics",
  "/social",
  "/ai-coach",
  "/notifications",
  "/settings",
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
        "relative flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
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

function NotificationsNavLink() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [unread, setUnread] = useState<number | null>(null);
  const active = pathname === "/notifications" || pathname.startsWith("/notifications/");

  useEffect(() => {
    if (!session?.user) {
      setUnread(null);
      return;
    }
    let cancelled = false;
    async function poll() {
      const r = await fetch("/api/notifications?summary=1");
      if (!r.ok || cancelled) return;
      const d = (await r.json()) as { unreadCount?: number };
      if (!cancelled) setUnread(typeof d.unreadCount === "number" ? d.unreadCount : 0);
    }
    void poll();
    const id = setInterval(poll, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [session?.user]);

  const badge = unread != null && unread > 0 ? (unread > 9 ? "9+" : String(unread)) : null;

  return (
    <Link
      href="/notifications"
      className={clsx(
        "relative flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
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
      <span className="relative z-10 flex shrink-0 items-center">
        <Bell className="h-4 w-4" strokeWidth={2} />
        {badge ? (
          <span className="absolute -right-1.5 -top-1 min-w-[16px] rounded-full bg-red-500 px-0.5 text-center text-[9px] font-bold leading-4 text-white">
            {badge}
          </span>
        ) : null}
      </span>
      <span className="relative z-10">Notifications</span>
    </Link>
  );
}

type MeProfile = {
  displayName: string | null;
  name: string | null;
  avatarUrl: string | null;
};

export function AppSidebar() {
  const { data: session } = useSession();
  const { openAuthModal } = useAuthModal();
  const router = useRouter();
  const [score, setScore] = useState<number | null>(null);
  const [me, setMe] = useState<MeProfile | null>(null);

  useEffect(() => {
    prefetchRoutes.forEach((href) => router.prefetch(href));
  }, [router]);

  useEffect(() => {
    if (!session?.user) {
      setScore(null);
      setMe(null);
      return;
    }
    fetch("/api/analytics/overview")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setScore(typeof d?.productivity?.score === "number" ? d.productivity.score : null))
      .catch(() => setScore(null));
    fetch("/api/settings/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((p: MeProfile | null) => setMe(p))
      .catch(() => setMe(null));
  }, [session?.user]);

  const gaugeColor =
    score == null ? "#6366f1" : score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";

  const photoUrl = me?.avatarUrl || null;
  const label = me ? publicDisplayName(me.displayName, me.name) : publicDisplayName(session?.user?.name, session?.user?.name);
  const seed = session?.user?.id ?? "guest";

  return (
    <aside className="hidden w-[220px] shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex flex-col gap-2 border-b border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">A</div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight text-text">Agnicious</p>
              <p className="text-xs text-text-muted">Build better habits</p>
            </div>
          </div>
          <ThemeToggle className="shrink-0" />
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
            <NotificationsNavLink />
            <NavLink href="/social" label="Social" icon={Users} />
            <NavLink href="/ai-coach" label="AI Coach" icon={Bot} />
          </div>
        </div>
      </nav>

      <div className="mt-auto border-t border-border p-3">
        {session?.user ? (
          <>
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
            <Link
              href="/settings"
              className="mb-2 flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-xl border border-border bg-canvas px-3 py-2.5 transition hover:border-primary/40 hover:bg-card"
            >
              <UserAvatar photoUrl={photoUrl} displayName={label} seed={seed} size={40} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-text">{label}</span>
              <Settings className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
            </Link>
          </>
        ) : (
          <button
            type="button"
            onClick={openAuthModal}
            className="mb-2 w-full cursor-pointer rounded-xl bg-indigo-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Sign In
          </button>
        )}
      </div>
    </aside>
  );
}
