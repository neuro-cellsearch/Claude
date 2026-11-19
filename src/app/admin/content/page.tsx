import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Card, CardHeader, Badge, Notice, EmptyState } from "@/components/ui/primitives";
import { ActionForm } from "@/components/forms/action-form";
import { Field, Input, Textarea, Checkbox, Select } from "@/components/ui/form";
import { saveCaseStudy, saveTestimonial, toggleContent } from "../_actions/admin";
import { INDUSTRY_OPTIONS } from "@/lib/content/industries";

function Toggle({ table, id, published, permission }: { table: string; id: string; published: boolean; permission: boolean }) {
  return (
    <div className="flex gap-3">
      {permission && <form action={toggleContent}><input type="hidden" name="table" value={table} /><input type="hidden" name="id" value={id} /><input type="hidden" name="op" value={published ? "unpublish" : "publish"} /><button className="text-[12px] text-signal-300">{published ? "Unpublish" : "Publish"}</button></form>}
      <form action={toggleContent}><input type="hidden" name="table" value={table} /><input type="hidden" name="id" value={id} /><input type="hidden" name="op" value="delete" /><button className="text-[12px] text-danger">Delete</button></form>
    </div>
  );
}

export default async function ContentPage() {
  const db = createAdminClient();
  const [{ data: studies }, { data: testimonials }] = await Promise.all([
    db.from("case_studies").select("*").order("created_at", { ascending: false }),
    db.from("testimonials").select("*").order("created_at", { ascending: false }),
  ]);
  return (
    <>
      <PageHeader title="Case studies & testimonials" description="Social proof is only shown on the website when it's genuine and the client has given permission." />
      <Notice tone="amber" title="Honesty rules">The database refuses to publish anything without recorded client permission. Use real figures you can evidence. Under the CMA's guidance and the DMCC Act 2024, fake or misleading reviews are unlawful.</Notice>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Case studies" />
          {!studies?.length ? <EmptyState title="None yet" description="Your first case study will replace the illustrative scenarios on /case-studies." /> : (
            <ul className="mb-6 space-y-3">{studies.map((s) => (
              <li key={s.id} className="rounded-lg border border-line p-3"><div className="flex items-start justify-between gap-2"><div><p className="font-medium text-fg">{s.headline}</p><p className="text-[12px] text-subtle">{s.client_name} · {s.industry}</p></div><div className="flex gap-1">{s.published ? <Badge tone="green">published</Badge> : <Badge>draft</Badge>}{!s.client_permission && <Badge tone="amber">no permission</Badge>}</div></div><div className="mt-2"><Toggle table="case_studies" id={s.id} published={s.published} permission={s.client_permission} /></div></li>
            ))}</ul>
          )}
          <details className="rounded-lg border border-dashed border-line-strong p-4"><summary className="cursor-pointer text-[13.5px] text-signal-300">+ New case study</summary>
            <ActionForm action={saveCaseStudy} submitLabel="Save case study" className="mt-4" resetOnSuccess>
              <div className="grid grid-cols-2 gap-3"><Field label="Client name" name="client_name"><Input name="client_name" /></Field><Field label="Industry" name="industry"><Select name="industry">{INDUSTRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field></div>
              <Field label="Headline" name="headline"><Input name="headline" /></Field>
              <Field label="Challenge" name="challenge"><Textarea name="challenge" /></Field>
              <Field label="Solution" name="solution"><Textarea name="solution" /></Field>
              <Field label="Results (verifiable figures)" name="results"><Textarea name="results" /></Field>
              <Checkbox name="client_permission" label="The client has given written permission to publish this case study" />
              <Checkbox name="published" label="Publish on the website now" />
            </ActionForm>
          </details>
        </Card>
        <Card>
          <CardHeader title="Testimonials" />
          {!testimonials?.length ? <EmptyState title="None yet" description="The homepage testimonial section stays hidden until you publish one." /> : (
            <ul className="mb-6 space-y-3">{testimonials.map((t) => (
              <li key={t.id} className="rounded-lg border border-line p-3"><p className="text-[13.5px] text-fg/90">“{t.quote}”</p><p className="mt-1 text-[12px] text-subtle">{t.author_name}{t.company && ` · ${t.company}`}</p><div className="mt-2 flex items-center justify-between">{t.published ? <Badge tone="green">published</Badge> : <Badge>draft</Badge>}<Toggle table="testimonials" id={t.id} published={t.published} permission={t.client_permission} /></div></li>
            ))}</ul>
          )}
          <details className="rounded-lg border border-dashed border-line-strong p-4"><summary className="cursor-pointer text-[13.5px] text-signal-300">+ New testimonial</summary>
            <ActionForm action={saveTestimonial} submitLabel="Save testimonial" className="mt-4" resetOnSuccess>
              <div className="grid grid-cols-3 gap-3"><Field label="Name" name="author_name"><Input name="author_name" /></Field><Field label="Role" name="author_role"><Input name="author_role" /></Field><Field label="Company" name="company"><Input name="company" /></Field></div>
              <Field label="Quote (exactly as given)" name="quote"><Textarea name="quote" /></Field>
              <Checkbox name="client_permission" label="The client approved this exact wording for publication" />
              <Checkbox name="published" label="Publish now" />
            </ActionForm>
          </details>
        </Card>
      </div>
    </>
  );
}
