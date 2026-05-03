"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export function ShellHeader() {
  const { data: session, status } = useSession();

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-end border-b border-border bg-surface/90 px-4 backdrop-blur-md">
      {status !== "loading" && !session?.user ? (
        <Link href="/sign-in" className="btn-primary text-xs sm:text-sm">
          Sign In
        </Link>
      ) : null}
    </header>
  );
}
