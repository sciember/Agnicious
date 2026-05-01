import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-start justify-center gap-8 px-6 py-20">
      <p className="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-1 text-sm text-zinc-300">
        Habit Tracker SaaS Starter
      </p>
      <h1 className="max-w-3xl text-5xl font-bold tracking-tight">
        Build consistency with AI coaching, streaks, social accountability, and life score.
      </h1>
      <p className="max-w-2xl text-lg text-zinc-400">
        Production-ready Next.js + Prisma architecture with habit logs, analytics, and gamification.
      </p>
      <div className="flex gap-3">
        <Link href="/dashboard" className="rounded-xl bg-indigo-500 px-5 py-3 font-medium text-white hover:bg-indigo-400">
          Open Dashboard
        </Link>
        <Link href="/sign-in" className="rounded-xl border border-zinc-700 px-5 py-3 font-medium hover:bg-zinc-900">
          Sign In
        </Link>
      </div>
    </main>
  );
}
