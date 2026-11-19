import Link from "next/link";
import { Check } from "lucide-react";
import { gbp } from "@/lib/format";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import type { Plan } from "@/lib/content/plans";

export function PricingCards({ plans }: { plans: Plan[] }) {
  const tiers = plans.filter((p) => p.id !== "enterprise");
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {tiers.map((p) => {
        const featured = p.id === "growth";
        return (
          <div key={p.id} className={cn("relative flex flex-col rounded-2xl border p-7", featured ? "border-signal-500/50 bg-ink-800 glow-ring" : "border-line bg-ink-850")}>
            {featured && <span className="absolute -top-3 left-7 rounded-full bg-signal-500 px-3 py-1 text-[11px] font-medium text-white">Most chosen</span>}
            <p className="text-[15px] font-semibold text-fg">{p.name}</p>
            <p className="mt-2 min-h-[44px] text-[13.5px] text-muted">{p.description}</p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-semibold tracking-tight text-fg">{gbp(p.monthly_pence)}</span>
              <span className="text-sm text-muted">/month</span>
            </div>
            <p className="mt-1 text-[13px] text-subtle">+ {gbp(p.setup_fee_pence)} one-off setup · ex. VAT</p>
            <ul className="mt-6 flex-1 space-y-3">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2.5 text-[13.5px] text-fg/85">
                  <Check size={16} className="mt-0.5 shrink-0 text-signal-400" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-8 grid gap-2">
              <Link href={`/register?plan=${p.id}`} className={buttonClass(featured ? "primary" : "secondary", "lg")}>Get started</Link>
              <Link href="/book" className={buttonClass("ghost", "sm")}>Talk it through first</Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function EnterpriseCard() {
  return (
    <div className="mt-5 flex flex-col items-start justify-between gap-5 rounded-2xl border border-line bg-ink-850 p-7 md:flex-row md:items-center">
      <div>
        <p className="text-[15px] font-semibold text-fg">Enterprise &amp; custom</p>
        <p className="mt-1 max-w-2xl text-[13.5px] text-muted">Multi-site operations, high call volumes, bespoke integrations or SLAs. Scoped and quoted individually after a discovery session.</p>
      </div>
      <Link href="/quote" className={buttonClass("outline", "md")}>Request a tailored quote</Link>
    </div>
  );
}

export function PricingDisclaimer() {
  return (
    <p className="mx-auto mt-8 max-w-3xl text-center text-[12.5px] leading-relaxed text-subtle">
      All prices exclude VAT. Final pricing and usage allowances depend on the integrations required, call and message volumes, AI usage and implementation complexity — we confirm everything in a written proposal before you commit. Telephony and messaging usage above agreed allowances is billed at cost plus a transparent margin.
    </p>
  );
}
