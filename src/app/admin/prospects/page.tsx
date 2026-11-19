import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Card, CardHeader, Table, Th, Td, StatusBadge, EmptyState, Notice, Badge } from "@/components/ui/primitives";
import { ActionForm } from "@/components/forms/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { createProspect, prospectAction, addSuppression } from "../_actions/outreach";
import { CORPORATE_ENTITIES, TPS_VALIDITY_DAYS } from "@/lib/sales/compliance";
import { INDUSTRY_OPTIONS, INDUSTRY_LABEL } from "@/lib/content/industries";
import { date } from "@/lib/format";

function Op({ id, op, label, tone = "text-signal-300" }: { id: string; op: string; label: string; tone?: string }) {
  return <form action={prospectAction} className="inline"><input type="hidden" name="id" value={id} /><input type="hidden" name="op" value={op} /><button className={`text-[12px] hover:underline ${tone}`}>{label}</button></form>;
}

export default async function ProspectsPage(props: PageProps<"/admin/prospects">) {
  const sp = await props.searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const db = createAdminClient();
  let q = db.from("prospects").select("*").order("created_at", { ascending: false }).limit(500);
  if (status) q = q.eq("status", status);
  const [{ data }, { data: suppression }] = await Promise.all([q, db.from("suppression_list").select("*").order("created_at", { ascending: false }).limit(50)]);
  const tpsFresh = (d: string | null) => d && (Date.now() - new Date(d).getTime()) / 86400_000 <= TPS_VALIDITY_DAYS;

  return (
    <>
      <PageHeader title="Prospects" description="Businesses you've researched for B2B outreach. Nothing is contacted until you approve the prospect AND each message." />
      <Notice tone="amber" title="UK compliance rules enforced by this system">
        Cold email only to corporate subscribers (Ltd, LLP, PLC, Scottish partnerships, public bodies) — sole traders and other partnerships need prior consent. Calls only to numbers screened against TPS/CTPS within {TPS_VALIDITY_DAYS} days. Record where every contact detail came from; never scrape personal data. Objections go on the suppression list permanently. LinkedIn messages are sent manually by you — automated LinkedIn messaging breaches LinkedIn's terms.
      </Notice>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card>
          <div className="mb-4 flex flex-wrap gap-2 text-[13px]">
            {["", "new", "approved", "contacted", "replied", "interested", "not_interested", "do_not_contact"].map((s) => <a key={s} href={s ? `?status=${s}` : "?"} className={`rounded-md px-2.5 py-1 ${status === s ? "bg-ink-700 text-fg" : "text-muted hover:text-fg"}`}>{s ? s.replace(/_/g, " ") : "All"}</a>)}
          </div>
          {!data?.length ? <EmptyState title="No prospects" description="Add businesses you've researched using the form." /> : (
            <Table><thead><tr><Th>Business</Th><Th>Contact</Th><Th>Eligibility</Th><Th>Status</Th><Th>Actions</Th></tr></thead>
              <tbody>{data.map((p) => {
                const corporate = (CORPORATE_ENTITIES as readonly string[]).includes(p.entity_type);
                return (
                  <tr key={p.id}>
                    <Td><p className="font-medium text-fg">{p.company_name}</p><p className="text-[12px] text-subtle">{INDUSTRY_LABEL[p.industry ?? ""] ?? p.industry} · {p.entity_type.replace(/_/g, " ")}</p><p className="text-[11px] text-subtle">Source: {p.source}</p></Td>
                    <Td><p>{p.contact_name ?? "—"} {p.contact_role && <span className="text-subtle">· {p.contact_role}</span>}</p><p className="text-[12px] text-subtle">{[p.business_email, p.business_phone].filter(Boolean).join(" · ")}</p>{p.linkedin_url && <a className="text-[12px] text-signal-300" href={p.linkedin_url} target="_blank" rel="noreferrer">LinkedIn</a>}</Td>
                    <Td className="space-y-1">
                      <div>{p.business_email ? (corporate ? <Badge tone="green">email OK</Badge> : <Badge tone="red">email needs consent</Badge>) : <Badge>no email</Badge>}</div>
                      <div>{p.business_phone ? (p.tps_registered ? <Badge tone="red">TPS registered</Badge> : tpsFresh(p.tps_checked_at) ? <Badge tone="green">TPS clear {date(p.tps_checked_at)}</Badge> : <Badge tone="amber">TPS check due</Badge>) : <Badge>no phone</Badge>}</div>
                    </Td>
                    <Td><StatusBadge status={p.status} /></Td>
                    <Td className="space-x-2 whitespace-nowrap">
                      {p.status === "new" && <Op id={p.id} op="approve" label="Approve" />}
                      {p.status === "approved" && <Op id={p.id} op="unapprove" label="Unapprove" tone="text-muted" />}
                      {p.business_phone && <><Op id={p.id} op="tps_clear" label="TPS clear" /><Op id={p.id} op="tps_registered" label="TPS listed" tone="text-warning" /></>}
                      {["contacted", "approved"].includes(p.status) && <Op id={p.id} op="replied" label="Replied" />}
                      {["replied", "contacted"].includes(p.status) && <><Op id={p.id} op="interested" label="Interested" /><Op id={p.id} op="not_interested" label="Not interested" tone="text-muted" /></>}
                      {p.status !== "do_not_contact" && <Op id={p.id} op="dnc" label="Do not contact" tone="text-danger" />}
                      <Op id={p.id} op="delete" label="Delete" tone="text-subtle" />
                    </Td>
                  </tr>
                );
              })}</tbody>
            </Table>
          )}
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Add prospect" description="Business contact details only, from a lawful public source you can name." />
            <ActionForm action={createProspect} submitLabel="Add prospect" resetOnSuccess>
              <Field label="Company name" name="company_name"><Input id="company_name" name="company_name" required /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Industry" name="industry"><Select id="industry" name="industry" defaultValue="roofing">{INDUSTRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>
                <Field label="Legal entity" name="entity_type"><Select id="entity_type" name="entity_type" defaultValue="unknown">
                  {["limited_company", "llp", "plc", "scottish_partnership", "public_body", "sole_trader", "partnership", "unknown"].map((e) => <option key={e} value={e}>{e.replace(/_/g, " ")}</option>)}</Select></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Website" name="website"><Input id="website" name="website" /></Field>
                <Field label="Company number" name="company_number"><Input id="company_number" name="company_number" /></Field>
                <Field label="Contact name" name="contact_name"><Input id="contact_name" name="contact_name" /></Field>
                <Field label="Role" name="contact_role"><Input id="contact_role" name="contact_role" /></Field>
              </div>
              <Field label="Business email" name="business_email" hint="(role or work address)"><Input id="business_email" name="business_email" type="email" /></Field>
              <Field label="Business phone" name="business_phone"><Input id="business_phone" name="business_phone" /></Field>
              <Field label="LinkedIn URL" name="linkedin_url"><Input id="linkedin_url" name="linkedin_url" /></Field>
              <Field label="Source of data" name="source"><Input id="source" name="source" placeholder="e.g. Contact page on company website, 18/11/2026" required /></Field>
              <Field label="Legitimate interests notes" name="lia_notes"><Textarea id="lia_notes" name="lia_notes" className="min-h-[60px]" placeholder="Why our offer is relevant to this business and role" /></Field>
            </ActionForm>
          </Card>
          <Card>
            <CardHeader title="Suppression list" description="Never contacted again by email sequences or campaigns." />
            <ActionForm action={addSuppression} submitLabel="Suppress" size="sm" variant="secondary" resetOnSuccess>
              <div className="grid grid-cols-2 gap-2"><Input name="value" placeholder="email, @domain or phone" required /><Input name="reason" placeholder="Reason" /></div>
            </ActionForm>
            <ul className="mt-3 max-h-56 space-y-1 overflow-auto text-[12.5px] text-muted">{(suppression ?? []).map((s) => <li key={s.id}>{s.value} <span className="text-subtle">· {s.reason}</span></li>)}</ul>
          </Card>
        </div>
      </div>
    </>
  );
}
