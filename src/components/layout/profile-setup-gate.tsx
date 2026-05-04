"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

const SKIP_PREFIX = "agnicious_skip_profile_";

export function ProfileSetupGate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [dbUsername, setDbUsername] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id || session.user.username) {
      setDbUsername(undefined);
      return;
    }
    let cancelled = false;
    fetch("/api/settings/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { username?: string | null } | null) => {
        if (!cancelled) setDbUsername(typeof data?.username === "string" ? data.username : null);
      })
      .catch(() => {
        if (!cancelled) setDbUsername(null);
      });
    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.id, session?.user?.username]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    if (session.user.username || dbUsername) return;
    if (pathname === "/setup-profile" || pathname === "/profile-setup") return;
    if (typeof window !== "undefined" && localStorage.getItem(SKIP_PREFIX + session.user.id)) return;
    // Wait until DB check resolves to avoid redirect loops from stale session values.
    if (typeof dbUsername === "undefined") return;
    router.replace("/setup-profile");
  }, [status, session?.user?.id, session?.user?.username, pathname, router, dbUsername]);

  return <>{children}</>;
}
