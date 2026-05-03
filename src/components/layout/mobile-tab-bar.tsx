"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, CalendarDays, ClipboardList, Home, ListChecks, Users } from "lucide-react";
import clsx from "clsx";

const tabs = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/tasks", icon: ClipboardList, label: "Tasks" },
  { href: "/habits", icon: ListChecks, label: "Habits" },
  { href: "/calendar", icon: CalendarDays, label: "Cal" },
  { href: "/analytics", icon: BarChart3, label: "Stats" },
  { href: "/social", icon: Users, label: "Social" },
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
              "flex flex-1 cursor-pointer flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
              active ? "text-primary" : "text-text-muted",
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 2} />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
