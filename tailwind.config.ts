import type { Config } from "tailwindcss";

/**
 * Agnicious — Tailwind v4 reads primary tokens from `src/app/globals.css` (@theme).
 * This config keeps content paths for tooling; extend colors here only if you need
 * legacy tooling compatibility alongside CSS `@theme`.
 */
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
} satisfies Config;
