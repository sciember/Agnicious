"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import clsx from "clsx";
import Link from "next/link";
import { suggestionsForGoal, type OnboardingGoalKey, type SuggestedHabit } from "@/lib/onboarding";

const GOALS: { key: OnboardingGoalKey; label: string; hint: string }[] = [
  { key: "HEALTH", label: "Health", hint: "Move, sleep, fuel" },
  { key: "PRODUCTIVITY", label: "Productivity", hint: "Focus & output" },
  { key: "LEARNING", label: "Learning", hint: "Skills & depth" },
  { key: "MINDFULNESS", label: "Mindfulness", hint: "Calm & clarity" },
  { key: "CUSTOM", label: "Custom", hint: "Your words" },
];

export default function OnboardingPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<OnboardingGoalKey>("HEALTH");
  const [customLabel, setCustomLabel] = useState("");
  const [picked, setPicked] = useState<SuggestedHabit | null>(null);
  const [reminder, setReminder] = useState("09:00");
  const [submitting, setSubmitting] = useState(false);

  const suggestions = useMemo(() => suggestionsForGoal(goal, customLabel), [goal, customLabel]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/sign-in");
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;
    if (session.user.onboardingCompleted) {
      router.replace("/");
    }
  }, [status, session?.user, router]);

  useEffect(() => {
    setPicked(null);
  }, [goal, customLabel]);

  const finish = useCallback(async () => {
    if (!picked) {
      toast.error("Pick a habit to start.");
      return;
    }
    if (goal === "CUSTOM" && !customLabel.trim()) {
      toast.error("Name your custom goal.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/user/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goal,
        customGoalLabel: goal === "CUSTOM" ? customLabel.trim() : undefined,
        firstHabit: {
          title: picked.title,
          emoji: picked.emoji,
          accent: picked.accent,
          lifeArea: picked.lifeArea,
        },
        reminderTime: reminder,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error("Could not save onboarding.");
      return;
    }
    await update();
    router.replace("/?welcome=1");
  }, [goal, customLabel, picked, reminder, router, update]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-text-muted">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-canvas to-background px-4 py-10 text-text transition-colors duration-300">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 text-center">
          <Link href="/" className="text-sm font-medium text-primary hover:underline">
            ← Back
          </Link>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Welcome to Agnicious</h1>
          <p className="mt-2 text-sm text-text-muted">Three quick steps to personalize your journey.</p>
          <div className="mt-6 flex justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={clsx(
                  "h-2 w-8 rounded-full transition-colors",
                  step === i ? "bg-primary" : "bg-border",
                )}
              />
            ))}
          </div>
        </div>

        <div className="glass-panel p-6 md:p-8">
          <AnimatePresence mode="wait">
            {step === 0 ? (
              <motion.div
                key="s0"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <h2 className="text-lg font-semibold">What&apos;s your main goal?</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {GOALS.map((g) => (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => setGoal(g.key)}
                      className={clsx(
                        "rounded-2xl border px-4 py-3 text-left transition hover:border-primary/50",
                        goal === g.key ? "border-primary bg-primary-soft/40" : "border-border bg-card/50",
                      )}
                    >
                      <p className="font-medium">{g.label}</p>
                      <p className="text-xs text-text-muted">{g.hint}</p>
                    </button>
                  ))}
                </div>
                {goal === "CUSTOM" ? (
                  <input
                    className="input-field mt-2"
                    placeholder="Describe your goal in a few words"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    maxLength={80}
                  />
                ) : null}
                <button type="button" className="btn-primary mt-4 w-full" onClick={() => setStep(1)}>
                  Continue
                </button>
              </motion.div>
            ) : null}

            {step === 1 ? (
              <motion.div
                key="s1"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <h2 className="text-lg font-semibold">Pick your first habit</h2>
                <div className="grid gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s.title}
                      type="button"
                      onClick={() => setPicked(s)}
                      className={clsx(
                        "flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition hover:border-primary/50",
                        picked?.title === s.title ? "border-primary bg-primary-soft/30" : "border-border bg-card/50",
                      )}
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl text-xl" style={{ backgroundColor: `${s.accent}22` }}>
                        {s.emoji}
                      </span>
                      <span className="font-medium">{s.title}</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-ghost flex-1" onClick={() => setStep(0)}>
                    Back
                  </button>
                  <button type="button" className="btn-primary flex-1" onClick={() => setStep(2)} disabled={!picked}>
                    Continue
                  </button>
                </div>
              </motion.div>
            ) : null}

            {step === 2 ? (
              <motion.div
                key="s2"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <h2 className="text-lg font-semibold">Daily reminder time</h2>
                <p className="text-sm text-text-muted">We&apos;ll nudge you around this time to check in.</p>
                <input
                  type="time"
                  className="input-field"
                  value={reminder}
                  onChange={(e) => setReminder(e.target.value)}
                />
                <div className="flex gap-2">
                  <button type="button" className="btn-ghost flex-1" onClick={() => setStep(1)}>
                    Back
                  </button>
                  <button
                    type="button"
                    className="btn-primary flex-1"
                    disabled={submitting}
                    onClick={() => void finish()}
                  >
                    {submitting ? "Saving…" : "Finish"}
                  </button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
