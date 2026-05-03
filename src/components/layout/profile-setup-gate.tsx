"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

const SKIP_PREFIX = "agnicious_skip_profile_";

export function ProfileSetupGate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    if (session.user.username) return;
    if (pathname === "/setup-profile") return;
    if (typeof window !== "undefined" && localStorage.getItem(SKIP_PREFIX + session.user.id)) return;
    router.replace("/setup-profile");
  }, [status, session?.user?.id, session?.user?.username, pathname, router]);

  return <>{children}</>;
}
