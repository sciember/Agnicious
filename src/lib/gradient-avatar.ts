function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function gradientForUser(seed: string): { from: string; to: string } {
  const h = hashSeed(seed || "user");
  const hue1 = h % 360;
  const hue2 = (h * 7 + 140) % 360;
  return {
    from: `hsl(${hue1} 72% 46%)`,
    to: `hsl(${hue2} 68% 38%)`,
  };
}

export function initialsFromDisplay(display: string, fallbackId: string): string {
  const t = display.trim();
  if (!t) return fallbackId.slice(0, 2).toUpperCase();
  const p = t.split(/\s+/);
  const a = p[0]?.[0] ?? "";
  const b = p[1]?.[0] ?? "";
  return ((a + b) || t.slice(0, 2)).toUpperCase();
}
