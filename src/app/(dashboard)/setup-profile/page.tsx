"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Camera } from "lucide-react";
import toast from "react-hot-toast";
import { UserAvatar } from "@/components/ui/user-avatar";
import { normalizeUsername, validateUsernameFormat } from "@/lib/username";

const SKIP_PREFIX = "agnicious_skip_profile_";

export default function SetupProfilePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [state, setState] = useState<"idle" | "checking" | "ok" | "bad">("idle");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      if (session?.user?.username) {
        router.replace("/");
        return;
      }
      setDisplayName(session?.user?.name ?? "");
    }
  }, [status, session?.user?.name, session?.user?.username, router]);

  useEffect(() => {
    const norm = normalizeUsername(username);
    if (!norm) {
      setState("idle");
      return;
    }
    const fmt = validateUsernameFormat(norm);
    if (!fmt.ok) {
      setState("bad");
      return;
    }
    let cancelled = false;
    setState("checking");
    const t = setTimeout(async () => {
      const r = await fetch(`/api/user/check-username?u=${encodeURIComponent(norm)}`);
      const d = (await r.json().catch(() => null)) as { available?: boolean } | null;
      if (!cancelled) setState(d?.available ? "ok" : "bad");
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [username]);

  const seed = session?.user?.id ?? "user";
  const canSubmit = displayName.trim().length >= 2 && state === "ok";

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Image only.");
    if (file.size > 2 * 1024 * 1024) return toast.error("Max 2MB allowed.");
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/settings/avatar", { method: "POST", body: fd });
    const payload = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
    setUploading(false);
    if (!res.ok || !payload?.url) {
      toast.error(payload?.error ?? "Upload failed.");
      return;
    }
    setAvatarUrl(payload.url);
  }

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: displayName.trim(),
        username: normalizeUsername(username),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      toast.error(j?.error ?? "Could not save profile.");
      return;
    }
    await update();
    router.replace("/dashboard");
  }

  function skipForNow() {
    if (session?.user?.id) localStorage.setItem(SKIP_PREFIX + session.user.id, "1");
    router.replace("/dashboard");
  }

  if (status === "loading") return null;

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-[480px] rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 text-lg font-bold text-white">A</div>
          <h1 className="text-2xl font-semibold text-text">Welcome to Sciember! 🎉</h1>
          <p className="mt-1 text-sm text-text-muted">Set up your profile to get started</p>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3">
            <UserAvatar photoUrl={avatarUrl} displayName={displayName || "User"} seed={seed} size={96} />
            <label className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-text-muted hover:bg-canvas">
              <Camera className="h-4 w-4" />
              {uploading ? "Uploading…" : "Profile picture (optional)"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => void onPickFile(e)} disabled={uploading} />
            </label>
          </div>

          <div>
            <label className="text-sm font-medium text-text">Display Name</label>
            <input className="input-field mt-1.5" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} />
          </div>

          <div>
            <label className="text-sm font-medium text-text">Username</label>
            <input
              className="input-field mt-1.5"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@username"
              maxLength={21}
            />
            <p className="mt-1 text-xs text-text-muted">Others use this to find and invite you</p>
            <p className={`mt-1 text-xs ${state === "ok" ? "text-green-600" : state === "bad" ? "text-red-600" : "text-text-muted"}`}>
              {state === "checking"
                ? "Checking..."
                : state === "ok"
                  ? "✓ Username available"
                  : state === "bad"
                    ? "✗ Username taken or invalid"
                    : "Use lowercase letters, numbers, underscore"}
            </p>
          </div>

          <button type="button" className="btn-primary w-full" onClick={() => void submit()} disabled={!canSubmit || saving}>
            {saving ? "Saving…" : "Let's go! →"}
          </button>
        </div>

        <button type="button" className="mx-auto mt-4 block text-xs text-text-muted hover:text-text" onClick={skipForNow}>
          Skip for now
        </button>
      </div>
    </div>
  );
}
