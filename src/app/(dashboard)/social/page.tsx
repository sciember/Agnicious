"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import toast from "react-hot-toast";
import clsx from "clsx";
import { Plus, Search, Trophy, Users } from "lucide-react";
import { useAuthModal } from "@/components/auth/auth-modal-context";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/ui/user-avatar";

async function jsonFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.statusText);
  return res.json() as Promise<T>;
}

type FriendUser = { id: string; username: string | null; displayName: string; photoUrl: string | null };
type Friend = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "BLOCKED";
  requesterId: string;
  addresseeId: string;
  requester: FriendUser;
  addressee: FriendUser;
};

type FeedItem = { id: string; message: string; createdAt: string; user: { id: string; displayName: string } };

type ChallengeParticipant = { id: string; displayName: string; photoUrl: string | null; status: string; progressDays: number };

type SocialChallenge = {
  id: string;
  title: string;
  description: string | null;
  durationDays: number;
  createdAt: string;
  creatorId: string;
  isCreator: boolean;
  myStatus: string | null;
  myProgressDays: number;
  myCompletedAt: string | null;
  participants: ChallengeParticipant[];
};

type Leader = {
  id: string;
  displayName: string;
  photoUrl: string | null;
  xp: number;
  streakCount: number;
};

type InviteSearchUser = {
  id: string;
  username: string | null;
  displayName: string;
  photoUrl: string | null;
};

