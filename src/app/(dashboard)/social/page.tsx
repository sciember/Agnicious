"use client";

import { useEffect, useState } from "react";

type Friend = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "BLOCKED";
  requesterId: string;
  addresseeId: string;
  requester: { id: string; name: string | null; email: string };
  addressee: { id: string; name: string | null; email: string };
};

type Feed = { id: string; message: string; createdAt: string };
type Challenge = { id: string; title: string; durationDays: number; joined: boolean; progress: number; completedAt: string | null };

export default function SocialPage() {
  const [currentUserId, setCurrentUserId] = useState("");
  const [targetEmail, setTargetEmail] = useState("");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [feed, setFeed] = useState<Feed[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadData() {
    const [f, a, c, s] = await Promise.all([
      fetch("/api/social/friends").then((r) => r.json()),
      fetch("/api/social/feed").then((r) => r.json()),
      fetch("/api/challenges").then((r) => r.json()),
      fetch("/api/auth/session").then((r) => r.json()),
    ]);
    setFriends(Array.isArray(f) ? f : []);
    setFeed(Array.isArray(a) ? a : []);
    setChallenges(Array.isArray(c) ? c : []);
    setCurrentUserId(s?.user?.id ?? "");
  }

  async function sendRequest() {
    if (!targetEmail.trim()) {
      setError("Please enter a valid email.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/social/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request", targetEmail: targetEmail.trim().toLowerCase() }),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Unable to send request.");
      setBusy(false);
      return;
    }
    setTargetEmail("");
    await loadData();
    setBusy(false);
    setMessage("Friend request sent.");
  }

  async function acceptRequest(requestId: string) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/social/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept", requestId }),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Unable to accept request.");
      setBusy(false);
      return;
    }
    await loadData();
    setBusy(false);
    setMessage("Friend request accepted.");
  }

  async function joinChallenge(challengeId: string) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/challenges/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId }),
    });
    if (!res.ok) {
      setError("Unable to join challenge.");
      setBusy(false);
      return;
    }
    await loadData();
    setBusy(false);
    setMessage("Challenge joined.");
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/social/friends").then((r) => r.json()),
      fetch("/api/social/feed").then((r) => r.json()),
      fetch("/api/challenges").then((r) => r.json()),
      fetch("/api/auth/session").then((r) => r.json()),
    ])
      .then(([f, a, c, s]) => {
        setFriends(Array.isArray(f) ? f : []);
        setFeed(Array.isArray(a) ? a : []);
        setChallenges(Array.isArray(c) ? c : []);
        setCurrentUserId(s?.user?.id ?? "");
      })
      .catch(() => {
        setFriends([]);
        setFeed([]);
        setChallenges([]);
        setError("Could not load social data.");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Social</h1>
      {message ? <div className="app-card border-emerald-900 text-emerald-300">{message}</div> : null}
      {error ? <div className="app-card border-rose-900 text-rose-300">{error}</div> : null}
      {loading ? <div className="app-card text-zinc-400">Loading social data...</div> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="app-card space-y-3">
          <h2 className="text-xl font-semibold">Add Friend</h2>
          <input
            value={targetEmail}
            onChange={(e) => setTargetEmail(e.target.value)}
            placeholder="friend@email.com"
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
          <button
            className="rounded-md bg-indigo-500 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={sendRequest}
            disabled={busy}
          >
            {busy ? "Please wait..." : "Send Request"}
          </button>
          <div className="space-y-2">
            {friends.map((friend) => (
              <div key={friend.id} className="rounded-md border border-zinc-800 p-2 text-sm">
                <p>
                  {friend.requester.name ?? friend.requester.email} → {friend.addressee.name ?? friend.addressee.email}
                </p>
                <p className="text-zinc-400">{friend.status}</p>
                {friend.status === "PENDING" && friend.addresseeId === currentUserId ? (
                  <button className="mt-1 rounded border border-zinc-700 px-2 py-1" onClick={() => acceptRequest(friend.id)}>
                    Accept
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <div className="app-card space-y-3">
          <h2 className="text-xl font-semibold">Activity Feed</h2>
          {feed.map((item) => (
            <div key={item.id} className="rounded-md border border-zinc-800 p-2 text-sm">
              <p>{item.message}</p>
              <p className="text-zinc-500">{new Date(item.createdAt).toLocaleString()}</p>
            </div>
          ))}
          {feed.length === 0 ? <p className="text-sm text-zinc-500">No activity yet.</p> : null}
        </div>
      </div>
      <div className="app-card space-y-3">
        <h2 className="text-xl font-semibold">Challenges</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {challenges.map((challenge) => (
            <div key={challenge.id} className="rounded-md border border-zinc-800 p-3">
              <p className="font-medium">{challenge.title}</p>
              <p className="text-sm text-zinc-400">Duration: {challenge.durationDays} days</p>
              <p className="text-sm text-zinc-400">Progress: {challenge.progress}/{challenge.durationDays}</p>
              {!challenge.joined ? (
                <button className="mt-2 rounded border border-zinc-700 px-2 py-1" onClick={() => joinChallenge(challenge.id)}>
                  Join
                </button>
              ) : (
                <p className="mt-2 text-xs text-emerald-400">
                  {challenge.completedAt ? "Completed" : "Joined"}
                </p>
              )}
            </div>
          ))}
        </div>
        {challenges.length === 0 ? <p className="text-sm text-zinc-500">No challenges available.</p> : null}
      </div>
    </div>
  );
}
