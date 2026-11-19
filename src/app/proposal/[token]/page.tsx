import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRole, site } from "@/lib/env";
import { Logo } from "@/components/ui/logo";
import { ActionForm } from "@/components/forms/action-form";
import { Input, Checkbox, Label } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";
import { acceptProposal } from "./actions";
import { gbp, date } from "@/lib/format";
import { CheckCircle2 } from "lucide-react";

export const metadata: Metadata = { title: "Proposal", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Item = { description: string; setup_pence: number; monthly_pence: number };

export default async function ProposalPage(props: PageProps<"/proposal/[token]">) {
  const { token } = await props.params;
  if (!hasServiceRole() || !/^[a-f0-9]{64}$/.test(token)) notFound();
  const { data: q } = await createAdminClient().from("quotes").select("*").eq("public_token", token).maybeSingle();
  if (!q || q.status === "draft") notFound();
  const items = (q.line_items ?? []) as Item[];
  const expired = q.status === "expired" || (q.valid_until && q.valid_until < new Date().toISOString().slice(0, 10) && q.status === "sent");

  return (
    <div className="min-h-dvh bg-ink-950 py-10 print:py-0">
      <div className="print-plain mx-auto max-w-3xl rounded-2xl border border-line bg-ink-900 p-8 sm:p-12">
        <div className="flex items-start justify-between">
          <Logo />
          <div className="text-right text-[12.5px] text-muted"><p className="font-mono">{q.number}</p><p>Issued {date(q.sent_at ?? q.created_at)}</p><p>Valid until {date(q.valid_until)}</p></div>
        </div>
        <p className="eyebrow mt-12">Proposal for {q.company || q.recipient_name}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg">{q.title}</h1>
        <p className="mt-2 text-muted">Prepared for {q.recipient_name}</p>

        {q.introduction && <section className="mt-10"><h2 className="text-lg font-semibold text-fg">Introduction</h2><p className="mt-3 whitespace-pre-line leading-relaxed text-fg/85">{q.introduction}</p></section>}
        {q.scope && <section className="mt-10"><h2 className="text-lg font-semibold text-fg">Scope of work</h2><p className="mt-3 whitespace-pre-line leading-relaxed text-fg/85">{q.scope}</p></section>}

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-fg">Investment</h2>
          <table className="mt-4 w-full text-left text-[14px]">
            <thead><tr className="border-b border-line text-[12px] uppercase tracking-wider text-subtle"><th className="py-2">Item</th><th className="py-2 text-right">One-off setup</th><th className="py-2 text-right">Monthly</th></tr></thead>
            <tbody>
              {items.map((i, idx) => <tr key={idx} className="border-b border-line/60"><td className="py-3 text-fg/90">{i.description}</td><td className="py-3 text-right tabular-nums">{gbp(i.setup_pence)}</td><td className="py-3 text-right tabular-nums">{gbp(i.monthly_pence)}</td></tr>)}
              <tr className="font-semibold text-fg"><td className="py-3">Total (ex. VAT)</td><td className="py-3 text-right tabular-nums">{gbp(q.setup_total_pence)}</td><td className="py-3 text-right tabular-nums">{gbp(q.monthly_total_pence)}</td></tr>
            </tbody>
          </table>
          <p className="mt-3 text-[12.5px] text-subtle">Prices exclude VAT. Initial term 3 months, then monthly with 30 days' notice. Subject to our <Link className="underline" href="/terms">terms and conditions</Link>. Estimates of benefit are illustrative and not guaranteed.</p>
        </section>

        <section className="no-print mt-12 rounded-xl border border-line bg-ink-850 p-6">
          {q.status === "accepted" ? (
            <div>
              <p className="flex items-center gap-2 font-semibold text-success"><CheckCircle2 size={18} /> Accepted by {q.accepted_name} on {date(q.accepted_at)}</p>
              <p className="mt-3 text-[14px] text-muted">Next step: create your client account using <strong className="text-fg">{q.recipient_email}</strong> (or sign in), then complete payment from the Billing page to start implementation.</p>
              <div className="mt-4 flex flex-wrap gap-3"><Link className={buttonClass("primary", "md")} href="/register">Create account</Link><Link className={buttonClass("secondary", "md")} href="/login?next=/portal/billing">Sign in</Link></div>
            </div>
          ) : expired || q.status !== "sent" ? (
            <p className="text-muted">This proposal is {expired ? "expired" : q.status}. Please contact <a className="text-signal-300 underline" href={`mailto:${site.email}`}>{site.email}</a> for an updated version.</p>
          ) : (
            <ActionForm action={acceptProposal} submitLabel="Accept proposal" size="lg">
              <input type="hidden" name="token" value={token} />
              <p className="font-semibold text-fg">Accept this proposal</p>
              <div><Label htmlFor="accepted_name">Your full name</Label><Input id="accepted_name" name="accepted_name" required /></div>
              <Checkbox name="authority" required label={`I am authorised to accept this proposal on behalf of ${q.company || "the business"}, and agree to the terms and conditions.`} />
            </ActionForm>
          )}
        </section>
        <p className="mt-8 text-center text-[12px] text-subtle">{site.legalName}{site.address && ` · ${site.address}`} · {site.email}</p>
      </div>
      <div className="no-print mt-4 text-center"><span className="text-[12.5px] text-subtle">Tip: use your browser's Print → Save as PDF for a copy.</span></div>
    </div>
  );
}
