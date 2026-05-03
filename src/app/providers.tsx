"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";
import { Toaster as SonnerToaster } from "sonner";

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
          className: "!bg-card !text-text !border !border-border !rounded-xl !shadow-[0_1px_3px_rgba(0,0,0,0.08)]",
        }}
      />
      <SonnerToaster
        position="top-center"
        theme="light"
        richColors
        toastOptions={{
          className: "bg-card text-text border border-border",
        }}
      />
    </SessionProvider>
  );
}
