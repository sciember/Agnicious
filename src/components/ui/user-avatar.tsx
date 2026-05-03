"use client";

import { gradientForUser, initialsFromDisplay } from "@/lib/gradient-avatar";

export function UserAvatar({
  photoUrl,
  displayName,
  seed,
  size = 40,
  className = "",
}: {
  photoUrl: string | null | undefined;
  displayName: string;
  seed: string;
  size?: number;
  className?: string;
}) {
  const initials = initialsFromDisplay(displayName, seed);
  const g = gradientForUser(seed);

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        width={size}
        height={size}
        className={`shrink-0 overflow-hidden rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white ${className}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${g.from}, ${g.to})`,
      }}
      aria-hidden
    >
      {initials}
    </div>
  );
}
