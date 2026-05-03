import clsx from "clsx";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx("animate-pulse rounded-lg bg-text-subtle/20", className)}
      aria-hidden
    />
  );
}
