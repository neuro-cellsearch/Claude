import { cn } from "./cn";
import type { ComponentProps, ReactNode } from "react";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("surface-raised p-5", className)} {...props} />;
}

export function CardHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
        {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

const tones = {
  neutral: "bg-ink-700 text-muted border-line-strong",
  blue: "bg-signal-500/12 text-signal-300 border-signal-500/30",
  violet: "bg-aura-500/12 text-aura-400 border-aura-500/30",
  green: "bg-success/12 text-success border-success/30",
  amber: "bg-warning/12 text-warning border-warning/30",
  red: "bg-danger/12 text-danger border-danger/30",
} as const;
export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11.5px] font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, Tone> = {
  active: "green", paid: "green", won: "green", done: "green", completed: "green", sent: "green", accepted: "green",
  approved: "green", resolved: "green", confirmed: "green", booked: "blue", scheduled: "blue", qualified: "blue",
  configured: "green", interested: "green", replied: "blue",
  new: "blue", open: "blue", contacted: "violet", proposal_sent: "violet", in_build: "violet", testing: "amber",
  awaiting_approval: "amber", pending: "amber", pending_approval: "amber", in_progress: "violet", onboarding: "violet",
  trialing: "blue", requested: "neutral", draft: "neutral", todo: "neutral", submitted: "blue", reviewing: "violet",
  quoted: "violet", waiting_on_customer: "amber", partial: "amber", not_configured: "amber", prospect: "neutral",
  past_due: "red", failed: "red", lost: "red", canceled: "red", cancelled: "red", churned: "red", declined: "red",
  blocked: "red", do_not_contact: "red", suppressed: "red", missing: "neutral", no_show: "red", not_interested: "neutral",
  paused: "amber", expired: "neutral", retired: "neutral", closed: "neutral", skipped: "neutral", urgent: "red", high: "amber",
  normal: "neutral", low: "neutral", queued: "neutral", stopped: "neutral", rescheduled: "amber", incomplete: "amber",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = status ?? "unknown";
  return <Badge tone={STATUS_TONES[s] ?? "neutral"}>{s.replace(/_/g, " ")}</Badge>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "up" | "down" | "neutral" }) {
  return (
    <div className="surface-raised p-4">
      <p className="text-[12px] font-medium uppercase tracking-wider text-subtle">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-fg tabular-nums">{value}</p>
      {hint && (
        <p className={cn("mt-1 text-[12.5px]", tone === "up" ? "text-success" : tone === "down" ? "text-danger" : "text-muted")}>{hint}</p>
      )}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong px-6 py-12 text-center">
      <p className="text-sm font-medium text-fg">{title}</p>
      {description && <p className="mt-1.5 max-w-md text-[13px] text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "blue", title, children }: { tone?: "blue" | "amber" | "red" | "green"; title?: string; children: ReactNode }) {
  const map = {
    blue: "border-signal-500/30 bg-signal-500/8 text-signal-300",
    amber: "border-warning/30 bg-warning/8 text-warning",
    red: "border-danger/30 bg-danger/8 text-danger",
    green: "border-success/30 bg-success/8 text-success",
  };
  return (
    <div className={cn("rounded-xl border px-4 py-3 text-[13px]", map[tone])}>
      {title && <p className="mb-0.5 font-semibold">{title}</p>}
      <div className="text-fg/80">{children}</div>
    </div>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-line", className)}>
      <table className="w-full min-w-[640px] text-left text-[13px]">{children}</table>
    </div>
  );
}
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("border-b border-line bg-ink-850 px-4 py-2.5 text-[11.5px] font-medium uppercase tracking-wider text-subtle", className)}>{children}</th>;
}
export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cn("border-b border-line/70 px-4 py-3 align-top text-fg/90", className)}>{children}</td>;
}

export function Progress({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
      <div className="h-full rounded-full bg-gradient-to-r from-signal-500 to-aura-500" style={{ width: `${v}%` }} />
    </div>
  );
}
