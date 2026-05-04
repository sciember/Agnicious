"use client";

import clsx from "clsx";

type Variant = "chart" | "list" | "pill";

export function SkeletonLoader({
  variant = "list",
  className,
  lines = 3,
}: {
  variant?: Variant;
  className?: string;
  /** Only used for `list` variant. */
  lines?: 2 | 3;
}) {
  if (variant === "pill") {
    return (
      <div
        className={clsx("skeleton-shimmer h-5 w-16 rounded-full", className)}
        aria-hidden
      />
    );
  }

  if (variant === "chart") {
    return (
      <div
        className={clsx("skeleton-shimmer h-60 w-full rounded-2xl", className)}
        aria-hidden
      />
    );
  }

  const widths = lines === 2 ? ["w-full", "w-3/4"] : ["w-full", "w-3/4", "w-1/2"];

  return (
    <div className={clsx("space-y-3", className)} aria-hidden>
      {widths.map((w, i) => (
        <div key={i} className={clsx("skeleton-shimmer h-4 rounded-lg", w)} />
      ))}
    </div>
  );
}

