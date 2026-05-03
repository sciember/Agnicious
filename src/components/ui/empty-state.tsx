"use client";

import Link from "next/link";
import { motion } from "framer-motion";

type Props = {
  title: string;
  description: string;
  ctaLabel: string;
  onCta?: () => void;
  ctaHref?: string;
  illustration?: "journey" | "tasks" | "chart" | "people" | "bell";
};

function Illustration({ variant }: { variant: NonNullable<Props["illustration"]> }) {
  if (variant === "tasks") {
    return (
      <svg viewBox="0 0 120 100" className="h-28 w-36 text-primary" aria-hidden>
        <rect x="20" y="24" width="80" height="52" rx="8" fill="currentColor" fillOpacity="0.12" />
        <path stroke="currentColor" strokeWidth="2.5" fill="none" d="M32 40h56M32 54h40M32 68h48" strokeLinecap="round" />
        <circle cx="88" cy="30" r="14" fill="currentColor" fillOpacity="0.25" />
        <path stroke="currentColor" strokeWidth="2.5" fill="none" d="M84 30l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (variant === "chart") {
    return (
      <svg viewBox="0 0 120 100" className="h-28 w-36 text-primary" aria-hidden>
        <rect x="16" y="20" width="88" height="60" rx="10" fill="currentColor" fillOpacity="0.08" />
        <path d="M28 72 L44 48 L60 58 L76 36 L92 52" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="44" cy="48" r="4" fill="currentColor" />
        <circle cx="76" cy="36" r="4" fill="currentColor" />
      </svg>
    );
  }
  if (variant === "people") {
    return (
      <svg viewBox="0 0 120 100" className="h-28 w-36 text-primary" aria-hidden>
        <circle cx="42" cy="38" r="14" fill="currentColor" fillOpacity="0.2" />
        <circle cx="78" cy="38" r="14" fill="currentColor" fillOpacity="0.2" />
        <path
          d="M24 88c4-16 16-24 30-24s26 8 30 24M60 88c4-16 16-24 30-24s26 8 30 24"
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (variant === "bell") {
    return (
      <svg viewBox="0 0 120 100" className="h-28 w-36 text-primary" aria-hidden>
        <path
          d="M52 22c0-8 6-14 14-14s14 6 14 14v6c10 4 16 14 16 26v22H36V54c0-12 6-22 16-26v-6z"
          fill="currentColor"
          fillOpacity="0.15"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <path d="M48 82h28" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 100" className="h-28 w-36 text-primary" aria-hidden>
      <path
        d="M60 18c-18 0-32 14-32 32 0 14 10 26 22 30v8h20v-8c12-4 22-16 22-30 0-18-14-32-32-32z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <path d="M44 62c6 8 14 12 22 12s16-4 22-12" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyState({ title, description, ctaLabel, onCta, ctaHref, illustration = "journey" }: Props) {
  const ctaClass = "btn-primary inline-flex px-6";

  return (
    <div className="glass-panel flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4">{Illustration({ variant: illustration })}</div>
      <h2 className="text-lg font-semibold text-text">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-text-muted">{description}</p>
      <div className="mt-6">
        {ctaHref ? (
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Link href={ctaHref} className={ctaClass} onClick={onCta}>
              {ctaLabel}
            </Link>
          </motion.div>
        ) : (
          <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className={ctaClass} onClick={onCta}>
            {ctaLabel}
          </motion.button>
        )}
      </div>
    </div>
  );
}
