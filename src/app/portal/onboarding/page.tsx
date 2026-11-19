import { getPortalContext } from "../context";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Card, CardHeader, StatusBadge, Progress, Notice, Badge } from "@/components/ui/primitives";
import { ActionForm } from "@/components/forms/action-form";
import { Field, Input, Textarea, Select, Checkbox } from "@/components/ui/form";
import { updateBusinessInfo, saveKnowledge, selectServices, addCredential, deleteCredential, submitOnboarding } from "../actions";
import { SERVICES } from "@/lib/content/services";
import { INDUSTRY_OPTIONS } from "@/lib/content/industries";
import { dateTime } from "@/lib/format";
import { CheckCircle2, Circle, Lock, Trash2 } from "lucide-react";

export default async function OnboardingPage() {
  const { supabase, org } = await getPortalContext();
  if (!org) return null;
  const [{ data: tasks }, { data: automations }, { data: creds }] = await Promise.all([
    supabase.from("onboarding_tasks").select("*").order("sort_order"),
    supabase.from("automations").select("service_key,status"),
    // Metadata only — ciphertext is never selected.
    createAdminClient().from("integration_credentials").select("id,provider,label,hint,created_at").eq("organization_id", org.id).order("created_at"),
  ]);
  const done = (tasks ?? []).filter((t) => t.status === "done").length;
  const selected = new Set((automations ?? []).map((a) => a.service_key));

  return (
    <>
      <PageHeader title="Onboarding" description="Give us what we need to build your automations. Nothing goes live until it's been tested and approved." />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="1. Business information" description="Used to configure your assistants and notifications." />
            <ActionForm action={updateBusinessInfo} submitLabel="Save business information">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Business name" name="name"><Input id="name" name="name" defaultValue={org.name} required /></Field>
                <Field label="Industry" name="industry">
                  <Select id="industry" name="industry" defaultValue={org.industry ?? ""}>
                    <option value="">Select…</option>
                    {INDUSTRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                </Field>
                <Field label="Website" name="website"><Input id="website" name="website" type="url" placeholder="https://" defaultValue={org.website ?? ""} /></Field>
                <Field label="Main phone" name="phone"><Input id="phone" name="phone" defaultValue={org.phone ?? ""} /></Field>
                <Field label="Company number" name="company_number" hint="(optional)"><Input id="company_number" name="company_number" defaultValue={org.company_number ?? ""} /></Field>
                <Field label="Team size" name="employee_count"><Input id="employee_count" name="employee_count" defaultValue={org.employee_count ?? ""} placeholder="e.g. 8" /></Field>
              </div>
              <Field label="Address" name="address"><Input id="address" name="address" defaultValue={org.address ?? ""} /></Field>
              <Field label="Opening hours" name="business_hours"><Textarea id="business_hours" name="business_hours" className="min-h-[70px]" defaultValue={org.business_hours ?? ""} placeholder="Mon–Fri 8:00–17:30, Sat 9:00–13:00" /></Field>
              <Field label="What does your business do?" name="description"><Textarea id="description" name="description" defaultValue={org.description ?? ""} /></Field>
            </ActionForm>
          </Card>

          <Card>
            <CardHeader title="2. Choose your automations" description="Select everything you'd like. We'll confirm what's included in your plan." />
            <ActionForm action={selectServices} submitLabel="Save selection">
              <div className="grid gap-2.5 sm:grid-cols-2">
                {SERVICES.map((s) => (
                  <div key={s.key} className="rounded-lg border border-line bg-ink-900 p-3">
                    <Checkbox name="services" value={s.key} defaultChecked={selected.has(s.key)} label={<><span className="font-medium text-fg">{s.name}</span><br /><span className="text-[12px]">{s.short}</span></>} />
                  </div>
                ))}
              </div>
              <Field label="Anything specific?" name="notes" hint="(optional)"><Textarea id="notes" name="notes" className="min-h-[70px]" placeholder="e.g. We want missed calls texted back and surveys booked into Google Calendar." /></Field>
            </ActionForm>
          </Card>

          <Card>
            <CardHeader title="3. Approved FAQs and knowledge" description="Your AI assistants will ONLY use this information. Anything not covered is passed to your team." />
            <ActionForm action={saveKnowledge} submitLabel="Save approved knowledge">
              <Textarea name="faq_knowledge" className="min-h-[220px] font-mono text-[13px]" defaultValue={org.faq_knowledge ?? ""}
                placeholder={"Q: What areas do you cover?\nA: Leeds and within 25 miles.\n\nQ: Do you offer free quotes?\nA: Yes, surveys are free and take around 30 minutes.\n\nNever discuss: exact prices without a survey; insurance claims advice."} />
            </ActionForm>
          </Card>

          <Card>
            <CardHeader title="4. Connect your tools" description="Where possible, invite our team as a user in your system instead of sharing a password. If you must share a key, store it here." />
            <Notice tone="blue" title="How we protect credentials">Credentials are encrypted with AES-256 on our server before storage. They can never be viewed in any browser — including ours — and are only used by your automations.</Notice>
            {creds && creds.length > 0 && (
              <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
                {creds.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-[13px]">
                    <div className="flex items-center gap-2"><Lock size={14} className="text-success" /><span className="text-fg">{c.label}</span><Badge>{c.provider}</Badge><span className="font-mono text-subtle">{c.hint}</span></div>
                    <form action={deleteCredential}><input type="hidden" name="id" value={c.id} /><button className="text-subtle hover:text-danger" aria-label="Delete credential"><Trash2 size={15} /></button></form>
                  </li>
                ))}
              </ul>
            )}
            <ActionForm action={addCredential} submitLabel="Store securely" className="mt-4" resetOnSuccess>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="System" name="provider">
                  <Select id="provider" name="provider" defaultValue="google_calendar">
                    {["google_calendar", "outlook", "hubspot", "pipedrive", "calendly", "twilio", "website_cms", "booking_system", "other"].map((p) => <option key={p} value={p}>{p.replace(/_/g, " ")}</option>)}
                  </Select>
                </Field>
                <Field label="Label" name="label"><Input id="label" name="label" placeholder="e.g. HubSpot private app token" required /></Field>
              </div>
              <Field label="API key, token or access details" name="secret"><Input id="secret" name="secret" type="password" autoComplete="off" required /></Field>
            </ActionForm>
          </Card>

          <Card>
            <CardHeader title="5. Submit for implementation" description="We'll review everything and schedule your kick-off call." />
            {org.onboarding_submitted_at ? (
              <Notice tone="green" title="Submitted">Submitted {dateTime(org.onboarding_submitted_at)}. You can still update any section above.</Notice>
            ) : (
              <ActionForm action={submitOnboarding} submitLabel="Submit onboarding" />
            )}
          </Card>
        </div>

        <aside className="xl:sticky xl:top-8 xl:self-start">
          <Card>
            <CardHeader title="Your checklist" description={`${done} of ${tasks?.length ?? 0} complete`} />
            <Progress value={tasks?.length ? (done / tasks.length) * 100 : 0} />
            <ul className="mt-4 space-y-3">
              {(tasks ?? []).map((t) => (
                <li key={t.id} className="flex gap-2.5 text-[13px]">
                  {t.status === "done" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" /> : <Circle size={16} className="mt-0.5 shrink-0 text-subtle" />}
                  <div>
                    <p className={t.status === "done" ? "text-muted line-through" : "text-fg"}>{t.title}</p>
                    <p className="text-[11.5px] text-subtle">{t.owner === "agency" ? "Kairo team" : "You"} · <StatusBadge status={t.status} /></p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </>
  );
}
