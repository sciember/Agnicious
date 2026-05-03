import type { Metadata } from "next";
import { DM_Mono, Sora } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Agnicious",
  description: "Agnicious habit platform with AI coaching, streaks, and social motivation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sora.variable} ${dmMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-text font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
