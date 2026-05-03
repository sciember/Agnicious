"use client";

import { useSession } from "next-auth/react";
import { useAuthModal } from "@/components/auth/auth-modal-context";

export function ShellHeader() {
  const { data: session, status } = useSession();
  const { openAuthModal } = useAuthModal();

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-end border-b border-border bg-surface/90 px-4 backdrop-blur-md">
      {status !== "loading" && !session?.user ? (
        <button type="button" className="btn-primary text-xs sm:text-sm" onClick={openAuthModal}>
          Sign In
        </button>
      ) : null}
    </header>
  );
}
