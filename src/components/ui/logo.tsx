import { cn } from "./cn";

/**
 * Kairo mark: a vertical stroke (stability) met by a forward chevron (momentum),
 * with a signal node at the junction — "the moment an opportunity is captured".
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={cn("h-7 w-7", className)}>
      <defs>
        <linearGradient id="kairo-g" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8CBCFF" />
          <stop offset="0.55" stopColor="#2F7BFF" />
          <stop offset="1" stopColor="#8467FF" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="31" height="31" rx="9" fill="#0D1015" stroke="#232A35" />
      <path d="M10 7.5v17" stroke="url(#kairo-g)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M22.5 7.5 14 16l8.5 8.5" stroke="url(#kairo-g)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="14" cy="16" r="2.2" fill="#EEF1F6" />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && (
        <span className="text-[15px] font-semibold tracking-tight text-fg">
          Kairo<span className="text-muted font-normal"> Systems</span>
        </span>
      )}
    </span>
  );
}
