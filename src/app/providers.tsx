"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";

type Props = {
  children: React.ReactNode;
};

export function Providers({ children }: Props) {
  return (
    <SessionProvider>
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3200,
          className: "!bg-card !text-text !border !border-border-subtle !rounded-xl !shadow-lg",
        }}
      />
    </SessionProvider>
  );
}
