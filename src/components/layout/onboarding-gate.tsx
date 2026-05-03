"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    if (!session.user.username) return;
    if (session.user.onboardingCompleted !== false) return;
    if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) return;
    if (pathname === "/setup-profile") return;
    router.replace("/onboarding");
  }, [status, session?.user?.id, session?.user?.username, session?.user?.onboardingCompleted, pathname, router]);

  return <>{children}</>;
}
