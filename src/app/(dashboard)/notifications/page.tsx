"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
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

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/notifications");
    const d = (await r.json().catch(() => null)) as { items?: NotificationItem[] } | null;
    setItems(Array.isArray(d?.items) ? d.items : []);
    setLoading(false);
  }, []);

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

  async function handleFriend(notification: NotificationItem, action: "accept" | "decline") {
    const requestId = notification.data ? (JSON.parse(notification.data).friendRequestId as string | undefined) : undefined;
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
    await markRead(notification.id);
    toast.success(action === "accept" ? "Friend request accepted." : "Friend request declined.");
  }

  async function handleChallenge(notification: NotificationItem, action: "accept" | "decline") {
    const challengeId = notification.data ? (JSON.parse(notification.data).challengeId as string | undefined) : undefined;
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
    await markRead(notification.id);
    toast.success(action === "accept" ? "Challenge accepted." : "Challenge declined.");
  }

  if (loading) {
    return <p className="text-sm text-text-muted">Loading notifications…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text">Notifications</h1>
        <button type="button" className="btn-ghost text-sm" onClick={() => void markAllRead()} disabled={markingAll}>
          {markingAll ? "Marking…" : "Mark all read"}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white px-6 py-16 text-center">
          <Bell className="mx-auto mb-3 h-10 w-10 text-text-muted" />
          <p className="text-sm text-text-muted">You&apos;re all caught up! 🎉</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
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
                  <p className="truncate text-sm text-text">{n.message}</p>
                  <p className="mt-1 text-xs text-text-muted">{formatDistanceToNowStrict(new Date(n.createdAt), { addSuffix: true })}</p>

                  {n.type === "friend_request" ? (
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

                  {n.type === "challenge_invite" ? (
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
          ))}
        </div>
      )}
    </div>
  );
}
