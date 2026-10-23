// Vinyl-disc mark drawn in SVG: outer disc, groove rings, label, spindle hole.
const RINGS = [44, 40, 36, 32, 28] as const;

export function VinylMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="groove"
      className="shrink-0"
    >
      <circle cx="50" cy="50" r="48" fill="currentColor" />
      {RINGS.map((r) => (
        <circle
          key={r}
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--background)"
          strokeWidth="0.6"
          opacity="0.55"
        />
      ))}
      <circle cx="50" cy="50" r="16" fill="var(--background)" />
      <circle cx="50" cy="50" r="3" fill="currentColor" />
    </svg>
  );
}
