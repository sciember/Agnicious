"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

type ProfilePayload = {
  email: string;
  name: string | null;
  displayName: string | null;
};

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ProfilePayload | null) => {
        if (!data) return;
        setProfile(data);
        setDisplayName(data.displayName ?? data.name ?? "");
      })
      .catch(() => {
        toast.error("Could not load settings.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveDisplayName() {
    const trimmed = displayName.trim();
    if (trimmed.length < 2) {
      toast.error("Display name must be at least 2 characters.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/settings/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: trimmed }),
    });
    const payload = (await res.json().catch(() => null)) as ProfilePayload | { error?: string } | null;
    setSaving(false);

    if (!res.ok) {
      const message = payload && "error" in payload ? payload.error : "Could not save display name.";
      toast.error(message ?? "Could not save display name.");
      return;
    }

    const nextProfile = payload as ProfilePayload;
    setProfile(nextProfile);
    setDisplayName(nextProfile.displayName ?? "");
    toast.success("Display name updated.");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text md:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-text-muted">
          Choose how your identity appears in community surfaces like leaderboard, activity feed, and challenges.
        </p>
      </div>

      <section className="app-card space-y-4">
        <h2 className="text-lg font-semibold text-text">Public Community Profile</h2>
        <div className="space-y-2">
          <label htmlFor="displayName" className="text-sm font-medium text-text">
            Display Name
          </label>
          <input
            id="displayName"
            className="input-field"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter your public display name"
            maxLength={40}
            disabled={loading || saving}
          />
          <p className="text-xs text-text-muted">This is the only name others see in community pages.</p>
        </div>
        <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => void saveDisplayName()} disabled={saving || loading}>
          {saving ? "Saving…" : "Save Display Name"}
        </button>
      </section>

      <section className="app-card space-y-3">
        <h2 className="text-lg font-semibold text-text">Private Account Info</h2>
        <p className="text-xs text-text-muted">Visible only to you.</p>
        <div className="rounded-xl border border-border bg-canvas p-4 text-sm">
          <p className="text-text">
            <span className="text-text-muted">Real name:</span> {profile?.name ?? "Not set"}
          </p>
          <p className="mt-1 text-text">
            <span className="text-text-muted">Email:</span> {profile?.email ?? "Not available"}
          </p>
        </div>
      </section>
    </div>
  );
}
