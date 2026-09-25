type IconProps = { size?: number; className?: string };

const base = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export function SearchIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={2} className={className} {...base}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

export function GlobeIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={1.6} className={className} {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c4.6 3 4.6 15 0 18" />
      <path d="M12 3c-4.6 3-4.6 15 0 18" />
    </svg>
  );
}

export function ArrowUpRightIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={2.2} className={className} {...base}>
      <path d="M7 17L17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

export function SunIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={2} className={className} {...base}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
    </svg>
  );
}

export function MoonIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={2} className={className} {...base}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
    </svg>
  );
}

export function CloseIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={2.2} className={className} {...base}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function ChevronIcon({ size = 12, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={2.4} className={className} {...base}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function ExpandIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={2} className={className} {...base}>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  );
}

// The EU flag: a ring of 12 gold stars, fixed regardless of member count — same shape here, in outline.
export function EuFlagIcon({ size = 16, className }: IconProps) {
  // Fixed to 2 decimals: an un-rounded float renders as a slightly different string server- vs client-side
  // (different number of significant digits), which React flags as a hydration mismatch.
  const stars = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    return [(12 + 6.5 * Math.cos(a)).toFixed(2), (12 + 6.5 * Math.sin(a)).toFixed(2)];
  });
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={1.6} className={className} {...base}>
      <circle cx="12" cy="12" r="9.5" />
      {stars.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="0.95" fill="currentColor" stroke="none" />
      ))}
    </svg>
  );
}

export function CoffeeIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={1.8} className={className} {...base}>
      <path d="M5 9h12v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9z" />
      <path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17" />
      <path d="M8 6c0-1 .8-1.4.8-2.4S8 2 8 2M12 6c0-1 .8-1.4.8-2.4S12 2 12 2" />
    </svg>
  );
}