export default function SocialPage() {
  const { data: session, status } = useSession();
  const { requireAuth } = useAuthModal();
  const currentUserId = session?.user?.id ?? "";
  const [targetUsername, setTargetUsername] = useState("");
  const [addTypeaheadResults, setAddTypeaheadResults] = useState<InviteSearchUser[]>([]);
  const [addTypeaheadLoading, setAddTypeaheadLoading] = useState(false);
  const [addTypeaheadOpen, setAddTypeaheadOpen] = useState(false);

  const { data: friends, mutate: mutateFriends } = useSWR<Friend[]>(
    session?.user ? "/api/social/friends" : null,
    jsonFetcher,
  );
  const { data: feed, mutate: mutateFeed } = useSWR<FeedItem[]>(session?.user ? "/api/social/feed" : null, jsonFetcher);
  const { data: challenges, mutate: mutateChallenges } = useSWR<SocialChallenge[]>(
    session?.user ? "/api/social/challenges" : null,
    jsonFetcher,
  );
  const { data: leaders } = useSWR<Leader[]>("/api/leaderboard", jsonFetcher);

  const refreshSocial = useCallback(async () => {
    await Promise.all([mutateFriends(), mutateFeed(), mutateChallenges()]);
  }, [mutateFriends, mutateFeed, mutateChallenges]);

  const loading =
    status === "loading" || (session?.user && (friends === undefined || feed === undefined || challenges === undefined));
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState<string | null>(null);
  const [createTitle, setCreateTitle] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createDays, setCreateDays] = useState(7);
  const [createSearch, setCreateSearch] = useState("");
  const [createResults, setCreateResults] = useState<InviteSearchUser[]>([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [createInviteIds, setCreateInviteIds] = useState<string[]>([]);
  const [inviteModalIds, setInviteModalIds] = useState<string[]>([]);
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteResults, setInviteResults] = useState<InviteSearchUser[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);

  const acceptedFriends = useMemo(() => {
    if (!currentUserId || !friends) return [];
    return friends
      .filter((f) => f.status === "ACCEPTED")
      .map((f) => (f.requesterId === currentUserId ? f.addressee : f.requester));
  }, [friends, currentUserId]);

  useEffect(() => {
    const raw = targetUsername.trim().replace(/^@+/, "");
    if (!session?.user || raw.length < 1) {
      setAddTypeaheadResults([]);
      setAddTypeaheadLoading(false);
      return;
    }
    let cancel = false;
    setAddTypeaheadLoading(true);
    const t = setTimeout(async () => {
      const r = await fetch(`/api/user/typeahead?q=${encodeURIComponent(raw)}`);
      const d = (await r.json().catch(() => [])) as InviteSearchUser[];
      if (!cancel) {
        setAddTypeaheadResults(Array.isArray(d) ? d : []);
        setAddTypeaheadLoading(false);
      }
    }, 300);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [targetUsername, session?.user]);

  function pickAddFriendTypeahead(u: InviteSearchUser) {
    setTargetUsername(u.username ? `@${u.username}` : u.displayName);
    setAddTypeaheadResults([]);
    setAddTypeaheadOpen(false);
  }

  async function sendRequest() {
    if (!targetUsername.trim()) {
      toast.error("Enter @username.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/social/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request", targetUsername: targetUsername.trim() }),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      toast.error(payload?.error ?? "Unable to send request.");
      setBusy(false);
      return;
    }
    setTargetUsername("");
    setAddTypeaheadResults([]);
    await refreshSocial();
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
    await refreshSocial();
    setBusy(false);
    toast.success("Friend request accepted.");
  }

  async function createChallenge() {
    if (!createTitle.trim()) {
      toast.error("Challenge name is required.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/social/challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: createTitle.trim(),
        description: createDesc.trim() || null,
        durationDays: createDays,
        inviteUserIds: createInviteIds,
      }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      toast.error(j?.error ?? "Could not create challenge.");
      setBusy(false);
      return;
    }
    setCreateOpen(false);
    setCreateTitle("");
    setCreateDesc("");
    setCreateDays(7);
    setCreateInviteIds([]);
    setCreateSearch("");
    setCreateResults([]);
    await refreshSocial();
    setBusy(false);
    toast.success("Challenge created.");
  }

  async function deleteChallenge(id: string) {
    if (!confirm("Delete this challenge?")) return;
    setBusy(true);
    const res = await fetch(`/api/social/challenges/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      toast.error("Could not delete.");
      return;
    }
    await refreshSocial();
    toast.success("Challenge deleted.");
  }

  async function respondChallenge(id: string, action: "accept" | "decline") {
    setBusy(true);
    const res = await fetch(`/api/social/challenges/${id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error("Could not update invite.");
      return;
    }
    await refreshSocial();
    toast.success(action === "accept" ? "Joined challenge." : "Declined.");
  }

  async function sendInvites(challengeId: string) {
    if (inviteModalIds.length === 0) {
      toast.error("Pick at least one friend.");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/social/challenges/${challengeId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: inviteModalIds }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      toast.error(j?.error ?? "Invite failed.");
      return;
    }
    setInviteOpen(null);
    setInviteModalIds([]);
    setInviteSearch("");
    await refreshSocial();
    toast.success("Invites sent.");
  }

  const inviteCandidates = useMemo(() => {
    const map = new Map<string, InviteSearchUser>();
    for (const u of acceptedFriends) {
      map.set(u.id, u);
    }
    for (const u of inviteResults) {
      map.set(u.id, u);
    }
    return Array.from(map.values());
  }, [acceptedFriends, inviteResults]);

  const createCandidates = useMemo(() => {
    const map = new Map<string, InviteSearchUser>();
    for (const u of acceptedFriends) {
      map.set(u.id, u);
    }
    for (const u of createResults) {
      map.set(u.id, u);
    }
    return Array.from(map.values());
  }, [acceptedFriends, createResults]);

  const selectedInviteUsers = useMemo(
    () => inviteCandidates.filter((u) => inviteModalIds.includes(u.id)),
    [inviteCandidates, inviteModalIds],
  );

  const selectedCreateUsers = useMemo(
    () => createCandidates.filter((u) => createInviteIds.includes(u.id)),
    [createCandidates, createInviteIds],
  );

  useEffect(() => {
    if (!createOpen) return;
    let cancelled = false;
    setCreateLoading(true);
    const id = setTimeout(async () => {
      const r = await fetch(`/api/social/users/search?q=${encodeURIComponent(createSearch.trim())}`);
      const d = (await r.json().catch(() => [])) as InviteSearchUser[];
      if (!cancelled) {
        setCreateResults(Array.isArray(d) ? d : []);
        setCreateLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [createSearch, createOpen]);

  useEffect(() => {
    if (!inviteOpen) return;
    let cancelled = false;
    setInviteLoading(true);
    const id = setTimeout(async () => {
      const r = await fetch(`/api/social/users/search?q=${encodeURIComponent(inviteSearch.trim())}`);
      const d = (await r.json().catch(() => [])) as InviteSearchUser[];
      if (!cancelled) {
        setInviteResults(Array.isArray(d) ? d : []);
        setInviteLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [inviteSearch, inviteOpen]);

  function toggleCreateInvite(id: string) {
    setCreateInviteIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleModalInvite(id: string) {
    setInviteModalIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text md:text-3xl">Social</h1>
        <p className="mt-1 text-sm text-text-muted">Friends, your activity, challenges, and leaderboard.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.section
          className="app-card flex max-h-[min(440px,72vh)] flex-col gap-3 overflow-hidden"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="shrink-0 space-y-1">
            <h2 className="text-lg font-semibold text-text">Add friend</h2>
            <p className="text-sm text-text-muted">Search by @username or name, then send a request.</p>
          </div>
          <div className="relative shrink-0">
            <input
              id="social-friend-search"
              value={targetUsername}
              onChange={(e) => {
                setTargetUsername(e.target.value);
                setAddTypeaheadOpen(true);
              }}
              onFocus={() => setAddTypeaheadOpen(true)}
              onBlur={() => setTimeout(() => setAddTypeaheadOpen(false), 180)}
              placeholder="@username"
              className="input-field"
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={addTypeaheadOpen && (addTypeaheadLoading || addTypeaheadResults.length > 0)}
            />
            {addTypeaheadOpen && session?.user && targetUsername.trim().replace(/^@+/, "").length >= 1 ? (
              <ul
                className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-lg"
                role="listbox"
              >
                {addTypeaheadLoading ? (
                  <li className="px-3 py-2 text-xs text-text-muted">Searching…</li>
                ) : addTypeaheadResults.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-text-muted">No users found</li>
                ) : (
                  addTypeaheadResults.map((u) => (
                    <li key={u.id} role="option">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-canvas"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickAddFriendTypeahead(u)}
                      >
                        <UserAvatar photoUrl={u.photoUrl} displayName={u.displayName} seed={u.id} size={32} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-text">{u.displayName}</p>
                          <p className="truncate text-xs text-text-muted">{u.username ? `@${u.username}` : "No username"}</p>
                        </div>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>
          <button type="button" className="btn-primary w-full shrink-0 sm:w-auto" onClick={requireAuth(() => void sendRequest())} disabled={busy}>
            {busy ? "Sending…" : "Send request"}
          </button>
          <div className="flex min-h-0 flex-1 flex-col border-t border-border pt-3">
            <p className="shrink-0 text-xs font-semibold uppercase tracking-wide text-text-muted">Requests</p>
            <div className="mt-2 max-h-[200px] min-h-[120px] flex-1 space-y-2 overflow-y-auto pr-1">
              {!session?.user ? (
                <p className="text-sm text-text-muted">Sign in to see requests.</p>
              ) : loading ? (
                <p className="text-sm text-text-muted">Loading…</p>
              ) : friends !== undefined && friends.length === 0 ? (
                <EmptyState
                  illustration="people"
                  title="Your journey starts here"
                  description="Search by @username above and send your first friend request."
                  ctaLabel="Focus search box"
                  onCta={() => document.getElementById("social-friend-search")?.focus()}
                />
              ) : (
                (friends ?? []).map((friend) => (
                  <div
                    key={friend.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-canvas px-3 py-2 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-text">
                      <UserAvatar photoUrl={friend.requester.photoUrl} displayName={friend.requester.displayName} seed={friend.requester.id} size={28} />
                      <span className="text-text-muted">↔</span>
                      <UserAvatar photoUrl={friend.addressee.photoUrl} displayName={friend.addressee.displayName} seed={friend.addressee.id} size={28} />
                      <span className="min-w-0 truncate whitespace-nowrap">
                        {friend.requester.displayName} ↔ {friend.addressee.displayName}
                      </span>
                    </span>
                    <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">{friend.status}</span>
                    {friend.status === "PENDING" && friend.addresseeId === currentUserId ? (
                      <button type="button" className="btn-ghost text-xs" onClick={requireAuth(() => void acceptRequest(friend.id))} disabled={busy}>
                        Accept
                      </button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </motion.section>

        <motion.section className="app-card flex max-h-[min(380px,55vh)] flex-col overflow-hidden" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="shrink-0 text-lg font-semibold text-text">Your activity</h2>
          <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {!session?.user ? (
              <p className="text-sm text-text-muted">Sign in to see your activity.</p>
            ) : loading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-xl bg-canvas" />
                ))}
              </div>
            ) : (feed ?? []).length === 0 ? (
              <EmptyState
                illustration="journey"
                title="Your journey starts here"
                description="Complete habits and tasks — your activity feed will showcase wins to friends."
                ctaLabel="+ Add a habit"
                ctaHref="/habits"
              />
            ) : (
              (feed ?? []).map((item) => (
                <div key={item.id} className="flex gap-3 rounded-xl border border-border bg-canvas p-3">
                  <UserAvatar photoUrl={null} displayName={item.user.displayName} seed={item.user.id} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text">{item.user.displayName}</p>
                    <p className="text-sm text-text-muted">{item.message}</p>
                    <p className="mt-1 text-xs text-text-muted">{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.section>
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-text">My challenges</h2>
          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 sm:w-auto"
            onClick={requireAuth(() => {
              setCreateInviteIds([]);
              setCreateSearch("");
              setCreateResults([]);
              setCreateOpen(true);
            })}
          >
            <Plus className="h-4 w-4" />
            Create challenge
          </button>
        </div>

        {!session?.user ? (
          <p className="text-sm text-text-muted">Sign in to create or join challenges.</p>
        ) : loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="app-card h-48 animate-pulse bg-canvas" />
            ))}
          </div>
        ) : (challenges ?? []).length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-border bg-canvas px-4 py-12 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-text-muted" />
            <p className="text-sm text-text-muted">No challenges yet — create one and invite friends to compete!</p>
          </div>
        ) : (
          <div className="max-h-[min(560px,62vh)] overflow-y-auto pr-1 md:pr-2">
            <div className="grid gap-4 md:grid-cols-2">
              {(challenges ?? []).map((ch) => {
              const accepted = ch.participants.filter((p) => p.status === "ACCEPTED");
              const showAvatars = accepted.slice(0, 3);
              const extra = Math.max(0, accepted.length - 3);
              const progressPct = Math.min(100, Math.round((ch.myProgressDays / ch.durationDays) * 100));
              const pendingInvite = ch.myStatus === "PENDING" && !ch.isCreator;

              return (
                <motion.div key={ch.id} className="app-card flex flex-col gap-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-text">{ch.title}</p>
                      {ch.description ? <p className="mt-1 text-sm text-text-muted">{ch.description}</p> : null}
                    </div>
                    <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700">{ch.durationDays}d</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {showAvatars.map((p) => (
                      <UserAvatar key={p.id} photoUrl={p.photoUrl} displayName={p.displayName} seed={p.id} size={32} className="ring-2 ring-white" />
                    ))}
                    {extra > 0 ? (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-canvas text-[11px] font-semibold text-text-muted">
                        +{extra}
                      </span>
                    ) : null}
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-text-muted">
                      <span>Progress</span>
                      <span className="font-mono text-text">
                        {ch.myProgressDays}/{ch.durationDays}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-canvas">
                      <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: 0.35 }} />
                    </div>
                  </div>
                  {pendingInvite ? (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void respondChallenge(ch.id, "accept")}>
                        Accept
                      </button>
                      <button type="button" className="btn-ghost text-sm" disabled={busy} onClick={() => void respondChallenge(ch.id, "decline")}>
                        Decline
                      </button>
                    </div>
                  ) : ch.isCreator ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-primary text-sm"
                        onClick={() => {
                          setInviteModalIds([]);
                          setInviteSearch("");
                          setInviteOpen(ch.id);
                        }}
                      >
                        Invite
                      </button>
                      <button type="button" className="btn-ghost text-sm text-danger" disabled={busy} onClick={() => void deleteChallenge(ch.id)}>
                        Delete
                      </button>
                    </div>
                  ) : ch.myStatus === "ACCEPTED" ? (
                    <span className="text-sm font-medium text-success">{ch.myCompletedAt ? "Completed" : "Active"}</span>
                  ) : null}
                </motion.div>
              );
            })}
            </div>
          </div>
        )}
      </section>

      <section className="app-card flex max-h-[min(480px,55vh)] flex-col overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <h2 className="text-lg font-semibold text-text">Leaderboard</h2>
          </div>
          <p className="text-xs text-text-muted">Ranked by XP</p>
        </div>
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
          {leaders === undefined ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                <div key={i} className="h-11 animate-pulse rounded-lg bg-canvas" />
              ))}
            </div>
          ) : (
            <table className="w-full min-w-[520px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-canvas text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Rank</th>
                  <th className="px-4 py-3 font-semibold">Player</th>
                  <th className="px-4 py-3 font-semibold">Streak</th>
                  <th className="px-4 py-3 font-semibold">XP</th>
                </tr>
              </thead>
              <tbody>
                {(leaders ?? []).map((row, idx) => {
                  const rank = idx + 1;
                  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
                  const isYou = row.id === currentUserId;
                  return (
                    <tr key={row.id} className={clsx("border-t border-border", isYou ? "bg-primary-soft/60" : "bg-transparent")}>
                      <td className="px-4 py-3 font-mono text-text">
                        <span className="mr-2">{medal}</span>
                        {rank}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <UserAvatar photoUrl={row.photoUrl} displayName={row.displayName} seed={row.id} size={36} className="shrink-0" />
                          <span className="min-w-0 truncate whitespace-nowrap font-medium text-text">{row.displayName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-text">{row.streakCount}</td>
                      <td className="px-4 py-3 font-mono text-text">{row.xp}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {leaders !== undefined && leaders.length === 0 ? (
          <p className="px-4 py-6 text-sm text-text-muted">No leaderboard data.</p>
        ) : null}
      </section>

      <AnimatePresence>
        {createOpen ? (
          <motion.div className="fixed inset-0 z-[120] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-label="Close" onClick={() => setCreateOpen(false)} />
            <motion.div
              className="relative z-10 w-full max-w-md rounded-[14px] border border-border bg-card p-5 shadow-xl"
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 12, opacity: 0 }}
            >
              <h3 className="text-lg font-semibold text-text">Create challenge</h3>
              <div className="mt-4 space-y-3">
                <input className="input-field" placeholder="Challenge name *" value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} />
                <textarea className="input-field min-h-[72px]" placeholder="Description (optional)" value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} />
                <label className="block text-sm text-text-muted">
                  Duration (days)
                  <input type="number" min={1} max={365} className="input-field mt-1" value={createDays} onChange={(e) => setCreateDays(Number(e.target.value) || 1)} />
                </label>
                <div>
                  <p className="text-sm font-medium text-text">Invite friends</p>
                  {selectedCreateUsers.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedCreateUsers.map((u) => (
                        <span key={u.id} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
                          {u.username ? `@${u.username}` : u.displayName}
                          <button
                            type="button"
                            className="ml-1 rounded-full px-1 text-indigo-700 hover:bg-indigo-100"
                            onClick={() => toggleCreateInvite(u.id)}
                            aria-label={`Remove ${u.username ?? u.displayName}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="relative mt-2">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    <input
                      className="input-field pl-9"
                      placeholder="Search @username or name"
                      value={createSearch}
                      onChange={(e) => setCreateSearch(e.target.value)}
                    />
                  </div>
                  <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-lg border border-border bg-canvas p-2">
                    {createLoading ? <li className="px-2 py-2 text-xs text-text-muted">Searching...</li> : null}
                    {!createLoading && createResults.length === 0 ? <li className="px-2 py-2 text-xs text-text-muted">No users found</li> : null}
                    {!createLoading
                      ? createResults.map((u) => (
                          <li key={u.id}>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-card"
                              onClick={() => toggleCreateInvite(u.id)}
                            >
                              <UserAvatar photoUrl={u.photoUrl} displayName={u.displayName} seed={u.id} size={28} />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-text">{u.displayName}</p>
                                <p className="truncate text-xs text-text-muted">{u.username ? `@${u.username}` : "No username"}</p>
                              </div>
                              {createInviteIds.includes(u.id) ? (
                                <span className="ml-auto rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">Selected</span>
                              ) : null}
                            </button>
                          </li>
                        ))
                      : null}
                  </ul>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" className="btn-ghost" onClick={() => setCreateOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="btn-primary" disabled={busy} onClick={() => void createChallenge()}>
                  Create
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {inviteOpen ? (
          <motion.div className="fixed inset-0 z-[120] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-label="Close" onClick={() => setInviteOpen(null)} />
            <motion.div
              className="relative z-10 w-full max-w-md rounded-[14px] border border-border bg-card p-5 shadow-xl"
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 12, opacity: 0 }}
            >
              <h3 className="text-lg font-semibold text-text">Invite friends</h3>
              {selectedInviteUsers.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedInviteUsers.map((u) => (
                    <span key={u.id} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
                      {u.username ? `@${u.username}` : u.displayName}
                      <button
                        type="button"
                        className="ml-1 rounded-full px-1 text-indigo-700 hover:bg-indigo-100"
                        onClick={() => toggleModalInvite(u.id)}
                        aria-label={`Remove ${u.username ?? u.displayName}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  className="input-field pl-9"
                  placeholder="Search @username or name"
                  value={inviteSearch}
                  onChange={(e) => setInviteSearch(e.target.value)}
                />
              </div>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border bg-canvas p-2">
                {inviteLoading ? <li className="px-2 py-2 text-xs text-text-muted">Searching...</li> : null}
                {!inviteLoading && inviteResults.length === 0 ? <li className="px-2 py-2 text-xs text-text-muted">No users found</li> : null}
                {!inviteLoading
                  ? inviteResults.map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-card"
                          onClick={() => toggleModalInvite(u.id)}
                        >
                          <UserAvatar photoUrl={u.photoUrl} displayName={u.displayName} seed={u.id} size={28} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-text">{u.displayName}</p>
                            <p className="truncate text-xs text-text-muted">{u.username ? `@${u.username}` : "No username"}</p>
                          </div>
                          {inviteModalIds.includes(u.id) ? (
                            <span className="ml-auto rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">Selected</span>
                          ) : null}
                        </button>
                      </li>
                    ))
                  : null}
              </ul>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" className="btn-ghost" onClick={() => setInviteOpen(null)}>
                  Cancel
                </button>
                <button type="button" className="btn-primary" disabled={busy} onClick={() => void sendInvites(inviteOpen)}>
                  Send invites
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
