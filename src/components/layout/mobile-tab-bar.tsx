"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BarChart3, Bot, CalendarDays, ClipboardList, Home, ListChecks } from "lucide-react";
import clsx from "clsx";

const tabs = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/tasks", icon: ClipboardList, label: "Tasks" },
  { href: "/habits", icon: ListChecks, label: "Habits" },
  { href: "/calendar", icon: CalendarDays, label: "Cal" },
  { href: "/analytics", icon: BarChart3, label: "Stats" },
  { href: "/ai-coach", icon: Bot, label: "Coach" },
];

const extraPrefetch = ["/ai-coach", "/notifications", "/settings"];

export function MobileTabBar() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    tabs.forEach((t) => router.prefetch(t.href));
    extraPrefetch.forEach((href) => router.prefetch(href));
  }, [router]);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      aria-label="Primary"
    >
      {tabs.map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <button
            key={tab.href}
            type="button"
            onClick={() => router.push(tab.href)}
            className={clsx(
              "relative flex flex-1 cursor-pointer flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
              active ? "text-primary" : "text-text-muted",
            )}
          >
            {active ? (
              <motion.span
                layoutId="tabbar-pill"
                className="absolute inset-x-1 top-1 -z-0 rounded-2xl bg-primary/15"
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                style={{ bottom: "0.25rem" }}
              />
            ) : null}
            <motion.span
              className="relative z-10 flex flex-col items-center gap-0.5"
              animate={active ? { y: [0, -3, 0] } : { y: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 18 }}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 2} />
              {tab.label}
            </motion.span>
          </button>
        );
      })}
    </nav>
  );
}
