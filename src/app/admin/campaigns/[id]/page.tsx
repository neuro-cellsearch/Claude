import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Card, CardHeader, StatusBadge, Notice, Badge, EmptyState } from "@/components/ui/primitives";
import { ActionForm } from "@/components/forms/action-form";
import { Input, Textarea, Checkbox } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { addRecipients, updateRecipient, recipientAction, approveAllPending, campaignAction, sendCampaignBatch } from "../../_actions/outreach";
import { outreachEligibility } from "@/lib/sales/compliance";
import { unresolvedPlaceholders } from "@/lib/templating";
import { emailConfigured } from "@/lib/integrations/email";
import { dateTime } from "@/lib/format";

function RAction({ id, op, label, variant = "secondary" }: { id: string; op: string; label: string; variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return <form action={recipientAction}><input type="hidden" name="id" value={id} /><input type="hidden" name="op" value={op} /><Button size="sm" variant={variant}>{label}</Button></form>;
}

export default async function CampaignDetail(props: PageProps<"/admin/campaigns/[id]">) {
  const { id } = await props.params;
  const { profile } = await requireStaff();
  const db = createAdminClient();
  const { data: c } = await db.from("outreach_campaigns").select("*, outreach_templates(name)").eq("id", id).maybeSingle();
  if (!c) notFound();
  const [{ data: recipients }, { data: approvedProspects }] = await Promise.all([
    db.from("campaign_recipients").select("*, prospects(company_name,contact_name,business_email,business_phone,linkedin_url)").eq("campaign_id", id).order("created_at"),
    db.from("prospects").select("*").eq("status", "approved").limit(500),
  ]);
  const inCampaign = new Set((recipients ?? []).map((r) => r.prospect_id));
  const candidates = (approvedProspects ?? []).filter((p) => !inCampaign.has(p.id)).map((p) => ({ p, e: outreachEligibility(p, c.channel, false) }));
  const counts = (s: string) => (recipients ?? []).filter((r) => r.status === s).length;
  const isAdmin = profile.role === "admin";
  const editable = ["draft", "pending_approval"].includes(c.status);

  return (
    <>
      <PageHeader title={c.name} description={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={c.status} /><Badge tone="violet">{c.channel}</Badge><span className="text-[13px] text-muted">Template: {(c.outreach_templates as { name: string } | null)?.name ?? "deleted"} · daily limit {c.daily_limit} · pending {counts("pending")} · approved {counts("approved")} · sent {counts("sent")} · replied {counts("replied")}</span></span>} />

      <div className="mb-6 flex flex-wrap gap-3">
        {c.status === "draft" && <ActionForm action={campaignAction} submitLabel="Submit for approval"><input type="hidden" name="id" value={id} /><input type="hidden" name="op" value="submit" /></ActionForm>}
        {c.status === "pending_approval" && isAdmin && <ActionForm action={campaignAction} submitLabel="Approve campaign"><input type="hidden" name="id" value={id} /><input type="hidden" name="op" value="approve" /></ActionForm>}
        {c.status === "pending_approval" && !isAdmin && <Notice>Waiting for an administrator to approve this campaign.</Notice>}
        {["approved", "sending"].includes(c.status) && c.channel === "email" && isAdmin && (
          <ActionForm action={sendCampaignBatch} submitLabel={`Send next batch (≤ ${c.daily_limit}/day)`} pendingText="Sending…"><input type="hidden" name="id" value={id} />{!emailConfigured() && <p className="text-[12px] text-warning">Email provider not configured — sending is disabled.</p>}</ActionForm>
        )}
        {["approved", "sending"].includes(c.status) && <ActionForm action={campaignAction} submitLabel="Mark completed" variant="secondary"><input type="hidden" name="id" value={id} /><input type="hidden" name="op" value="complete" /></ActionForm>}
        {!["completed", "cancelled"].includes(c.status) && <ActionForm action={campaignAction} submitLabel="Cancel campaign" variant="danger"><input type="hidden" name="id" value={id} /><input type="hidden" name="op" value="cancel" /></ActionForm>}
      </div>
      {c.channel !== "email" && <div className="mb-6"><Notice tone="blue" title="Manual channel">{c.channel === "linkedin" ? "Send each approved message yourself from LinkedIn, then click 'Mark done'." : "Call each approved prospect using the script, then click 'Mark done'. Re-check TPS within 28 days of calling."}</Notice></div>}

      {editable && (
        <Card className="mb-6">
          <CardHeader title="Add approved prospects" description="Only approved prospects that pass the compliance checks for this channel can be added." />
          {!candidates.length ? <EmptyState title="No approved prospects available" description="Approve prospects on the Prospects page first." /> : (
            <ActionForm action={addRecipients} submitLabel="Add selected & personalise">
              <input type="hidden" name="campaign_id" value={id} />
              <div className="grid max-h-72 gap-1.5 overflow-auto sm:grid-cols-2">
                {candidates.map(({ p, e }) => (
                  <div key={p.id} className={`rounded-lg border p-2 ${e.ok ? "border-line" : "border-danger/30 opacity-60"}`}>
                    {e.ok ? <Checkbox name="prospect_ids" value={p.id} label={<><span className="text-fg">{p.company_name}</span> <span className="text-subtle">{p.contact_name}</span></>} /> : <p className="text-[12.5px] text-muted">{p.company_name}: <span className="text-danger">{e.reason}</span></p>}
                  </div>
                ))}
              </div>
            </ActionForm>
          )}
        </Card>
      )}

      <Card>
        <CardHeader title="Messages" description="Review and personalise every message. Messages with unfilled {{placeholders}} cannot be approved." action={editable && counts("pending") > 0 ? <form action={approveAllPending}><input type="hidden" name="campaign_id" value={id} /><Button size="sm" variant="secondary">Approve all clean pending</Button></form> : undefined} />
        {!recipients?.length ? <EmptyState title="No recipients yet" /> : (
          <div className="space-y-4">
            {recipients.map((r) => {
              const p = r.prospects as { company_name: string; contact_name: string | null; business_email: string | null; business_phone: string | null; linkedin_url: string | null };
              const missing = unresolvedPlaceholders(`${r.subject ?? ""}\n${r.body}`);
              return (
                <div key={r.id} className="rounded-xl border border-line bg-ink-900 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13.5px]"><span className="font-medium text-fg">{p.company_name}</span> <span className="text-subtle">{p.contact_name} · {c.channel === "email" ? p.business_email : c.channel === "phone" ? p.business_phone : <a className="text-signal-300" href={p.linkedin_url && /^https?:\/\//i.test(p.linkedin_url) ? p.linkedin_url : "#"} target="_blank" rel="noreferrer">LinkedIn profile</a>}</span></p>
                    <div className="flex items-center gap-2"><StatusBadge status={r.status} />{r.sent_at && <span className="text-[11.5px] text-subtle">{dateTime(r.sent_at)}</span>}</div>
                  </div>
                  {missing.length > 0 && <p className="mb-2 text-[12px] text-warning">Fill in: {missing.map((m) => `{{${m}}}`).join(", ")}</p>}
                  {r.error && <p className="mb-2 text-[12px] text-danger">{r.error}</p>}
                  {["pending", "approved"].includes(r.status) && editable ? (
                    <ActionForm action={updateRecipient} submitLabel="Save edits" size="sm" variant="ghost" className="space-y-2">
                      <input type="hidden" name="id" value={r.id} />
                      {c.channel === "email" && <Input name="subject" defaultValue={r.subject ?? ""} />}
                      <Textarea name="body" defaultValue={r.body} className="min-h-[180px] font-mono text-[12.5px]" />
                    </ActionForm>
                  ) : (
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-ink-950 p-3 text-[12.5px] text-fg/80">{r.subject ? `Subject: ${r.subject}\n\n` : ""}{r.body}</pre>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.status === "pending" && !missing.length && <RAction id={r.id} op="approve" label="Approve message" variant="primary" />}
                    {["pending", "approved"].includes(r.status) && <RAction id={r.id} op="skip" label="Skip" variant="ghost" />}
                    {r.status === "skipped" && editable && <RAction id={r.id} op="reset" label="Restore" variant="ghost" />}
                    {r.status === "approved" && c.channel !== "email" && ["approved", "sending"].includes(c.status) && <RAction id={r.id} op="mark_sent" label="Mark done" variant="primary" />}
                    {r.status === "sent" && <RAction id={r.id} op="replied" label="Mark replied" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
