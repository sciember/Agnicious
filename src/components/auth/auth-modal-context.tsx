"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

type AuthModalContextValue = {
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  openAuthModal: () => void;
  requireAuth: (action: () => void | Promise<void>) => () => void;
};

export const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
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

  return <AuthModalContext.Provider value={value}>{children}</AuthModalContext.Provider>;
}

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal must be used within AuthModalProvider");
  return ctx;
}
