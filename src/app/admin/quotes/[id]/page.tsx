import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Card, CardHeader, StatusBadge, Notice } from "@/components/ui/primitives";
import { ActionForm } from "@/components/forms/action-form";
import { Field, Input, Textarea, Select } from "@/components/ui/form";
import { Button, buttonClass } from "@/components/ui/button";
import { updateQuote, aiDraftQuote, sendQuote, markQuoteSentManually, setQuoteStatus } from "../../_actions/crm";
import { openaiConfigured } from "@/lib/integrations/openai";
import { emailConfigured } from "@/lib/integrations/email";
import { gbp, dateTime } from "@/lib/format";
import { site } from "@/lib/env";

type Item = { description: string; setup_pence: number; monthly_pence: number };

export default async function QuoteEditor(props: PageProps<"/admin/quotes/[id]">) {
  const { id } = await props.params;
  const { data: q } = await createAdminClient().from("quotes").select("*").eq("id", id).maybeSingle();
  if (!q) notFound();
  const items = (q.line_items ?? []) as Item[];
  const itemsText = items.map((i) => `${i.description} | ${(i.setup_pence / 100).toFixed(2)} | ${(i.monthly_pence / 100).toFixed(2)}`).join("\n");
  const link = `${site.url}/proposal/${q.public_token}`;
  const locked = q.status === "accepted";

  return (
    <>
      <PageHeader title={`${q.number} · ${q.title}`} description={<span className="flex items-center gap-2"><StatusBadge status={q.status} />{q.accepted_at && <span className="text-[13px] text-muted">Accepted by {q.accepted_name} on {dateTime(q.accepted_at)}</span>}</span>}
        actions={<><Link href={`/proposal/${q.public_token}`} target="_blank" className={buttonClass("secondary", "md")}>Preview client view</Link>{q.enquiry_id && <Link href={`/admin/enquiries/${q.enquiry_id}`} className={buttonClass("ghost", "md")}>Enquiry</Link>}</>} />
      {locked && <div className="mb-6"><Notice tone="green" title="Accepted">This proposal is locked. The client can pay for it from their portal's billing page after signing in with {q.recipient_email}.</Notice></div>}
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card>
          <ActionForm action={updateQuote} submitLabel="Save proposal">
            <input type="hidden" name="id" value={id} />
            <fieldset disabled={locked} className="space-y-4">
              <Field label="Title" name="title"><Input id="title" name="title" defaultValue={q.title} /></Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Recipient name" name="recipient_name"><Input id="recipient_name" name="recipient_name" defaultValue={q.recipient_name} /></Field>
                <Field label="Recipient email" name="recipient_email"><Input id="recipient_email" name="recipient_email" type="email" defaultValue={q.recipient_email} /></Field>
                <Field label="Company" name="company"><Input id="company" name="company" defaultValue={q.company ?? ""} /></Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Base plan" name="plan_id"><Select id="plan_id" name="plan_id" defaultValue={q.plan_id ?? "growth"}><option value="starter">Starter</option><option value="growth">Growth</option><option value="premium">Premium</option><option value="enterprise">Custom / enterprise</option></Select></Field>
                <Field label="Valid until" name="valid_until"><Input id="valid_until" name="valid_until" type="date" defaultValue={q.valid_until ?? ""} /></Field>
              </div>
              <Field label="Introduction" name="introduction"><Textarea id="introduction" name="introduction" className="min-h-[140px]" defaultValue={q.introduction ?? ""} /></Field>
              <Field label="Scope of work" name="scope"><Textarea id="scope" name="scope" className="min-h-[220px]" defaultValue={q.scope ?? ""} /></Field>
              <Field label="Line items" name="line_items" hint="One per line: Description | setup £ | monthly £">
                <Textarea id="line_items" name="line_items" className="min-h-[120px] font-mono text-[12.5px]" defaultValue={itemsText} placeholder={"Growth plan | 999 | 799\nAI receptionist add-on (500 mins) | 500 | 350"} />
              </Field>
            </fieldset>
          </ActionForm>
        </Card>
        <aside className="space-y-6">
          <Card>
            <CardHeader title="Totals (ex. VAT)" />
            <p className="text-[13px] text-muted">Setup</p><p className="text-xl font-semibold text-fg">{gbp(q.setup_total_pence)}</p>
            <p className="mt-2 text-[13px] text-muted">Monthly</p><p className="text-xl font-semibold text-fg">{gbp(q.monthly_total_pence)}</p>
          </Card>
          {!locked && (
            <Card>
              <CardHeader title="Draft with AI" description={openaiConfigured() ? "Rewrites the introduction and scope. Review before sending." : "Requires OPENAI_API_KEY. A template draft was generated automatically."} />
              <ActionForm action={aiDraftQuote} submitLabel="Generate AI draft" variant="secondary" pendingText="Drafting…"><input type="hidden" name="id" value={id} /></ActionForm>
            </Card>
          )}
          {["draft", "sent"].includes(q.status) && (
            <Card>
              <CardHeader title="Send to client" description={emailConfigured() ? `Emails ${q.recipient_email} a secure link.` : "Email isn't configured — copy the link below or mark as sent manually."} />
              <ActionForm action={sendQuote} submitLabel={q.status === "sent" ? "Resend email" : "Send proposal"} pendingText="Sending…"><input type="hidden" name="id" value={id} /></ActionForm>
              {q.status === "draft" && <form action={markQuoteSentManually} className="mt-3"><input type="hidden" name="id" value={id} /><Button variant="ghost" size="sm">Mark as sent manually</Button></form>}
              <p className="mt-4 break-all rounded-lg bg-ink-900 p-2 font-mono text-[11.5px] text-muted">{link}</p>
            </Card>
          )}
          {!locked && (
            <Card>
              <CardHeader title="Status" />
              <div className="flex flex-wrap gap-2">
                {["declined", "expired", "draft"].filter((s) => s !== q.status).map((s) => (
                  <form key={s} action={setQuoteStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={s} /><Button size="sm" variant="outline">Mark {s}</Button></form>
                ))}
              </div>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
