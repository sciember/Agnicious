import type { Config } from "tailwindcss";

/**
 * Sciember — Tailwind v4 reads tokens from `src/app/globals.css` (`@theme inline`).
 *
 * Light palette (reference):
 * - Page: `--bg` #F9FAFB · Main column: `--bg-canvas` #F3F4F6 · Surfaces/cards: #FFFFFF
 * - Border: #E5E7EB · Focus: #6366F1
 * - Text: #111827 / muted #6B7280 / subtle #9CA3AF
 * - Primary: #6366F1 · soft #EEF2FF · hover #4F46E5
 * - Accent: green #10B981 · amber #F59E0B · red #EF4444 · blue #3B82F6 (+ soft variants in CSS)
 */
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
} satisfies Config;
