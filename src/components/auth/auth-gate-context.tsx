"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

type AuthGateContextValue = {
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  openAuthModal: () => void;
  requireAuth: (action: () => void | Promise<void>) => () => void;
};

const AuthGateContext = createContext<AuthGateContextValue | null>(null);

export function AuthGateProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const openAuthModal = useCallback(() => setAuthModalOpen(true), []);

  const requireAuth = useCallback(
    (action: () => void | Promise<void>) => () => {
      if (status === "loading") return;
      if (!session?.user) {
        setAuthModalOpen(true);
        return;
      }
      void action();
    },
    [session?.user, status],
  );

  const value = useMemo(
    () => ({ authModalOpen, setAuthModalOpen, openAuthModal, requireAuth }),
    [authModalOpen, openAuthModal, requireAuth],
  );

  return <AuthGateContext.Provider value={value}>{children}</AuthGateContext.Provider>;
}

export function useAuthGate() {
  const ctx = useContext(AuthGateContext);
  if (!ctx) throw new Error("useAuthGate must be used within AuthGateProvider");
  return ctx;
}
