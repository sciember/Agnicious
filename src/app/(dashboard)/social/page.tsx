"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import clsx from "clsx";

type Friend = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "BLOCKED";
  requesterId: string;
  addresseeId: string;
  requester: { id: string; name: string | null; email: string };
  addressee: { id: string; name: string | null; email: string };
};

type Feed = { id: string; message: string; createdAt: string };
type Challenge = {
  id: string;
  title: string;
  durationDays: number;
  joined: boolean;
  progress: number;
  completedAt: string | null;
};

type Leader = {
  id: string;
  name: string | null;
  image: string | null;
  xp: number;
  level: number;
};

function initials(name: string | null | undefined, fallback: string) {
  if (name?.trim()) {
    const p = name.trim().split(/\s+/);
    return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || fallback.slice(0, 2).toUpperCase();
  }
  return fallback.slice(0, 2).toUpperCase();
}

export default function SocialPage() {
  const { data: session } = useSession();
  const [currentUserId, setCurrentUserId] = useState("");
  const [targetEmail, setTargetEmail] = useState("");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [feed, setFeed] = useState<Feed[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(async () => {
    const [f, a, c, s, lb] = await Promise.all([
      fetch("/api/social/friends").then((r) => r.json()),
      fetch("/api/social/feed").then((r) => r.json()),
      fetch("/api/challenges").then((r) => r.json()),
      fetch("/api/auth/session").then((r) => r.json()),
      fetch("/api/leaderboard").then((r) => r.json()),
    ]);
    setFriends(Array.isArray(f) ? f : []);
    setFeed(Array.isArray(a) ? a : []);
    setChallenges(Array.isArray(c) ? c : []);
    setCurrentUserId(s?.user?.id ?? "");
    setLeaders(Array.isArray(lb) ? lb : []);
  }, []);

  async function sendRequest() {
    if (!session?.user) {
      toast.error("Sign in to add friends.");
      return;
    }
    if (!targetEmail.trim()) {
      toast.error("Enter a valid email.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/social/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request", targetEmail: targetEmail.trim().toLowerCase() }),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      toast.error(payload?.error ?? "Unable to send request.");
      setBusy(false);
      return;
    }
    setTargetEmail("");
    await loadData();
    setBusy(false);
    toast.success("Friend request sent.");
  }

  async function acceptRequest(requestId: string) {
    setBusy(true);
    const res = await fetch("/api/social/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept", requestId }),
    });
    if (!res.ok) {
      toast.error("Unable to accept request.");
      setBusy(false);
      return;
    }
    await loadData();
    setBusy(false);
    toast.success("Friend request accepted.");
  }

  async function joinChallenge(challengeId: string) {
    if (!session?.user) {
      toast.error("Sign in to join challenges.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/challenges/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId }),
    });
    if (!res.ok) {
      toast.error("Unable to join challenge.");
      setBusy(false);
      return;
    }
    await loadData();
    setBusy(false);
    toast.success("Challenge joined.");
  }

  useEffect(() => {
    void loadData()
      .catch(() => {
        toast.error("Could not load social data.");
      })
      .finally(() => setLoading(false));
  }, [loadData]);

  const feedItems = useMemo(
    () =>
      feed.map((item) => ({
        ...item,
        bubble: item.message.slice(0, 2).toUpperCase(),
      })),
    [feed],
  );

  if (!session?.user && !loading) {
    return (
      <div className="app-card flex flex-col items-center justify-center py-16 text-center">
        <p className="text-text-muted">Sign in to connect with friends and challenges.</p>
        <Link href="/sign-in" className="btn-primary mt-6">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text md:text-3xl">Social</h1>
        <p className="mt-1 text-sm text-text-muted">Friends, challenges, and accountability.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.section className="app-card space-y-4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-lg font-semibold text-text">Add Friend</h2>
          <p className="text-sm text-text-muted">Send a request by email. They&apos;ll see it once they join.</p>
          <input
            value={targetEmail}
            onChange={(e) => setTargetEmail(e.target.value)}
            placeholder="friend@email.com"
            className="input-field"
          />
          <button type="button" className="btn-primary w-full sm:w-auto" onClick={sendRequest} disabled={busy}>
            {busy ? "Sending…" : "Send Request"}
          </button>
          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Requests</p>
            {friends.length === 0 ? (
              <p className="text-sm text-text-muted">No friend activity yet.</p>
            ) : (
              friends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-canvas px-3 py-2 text-sm"
                >
                  <span className="text-text">
                    {friend.requester.name ?? friend.requester.email} ↔ {friend.addressee.name ?? friend.addressee.email}
                  </span>
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {friend.status}
                  </span>
                  {friend.status === "PENDING" && friend.addresseeId === currentUserId ? (
                    <button
                      type="button"
                      className="btn-ghost text-xs"
                      onClick={() => void acceptRequest(friend.id)}
                      disabled={busy}
                    >
                      Accept
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </motion.section>

        <motion.section className="app-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-lg font-semibold text-text">Activity Feed</h2>
          <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {loading ? (
              <p className="text-sm text-text-muted">Loading feed…</p>
            ) : feedItems.length === 0 ? (
              <p className="text-sm text-text-muted">No activity yet.</p>
            ) : (
              feedItems.map((item) => (
                <div key={item.id} className="flex gap-3 rounded-xl border border-border bg-canvas p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                    {item.bubble}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text">{item.message}</p>
                    <p className="mt-1 text-xs text-text-muted">{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.section>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-text">Challenges</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {challenges.map((challenge) => {
            const progressPct = Math.min(100, Math.round((challenge.progress / challenge.durationDays) * 100));
            return (
              <motion.div
                key={challenge.id}
                className="app-card flex flex-col gap-3"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-text">{challenge.title}</p>
                    <p className="mt-1 text-sm text-text-muted">
                      {challenge.durationDays} days · stay consistent with daily completions
                    </p>
                  </div>
                  <span className="rounded-full bg-canvas px-2 py-1 text-[11px] text-text-muted">Community</span>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-text-muted">
                    <span>Progress</span>
                    <span className="font-mono text-text">
                      {challenge.progress}/{challenge.durationDays}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-canvas">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPct}%` }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>
                </div>
                {!challenge.joined ? (
                  <button
                    type="button"
                    className="btn-primary w-fit"
                    disabled={busy}
                    onClick={() => void joinChallenge(challenge.id)}
                  >
                    Join
                  </button>
                ) : (
                  <span className="text-sm font-medium text-success">
                    {challenge.completedAt ? "Completed" : "Joined"}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
        {!loading && challenges.length === 0 ? (
          <p className="text-sm text-text-muted">No challenges available.</p>
        ) : null}
      </section>

      <section className="app-card overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-lg font-semibold text-text">Leaderboard</h2>
          <p className="text-xs text-text-muted">Ranked by XP</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left text-sm">
            <thead className="bg-canvas text-xs uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Rank</th>
                <th className="px-4 py-3 font-semibold">Player</th>
                <th className="px-4 py-3 font-semibold">Streak</th>
                <th className="px-4 py-3 font-semibold">XP</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((row, idx) => {
                const rank = idx + 1;
                const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
                const isYou = row.id === currentUserId;
                return (
                  <tr
                    key={row.id}
                    className={clsx("border-t border-border", isYou ? "bg-primary-soft/60" : "bg-transparent")}
                  >
                    <td className="px-4 py-3 font-mono text-text">
                      <span className="mr-2">{medal}</span>
                      {rank}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary-soft text-xs font-semibold text-primary">
                          {row.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={row.image} alt="" className="h-full w-full object-cover" />
                          ) : (
                            initials(row.name, row.id)
                          )}
                        </div>
                        <span className="font-medium text-text">{row.name ?? "User"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-text-muted">—</td>
                    <td className="px-4 py-3 font-mono text-text">{row.xp}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && leaders.length === 0 ? (
          <p className="px-4 py-6 text-sm text-text-muted">No leaderboard data.</p>
        ) : null}
      </section>
    </div>
  );
}
