"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { Camera, Clock, Lock, Shield, Sparkles, Trash2 } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { publicDisplayName } from "@/lib/user-public";

type Profile = {
  name: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  image: string | null;
  timezone: string;
  weekStartsOn: "MONDAY" | "SUNDAY";
  emailMasked: string;
};

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
];

function sectionCard(children: React.ReactNode) {
  return (
    <section className="rounded-[14px] border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] sm:p-5">{children}</section>
  );
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [weekStartsOn, setWeekStartsOn] = useState<"MONDAY" | "SUNDAY">("MONDAY");
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const displaySeed = useMemo(() => profile?.displayName || profile?.name || "user", [profile]);

  const photoUrl = profile?.avatarUrl || profile?.image || null;
  const label = publicDisplayName(profile?.displayName, profile?.name);

  useEffect(() => {
    fetch("/api/settings/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Profile | null) => {
        if (!data) return;
        setProfile(data);
        setDisplayName(data.displayName ?? "");
        setBio(data.bio ?? "");
        setTimezone(data.timezone || "UTC");
        setWeekStartsOn(data.weekStartsOn === "SUNDAY" ? "SUNDAY" : "MONDAY");
      })
      .catch(() => toast.error("Could not load settings."))
      .finally(() => setLoading(false));
  }, []);

  async function saveIdentity() {
    const trimmed = displayName.trim();
    if (trimmed.length < 2) {
      toast.error("Display name must be at least 2 characters.");
      return;
    }
    setSavingIdentity(true);
    const res = await fetch("/api/settings/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: trimmed, bio: bio.slice(0, 140) || null }),
    });
    const data = (await res.json().catch(() => null)) as Profile | { error?: string } | null;
    setSavingIdentity(false);
    if (!res.ok) {
      toast.error(data && "error" in data ? String(data.error) : "Could not save.");
      return;
    }
    setProfile(data as Profile);
    toast.success("Profile updated!");
  }

  async function savePreferences() {
    setSavingPrefs(true);
    const res = await fetch("/api/settings/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone, weekStartsOn }),
    });
    const data = (await res.json().catch(() => null)) as Profile | { error?: string } | null;
    setSavingPrefs(false);
    if (!res.ok) {
      toast.error(data && "error" in data ? String(data.error) : "Could not save.");
      return;
    }
    setProfile(data as Profile);
    toast.success("Profile updated!");
  }

  async function onPhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be 2MB or smaller.");
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/settings/avatar", { method: "POST", body: fd });
    const payload = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
    setUploading(false);
    if (!res.ok) {
      toast.error(payload?.error ?? "Upload failed.");
      return;
    }
    setProfile((p) => (p ? { ...p, avatarUrl: payload?.url ?? p.avatarUrl } : p));
    toast.success("Profile updated!");
  }

  async function removePhoto() {
    const res = await fetch("/api/settings/avatar", { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not remove photo.");
      return;
    }
    setProfile((p) => (p ? { ...p, avatarUrl: null } : p));
    toast.success("Profile updated!");
  }

  async function onDeleteAccount(ev: FormEvent) {
    ev.preventDefault();
    const res = await fetch("/api/settings/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: deleteConfirm }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      toast.error(j?.error ?? "Could not delete account.");
      return;
    }
    await signOut({ callbackUrl: "/" });
  }

  if (loading || !profile) {
    return (
      <div className="mx-auto max-w-[600px] px-3 py-8">
        <p className="text-center text-sm text-text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[600px] px-3 py-6 sm:px-4 sm:py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">Profile & Settings</h1>
        <p className="mt-1 text-sm text-text-muted">Manage how you appear and your preferences</p>
      </header>

      <div className="space-y-5">
        {sectionCard(
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold text-text">Profile picture</h2>
            </div>
            <div className="flex flex-col items-center gap-4">
              <UserAvatar photoUrl={photoUrl} displayName={label} seed={displaySeed} size={96} className="ring-2 ring-[#E5E7EB] ring-offset-2" />
              <div className="flex flex-wrap items-center justify-center gap-3">
                <label className="cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50">
                  {uploading ? "Uploading…" : "Upload photo"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => void onPhotoPick(e)} disabled={uploading} />
                </label>
                {profile.avatarUrl ? (
                  <button type="button" className="text-sm font-medium text-text-muted underline hover:text-text" onClick={() => void removePhoto()}>
                    Remove
                  </button>
                ) : null}
              </div>
              <p className="text-center text-xs text-text-muted">Shown on leaderboard and community</p>
            </div>
          </div>,
        )}

        {sectionCard(
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold text-text">Public identity</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-text">Display name</label>
                <p className="text-xs text-text-muted">How others see you</p>
                <input
                  className="input-field mt-1.5"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={40}
                  placeholder="Community name"
                />
                <p className="mt-1 text-xs text-text-muted">This replaces your real name in all community pages</p>
              </div>
              <div>
                <label className="text-sm font-medium text-text">Bio</label>
                <p className="text-xs text-text-muted">Optional · {bio.length}/140</p>
                <textarea
                  className="input-field mt-1.5 min-h-[88px] resize-y"
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 140))}
                  maxLength={140}
                  placeholder="A short line about your goals…"
                />
              </div>
              <button type="button" className="btn-primary w-full sm:w-auto" disabled={savingIdentity} onClick={() => void saveIdentity()}>
                {savingIdentity ? "Saving…" : "Save"}
              </button>
            </div>
          </div>,
        )}

        {sectionCard(
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Lock className="h-4 w-4 text-text-muted" />
              <h2 className="text-sm font-bold text-text">Private info</h2>
            </div>
            <p className="mb-3 text-xs text-text-muted">Read-only · only visible to you</p>
            <div className="space-y-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3">
              <div>
                <p className="text-xs font-medium text-text-muted">Real name</p>
                <p className="text-sm text-text">{profile.name ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-text-muted">Email</p>
                <p className="text-sm text-text">{profile.emailMasked}</p>
              </div>
            </div>
          </div>,
        )}

        {sectionCard(
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold text-text">Preferences</h2>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-text">Week starts on</p>
                <div className="mt-2 flex gap-2">
                  {(["MONDAY", "SUNDAY"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setWeekStartsOn(d)}
                      className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                        weekStartsOn === d ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-[#E5E7EB] bg-white text-text-muted"
                      }`}
                    >
                      {d === "MONDAY" ? "Monday" : "Sunday"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-text">Timezone</label>
                <select className="input-field mt-1.5" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" className="btn-primary w-full sm:w-auto" disabled={savingPrefs} onClick={() => void savePreferences()}>
                {savingPrefs ? "Saving…" : "Save"}
              </button>
            </div>
          </div>,
        )}

        {sectionCard(
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4 text-danger" />
              <h2 className="text-sm font-bold text-text">Account</h2>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                className="rounded-lg border-2 border-red-500 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                onClick={() => void signOut({ callbackUrl: "/" })}
              >
                Sign out
              </button>
              <button type="button" className="text-sm font-medium text-text-muted underline hover:text-text" onClick={() => setDeleteOpen(true)}>
                Delete account
              </button>
            </div>
          </div>,
        )}
      </div>

      <AnimatePresence>
        {deleteOpen ? (
          <motion.div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-label="Close" onClick={() => setDeleteOpen(false)} />
            <motion.form
              onSubmit={onDeleteAccount}
              className="relative z-10 w-full max-w-md rounded-[14px] border border-[#E5E7EB] bg-white p-5 shadow-lg"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
            >
              <div className="mb-3 flex items-center gap-2 text-danger">
                <Trash2 className="h-4 w-4" />
                <h3 className="font-semibold text-text">Delete account</h3>
              </div>
              <p className="text-sm text-text-muted">This cannot be undone. Type DELETE to confirm.</p>
              <input
                className="input-field mt-3"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" className="btn-ghost" onClick={() => setDeleteOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" disabled={deleteConfirm !== "DELETE"}>
                  Delete forever
                </button>
              </div>
            </motion.form>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
