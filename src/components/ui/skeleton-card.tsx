import clsx from "clsx";

type Props = {
  className?: string;
  lines?: number;
};

/** Shimmer panel for loading placeholders (replaces plain “Loading…” blocks). */
export function SkeletonCard({ className, lines = 3 }: Props) {
  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm backdrop-blur-md",
        className,
      )}
      aria-hidden
    >
      <div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent dark:via-white/10"
        style={{ animation: "shimmer 1.4s ease-in-out infinite" }}
      />
      <div className="space-y-3">
        <div className="h-3 w-1/3 rounded-md bg-text-subtle/25" />
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className={clsx("h-3 rounded-md bg-text-subtle/20", i === lines - 1 ? "w-4/5" : "w-full")} />
        ))}
      </div>
    </div>
  );
}
