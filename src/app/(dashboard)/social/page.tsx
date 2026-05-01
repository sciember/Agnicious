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
  const [targetEmail, setTargetEmail] = useState("");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [feed, setFeed] = useState<Feed[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);

  async function loadData() {
    const [f, a, c] = await Promise.all([
      fetch("/api/social/friends").then((r) => r.json()),
      fetch("/api/social/feed").then((r) => r.json()),
      fetch("/api/challenges").then((r) => r.json()),
    ]);
    setFriends(Array.isArray(f) ? f : []);
    setFeed(Array.isArray(a) ? a : []);
    setChallenges(Array.isArray(c) ? c : []);
  }

  async function sendRequest() {
    await fetch("/api/social/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request", targetEmail }),
    });
    setTargetEmail("");
    await loadData();
  }

  async function acceptRequest(requestId: string) {
    await fetch("/api/social/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept", requestId }),
    });
    await loadData();
  }

  async function joinChallenge(challengeId: string) {
    await fetch("/api/challenges/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId }),
    });
    await loadData();
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/social/friends").then((r) => r.json()),
      fetch("/api/social/feed").then((r) => r.json()),
      fetch("/api/challenges").then((r) => r.json()),
    ])
      .then(([f, a, c]) => {
        setFriends(Array.isArray(f) ? f : []);
        setFeed(Array.isArray(a) ? a : []);
        setChallenges(Array.isArray(c) ? c : []);
      })
      .catch(() => {
        setFriends([]);
        setFeed([]);
        setChallenges([]);
      });
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Social</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="app-card space-y-3">
          <h2 className="text-xl font-semibold">Add Friend</h2>
          <input
            value={targetEmail}
            onChange={(e) => setTargetEmail(e.target.value)}
            placeholder="friend@email.com"
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
          <button className="rounded-md bg-indigo-500 px-3 py-2" onClick={sendRequest}>
            Send Request
          </button>
          <div className="space-y-2">
            {friends.map((friend) => (
              <div key={friend.id} className="rounded-md border border-zinc-800 p-2 text-sm">
                <p>
                  {friend.requester.name ?? friend.requester.email} → {friend.addressee.name ?? friend.addressee.email}
                </p>
                <p className="text-zinc-400">{friend.status}</p>
                {friend.status === "PENDING" ? (
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
      </div>
    </div>
  );
}
