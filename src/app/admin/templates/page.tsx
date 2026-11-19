import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Card, CardHeader, Badge } from "@/components/ui/primitives";
import { ActionForm } from "@/components/forms/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { saveTemplate, deleteTemplate } from "../_actions/outreach";
import { INDUSTRY_LABEL } from "@/lib/content/industries";

export default async function TemplatesPage(props: PageProps<"/admin/templates">) {
  const sp = await props.searchParams;
  const channel = typeof sp.channel === "string" ? sp.channel : "";
  let q = createAdminClient().from("outreach_templates").select("*").order("industry").order("channel");
  if (channel) q = q.eq("channel", channel as "email");
  const { data } = await q;
  return (
    <>
      <PageHeader title="Outreach templates" description="Cold email, LinkedIn and telephone scripts per industry. Placeholders: {{first_name}} {{company_name}} {{sender_name}} {{agency_name}} {{agency_address}} {{booking_url}} {{area}}" />
      <div className="mb-4 flex gap-2 text-[13px]">{["", "email", "linkedin", "phone"].map((c) => <a key={c} href={c ? `?channel=${c}` : "?"} className={`rounded-md px-3 py-1.5 ${channel === c ? "bg-ink-700 text-fg" : "text-muted"}`}>{c || "All"}</a>)}</div>
      <div className="grid gap-4 xl:grid-cols-2">
        {(data ?? []).map((t) => (
          <Card key={t.id}>
            <details>
              <summary className="flex cursor-pointer items-center justify-between gap-2"><span className="font-medium text-fg">{t.name}</span><span className="flex gap-1.5"><Badge tone="violet">{t.channel}</Badge><Badge>{INDUSTRY_LABEL[t.industry] ?? t.industry}</Badge></span></summary>
              <ActionForm action={saveTemplate} submitLabel="Save" size="sm" className="mt-4">
                <input type="hidden" name="id" value={t.id} /><input type="hidden" name="channel" value={t.channel} />
                <div className="grid grid-cols-2 gap-3"><Field label="Name" name="name"><Input name="name" defaultValue={t.name} /></Field><Field label="Industry key" name="industry"><Input name="industry" defaultValue={t.industry} /></Field></div>
                {t.channel === "email" && <Field label="Subject" name="subject"><Input name="subject" defaultValue={t.subject ?? ""} /></Field>}
                <Field label="Body" name="body"><Textarea name="body" className="min-h-[260px] font-mono text-[12.5px]" defaultValue={t.body} /></Field>
              </ActionForm>
              <form action={deleteTemplate} className="mt-2"><input type="hidden" name="id" value={t.id} /><button className="text-[12px] text-danger">Delete template</button></form>
            </details>
            {!t.subject && t.channel !== "email" ? null : <p className="mt-2 text-[12.5px] text-muted">{t.subject}</p>}
          </Card>
        ))}
      </div>
      <Card className="mt-6 max-w-3xl">
        <CardHeader title="New template" />
        <ActionForm action={saveTemplate} submitLabel="Create template" resetOnSuccess>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Channel" name="channel"><Select name="channel" defaultValue="email"><option>email</option><option>linkedin</option><option>phone</option></Select></Field>
            <Field label="Industry key" name="industry"><Input name="industry" placeholder="roofing" /></Field>
            <Field label="Name" name="name"><Input name="name" /></Field>
          </div>
          <Field label="Subject (email)" name="subject"><Input name="subject" /></Field>
          <Field label="Body" name="body"><Textarea name="body" className="min-h-[180px] font-mono text-[12.5px]" /></Field>
        </ActionForm>
      </Card>
    </>
  );
}
