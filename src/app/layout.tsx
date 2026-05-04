import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Sciember",
  description: "Sciember habit platform with AI coaching, streaks, and social motivation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-text font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
