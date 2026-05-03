type Props = {
  values: number[];
  accent?: string;
  className?: string;
};

/** Tiny 7-day (or n-day) sparkline under stat numbers. */
export function MiniSparkline({ values, accent = "currentColor", className }: Props) {
  if (!values.length) return null;
  const max = Math.max(1, ...values);
  const w = 72;
  const h = 22;
  const pad = 2;
  const pts = values.map((v, i) => {
    const x = pad + (i / Math.max(1, values.length - 1)) * (w - pad * 2);
    const y = h - pad - (v / max) * (h - pad * 2);
    return `${x},${y}`;
  });
  const d = `M ${pts.join(" L ")}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      width={w}
      height={h}
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke={accent}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
    </svg>
  );
}
