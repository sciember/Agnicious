/** Normalize @-prefixed or raw input to stored username (lowercase). */
export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/g, "").toLowerCase();
}

export function validateUsernameFormat(norm: string): { ok: true } | { ok: false; error: string } {
  if (norm.length < 3 || norm.length > 20) {
    return { ok: false, error: "Username must be 3–20 characters." };
  }
  if (!/^[a-z0-9_]+$/.test(norm)) {
    return { ok: false, error: "Use lowercase letters, numbers, and underscores only." };
  }
  return { ok: true };
}
