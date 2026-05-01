import Link from "next/link";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/habits", label: "Habits" },
  { href: "/calendar", label: "Calendar" },
  { href: "/analytics", label: "Analytics" },
  { href: "/social", label: "Social" },
  { href: "/ai-coach", label: "AI Coach" },
];

export function AppSidebar() {
  return (
    <aside className="hidden w-64 flex-col gap-2 border-r border-zinc-800 bg-zinc-950 p-4 md:flex">
      <h2 className="mb-4 text-xl font-semibold">Habit Tracker</h2>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-xl px-3 py-2 text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
        >
          {link.label}
        </Link>
      ))}
    </aside>
  );
}
