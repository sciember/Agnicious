/** Public-safe label: displayName, else first name only from `name`, never email. */
export function publicDisplayName(displayName: string | null | undefined, name: string | null | undefined): string {
  const d = displayName?.trim();
  if (d) return d;
  const n = name?.trim();
  if (n) return n.split(/\s+/)[0] ?? "User";
  return "User";
}

/** Settings-only masked email e.g. joh***@gmail.com */
export function maskEmail(email: string | null | undefined): string {
  if (!email?.includes("@")) return "—";
  const [local, domain] = email.split("@");
  if (!domain) return "—";
  const prefix = local.slice(0, Math.min(3, local.length));
  return `${prefix}***@${domain}`;
}
