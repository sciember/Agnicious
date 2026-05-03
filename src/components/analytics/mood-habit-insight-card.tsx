"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { MoodHabitInsightPayload } from "@/lib/mood-habit-insight";

export function MoodHabitInsightCard() {
  const { data: session } = useSession();
  const [data, setData] = useState<MoodHabitInsightPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/analytics/mood-habits");
        if (!res.ok) return;
        const json = (await res.json()) as MoodHabitInsightPayload;
        if (!cancelled) setData(json);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  if (!session?.user?.id) return null;

  if (loading) {
    return (
      <div className="app-card animate-pulse space-y-3">
        <div className="h-5 w-56 rounded bg-border" />
        <div className="h-12 w-full rounded bg-border" />
      </div>
    );
  }

  if (!data || data.daysWithMood === 0) {
    return (
      <div className="app-card">
        <h3 className="text-sm font-semibold text-text">Mood × habits</h3>
        <p className="mt-2 text-sm text-text-muted">
          Log mood on the dashboard for a few weeks — we&apos;ll compare how you feel on heavier habit days vs lighter ones.
        </p>
      </div>
    );
  }

  const heavy = data.avgMoodHeavyDays;
  const light = data.avgMoodLightDays;
  const t = data.heavyThreshold;

  let body: string;
  if (data.enoughData && heavy != null && light != null) {
    const diff = Math.round((heavy - light) * 10) / 10;
    let cmp: string;
    if (diff > 0.15) {
      cmp = `That's about **${diff.toFixed(1)} points** higher than quieter habit days.`;
    } else if (diff < -0.15) {
      cmp =
        "On lighter habit days your mood was a bit higher on average — recovery days matter too.";
    } else {
      cmp = "Both buckets look similar — small differences, keep experimenting.";
    }
    body = `Over the last **${data.windowDays} days**, on days with **${t}+** habit completions your mood averaged **${heavy}/5** (${data.heavyDayCount} days). On days below **${t}** completions it averaged **${light}/5** (${data.lightDayCount} days). ${cmp}`;
  } else {
    body = `We're tracking mood across **${data.daysWithMood}** days (${data.windowDays}-day window). Need at least **3** days in each bucket (heavy vs light habit days) with mood logs — keep checking in.`;
  }

  return (
    <div className="app-card">
      <h3 className="text-sm font-semibold text-text">Mood × habits</h3>
      <p
        className="mt-3 text-sm leading-relaxed text-text"
        dangerouslySetInnerHTML={{
          __html: body.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"),
        }}
      />
    </div>
  );
}
