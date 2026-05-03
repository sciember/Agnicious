"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";
import { Toaster as SonnerToaster } from "sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";

type Props = {
  children: React.ReactNode;
};

export function Providers({ children }: Props) {
  return (
    <ThemeProvider>
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
          richColors
          toastOptions={{
            className: "bg-card text-text border border-border",
          }}
        />
      </SessionProvider>
    </ThemeProvider>
  );
}
