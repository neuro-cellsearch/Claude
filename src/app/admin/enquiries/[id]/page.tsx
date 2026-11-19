import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Card, CardHeader, StatusBadge, Badge, Notice } from "@/components/ui/primitives";
import { ActionForm } from "@/components/forms/action-form";
import { Textarea, Select, Input, Label } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { updateEnquiryStage, addActivity, enrolInSequence, inviteCustomer, createQuote } from "../../_actions/crm";
import { dateTime, gbp } from "@/lib/format";
import { INDUSTRY_LABEL } from "@/lib/content/industries";
import { SERVICE_BY_KEY } from "@/lib/content/services";
import { scoreEnquiry } from "@/lib/scoring";

export default async function EnquiryDetail(props: PageProps<"/admin/enquiries/[id]">) {
  const { id } = await props.params;
  const db = createAdminClient();
  const { data: e } = await db.from("enquiries").select("*").eq("id", id).maybeSingle();
  if (!e) notFound();
  const [{ data: acts }, { data: seqs }, { data: enrol }, { data: quotes }, { data: consults }] = await Promise.all([
    db.from("crm_activities").select("*, profiles(full_name,email)").eq("enquiry_id", id).order("created_at", { ascending: false }),
    db.from("email_sequences").select("id,name,active"),
    db.from("sequence_enrollments").select("status,current_step,next_send_at,email_sequences(name)").eq("enquiry_id", id),
    db.from("quotes").select("id,number,status,monthly_total_pence").eq("enquiry_id", id),
    db.from("consultations").select("scheduled_for,status").eq("enquiry_id", id),
  ]);
  const { reasons } = scoreEnquiry({ type: e.type, industry: e.industry, budget: e.budget, monthlyEnquiries: e.monthly_enquiries, services: e.services, phone: e.phone, company: e.company, message: e.message });

  return (
    <>
      <PageHeader title={e.company || e.name} description={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={e.stage} /><Badge>{e.type}</Badge><Badge tone="blue">score {e.score}</Badge>{e.marketing_consent && <Badge tone="green">marketing consent</Badge>}</span>} actions={<Link href="/admin/enquiries" className="text-sm text-muted hover:text-fg">← Pipeline</Link>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <dl className="grid gap-x-6 gap-y-3 text-[13.5px] sm:grid-cols-2">
              {[["Name", e.name], ["Email", <a key="e" className="text-signal-300" href={`mailto:${e.email}`}>{e.email}</a>], ["Phone", e.phone ? <a key="p" className="text-signal-300" href={`tel:${e.phone}`}>{e.phone}</a> : "—"], ["Role", e.role ?? "—"],
                ["Industry", INDUSTRY_LABEL[e.industry ?? ""] ?? "—"], ["Budget", e.budget?.replace(/_/g, "–") ?? "—"], ["Monthly enquiries", e.monthly_enquiries?.replace(/_/g, "–") ?? "—"],
                ["Est. value", e.estimated_monthly_pence ? `${gbp(e.estimated_monthly_pence)}/mo` : "—"], ["Received", dateTime(e.created_at)], ["Follow up", dateTime(e.next_follow_up_at)]].map(([k, v]) => (
                <div key={String(k)}><dt className="text-[12px] text-subtle">{k}</dt><dd className="text-fg/90">{v}</dd></div>
              ))}
            </dl>
            {e.services?.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{e.services.map((s: string) => <Badge key={s} tone="violet">{SERVICE_BY_KEY[s]?.name ?? s}</Badge>)}</div>}
            {e.message && <div className="mt-4 whitespace-pre-wrap rounded-lg border border-line bg-ink-900 p-4 text-[13.5px] text-fg/85">{e.message}</div>}
            <p className="mt-3 text-[12px] text-subtle">Score breakdown: {reasons.join(" · ")}</p>
          </Card>

          <Card>
            <CardHeader title="Log activity" />
            <ActionForm action={addActivity} submitLabel="Log" resetOnSuccess>
              <input type="hidden" name="enquiry_id" value={id} />
              <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                <Select name="type" defaultValue="note"><option value="note">Note</option><option value="call">Call</option><option value="email">Email</option><option value="meeting">Meeting</option></Select>
                <div><Label htmlFor="next_follow_up_at">Next follow-up (optional)</Label><Input id="next_follow_up_at" type="datetime-local" name="next_follow_up_at" /></div>
              </div>
              <Textarea name="body" placeholder="What happened?" className="min-h-[80px]" />
            </ActionForm>
          </Card>

          <Card>
            <CardHeader title="Timeline" />
            <ol className="space-y-3">
              {(acts ?? []).map((a) => (
                <li key={a.id} className="border-l-2 border-line pl-4">
                  <p className="text-[12px] text-subtle">{dateTime(a.created_at)} · {a.type}{a.profiles ? ` · ${(a.profiles as { full_name: string | null; email: string }).full_name ?? (a.profiles as { email: string }).email}` : ""}</p>
                  <p className="whitespace-pre-wrap text-[13.5px] text-fg/90">{a.body}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Stage" />
            <form action={updateEnquiryStage} className="space-y-3">
              <input type="hidden" name="id" value={id} />
              <Select name="stage" defaultValue={e.stage}>{["new", "contacted", "qualified", "proposal_sent", "won", "lost"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</Select>
              <Input name="lost_reason" placeholder="Reason (if lost)" defaultValue={e.lost_reason ?? ""} />
              <Button variant="secondary" className="w-full">Update stage</Button>
            </form>
          </Card>
          <Card>
            <CardHeader title="Proposal" />
            {(quotes ?? []).map((q) => <Link key={q.id} href={`/admin/quotes/${q.id}`} className="mb-2 flex justify-between rounded-lg border border-line p-2.5 text-[13px] hover:border-signal-500/40"><span>{q.number} · {gbp(q.monthly_total_pence)}/mo</span><StatusBadge status={q.status} /></Link>)}
            <form action={createQuote} className="mt-2 flex gap-2">
              <input type="hidden" name="enquiry_id" value={id} />
              <Select name="plan_id" defaultValue="growth"><option value="starter">Starter</option><option value="growth">Growth</option><option value="premium">Premium</option><option value="enterprise">Custom</option></Select>
              <Button>Create</Button>
            </form>
          </Card>
          <Card>
            <CardHeader title="Client account" />
            {e.organization_id ? <Link className="text-sm text-signal-300" href={`/admin/customers/${e.organization_id}`}>Open customer record →</Link> : (
              <ActionForm action={inviteCustomer} submitLabel="Invite to client portal" variant="secondary"><input type="hidden" name="enquiry_id" value={id} /><p className="text-[12.5px] text-muted">Creates their account and onboarding checklist and emails a secure sign-in link.</p></ActionForm>
            )}
          </Card>
          <Card>
            <CardHeader title="Follow-up sequence" />
            {(enrol ?? []).map((en, i) => <p key={i} className="mb-2 text-[13px] text-muted">{(en.email_sequences as unknown as { name: string })?.name}: <StatusBadge status={en.status} /> step {en.current_step}{en.next_send_at && ` · next ${dateTime(en.next_send_at)}`}</p>)}
            <form action={enrolInSequence} className="flex gap-2">
              <input type="hidden" name="enquiry_id" value={id} />
              <Select name="sequence_id">{(seqs ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}{s.active ? "" : " (inactive)"}</option>)}</Select>
              <Button variant="secondary">Enrol</Button>
            </form>
            <p className="mt-2 text-[11.5px] text-subtle">Only for people who contacted you. Sequences stop automatically when the stage moves past "contacted".</p>
          </Card>
          {(consults ?? []).length > 0 && <Notice title="Consultation">{consults!.map((c) => `${dateTime(c.scheduled_for)} (${c.status})`).join(", ")}</Notice>}
        </aside>
      </div>
    </>
  );
}
