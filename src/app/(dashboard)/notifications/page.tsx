"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { UserAvatar } from "@/components/ui/user-avatar";

type NotificationItem = {
  id: string;
  type: "friend_request" | "challenge_invite" | "accepted" | string;
  message: string;
  read: boolean;
  data: string | null;
  createdAt: string;
  from: { id: string; username: string | null; displayName: string; photoUrl: string | null } | null;
};

function isResolved(data: string | null): boolean {
  if (!data) return false;
  try {
    const d = JSON.parse(data) as { resolved?: boolean };
    return d.resolved === true;
  } catch {
    return false;
  }
}

export default function NotificationsPage() {
  const { data: session, status } = useSession();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    if (status === "loading") {
      setLoading(true);
      return;
    }
    if (!session?.user) {
      setItems([]);
      setLoadError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const r = await fetch("/api/notifications");
      const raw = await r.text();
      let d: { items?: NotificationItem[]; error?: string } | null = null;
      try {
        d = raw ? (JSON.parse(raw) as { items?: NotificationItem[]; error?: string }) : null;
      } catch {
        d = null;
      }
      if (!r.ok) {
        const msg = typeof d?.error === "string" ? d.error : `Could not load notifications (${r.status}).`;
        console.error("[notifications] GET failed", r.status, raw);
        setLoadError(msg);
        setItems([]);
        return;
      }
      setItems(Array.isArray(d?.items) ? d.items : []);
    } catch (err) {
      console.error("[notifications] load error", err);
      setLoadError("Network error while loading notifications.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [session?.user, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  async function markAllRead() {
    setMarkingAll(true);
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setMarkingAll(false);
  }

  async function applyResolution(notification: NotificationItem, action: "accepted" | "declined") {
    const res = await fetch(`/api/notifications/${notification.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolution: { action } }),
    });
    const payload = (await res.json().catch(() => null)) as { notification?: NotificationItem } | null;
    if (!res.ok || !payload?.notification) {
      return false;
    }
    setItems((prev) => prev.map((n) => (n.id === notification.id ? payload.notification! : n)));
    return true;
  }

  async function handleFriend(notification: NotificationItem, action: "accept" | "decline") {
    let requestId: string | undefined;
    try {
      requestId = notification.data
        ? (JSON.parse(notification.data) as { friendRequestId?: string }).friendRequestId
        : undefined;
    } catch {
      return;
    }
    if (!requestId) return;
    setBusyId(notification.id);
    const res = await fetch("/api/social/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, requestId }),
    });
    setBusyId(null);
    if (!res.ok) {
      toast.error("Could not update request.");
      return;
    }
    const resolution = action === "accept" ? "accepted" : "declined";
    const ok = await applyResolution(notification, resolution);
    if (!ok) {
      toast.error("Could not update notification.");
      return;
    }
    toast.success(action === "accept" ? "Friend request accepted." : "Friend request declined.");
  }

  async function handleChallenge(notification: NotificationItem, action: "accept" | "decline") {
    let challengeId: string | undefined;
    try {
      challengeId = notification.data
        ? (JSON.parse(notification.data) as { challengeId?: string }).challengeId
        : undefined;
    } catch {
      return;
    }
    if (!challengeId) return;
    setBusyId(notification.id);
    const res = await fetch(`/api/social/challenges/${challengeId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusyId(null);
    if (!res.ok) {
      toast.error("Could not update invite.");
      return;
    }
    const resolution = action === "accept" ? "accepted" : "declined";
    const ok = await applyResolution(notification, resolution);
    if (!ok) {
      toast.error("Could not update notification.");
      return;
    }
    toast.success(action === "accept" ? "Joined challenge." : "Declined invite.");
  }

  if (status === "loading" || (session?.user && loading)) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-40 animate-pulse rounded-lg bg-canvas" />
          <div className="h-9 w-28 animate-pulse rounded-lg bg-canvas" />
        </div>
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-text">Notifications</h1>
        <EmptyState
          illustration="bell"
          title="Sign in to see notifications"
          description="Your friend requests, invites, and updates appear here when you&apos;re signed in."
          ctaLabel="Sign in"
          ctaHref="/sign-in"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text">Notifications</h1>
        <button type="button" className="btn-ghost text-sm" onClick={() => void markAllRead()} disabled={markingAll}>
          {markingAll ? "Marking…" : "Mark all read"}
        </button>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{loadError}</div>
      ) : null}

      {!loadError && items.length === 0 ? (
        <EmptyState
          illustration="bell"
          title="Your journey starts here"
          description="When friends, challenges, and milestones ping you, they&apos;ll show up here."
          ctaLabel="Go to Social"
          ctaHref="/social"
        />
      ) : !loadError ? (
        <div className="space-y-3">
          {items.map((n) => {
            const resolved = isResolved(n.data);
            const showFriendActions = n.type === "friend_request" && !resolved;
            const showChallengeActions = n.type === "challenge_invite" && !resolved;

            return (
              <div
                key={n.id}
                className={`rounded-xl border border-border p-4 ${n.read ? "bg-[#F9FAFB]" : "bg-white"}`}
                onMouseEnter={() => {
                  if (!n.read) void markRead(n.id);
                }}
              >
                <div className="flex items-start gap-3">
                  <UserAvatar photoUrl={n.from?.photoUrl ?? null} displayName={n.from?.displayName ?? "User"} seed={n.from?.id ?? n.id} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text">{n.message}</p>
                    <p className="mt-1 text-xs text-text-muted">{formatDistanceToNowStrict(new Date(n.createdAt), { addSuffix: true })}</p>

                    {showFriendActions ? (
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white"
                          disabled={busyId === n.id}
                          onClick={() => void handleFriend(n, "accept")}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700"
                          disabled={busyId === n.id}
                          onClick={() => void handleFriend(n, "decline")}
                        >
                          Decline
                        </button>
                      </div>
                    ) : null}

                    {showChallengeActions ? (
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white"
                          disabled={busyId === n.id}
                          onClick={() => void handleChallenge(n, "accept")}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700"
                          disabled={busyId === n.id}
                          onClick={() => void handleChallenge(n, "decline")}
                        >
                          Decline
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
