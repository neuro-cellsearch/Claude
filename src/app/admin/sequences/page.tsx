import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Card, CardHeader, StatusBadge, Badge, Notice, Table, Th, Td, EmptyState } from "@/components/ui/primitives";
import { ActionForm } from "@/components/forms/action-form";
import { Field, Input, Textarea, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { toggleSequence, saveSequenceStep, createSequence, processSequencesNow } from "../_actions/outreach";
import { emailConfigured } from "@/lib/integrations/email";
import { dateTime } from "@/lib/format";

export default async function SequencesPage() {
  const db = createAdminClient();
  const [{ data: seqs }, { data: enrol }, { data: log }] = await Promise.all([
    db.from("email_sequences").select("*, email_sequence_steps(*)").order("created_at"),
    db.from("sequence_enrollments").select("*, enquiries(name,email), email_sequences(name)").order("created_at", { ascending: false }).limit(50),
    db.from("email_messages").select("*").order("created_at", { ascending: false }).limit(30),
  ]);
  return (
    <>
      <PageHeader title="Email follow-up sequences" description="Automatic follow-ups for people who contacted you (quote requests, consultations). Every email carries an unsubscribe link, and sequences stop when the lead progresses or opts out."
        actions={<ActionForm action={processSequencesNow} submitLabel="Process due emails now" variant="secondary" />} />
      {!emailConfigured() && <div className="mb-6"><Notice tone="amber" title="Email not configured">Due emails stay queued (shown as not_configured in the log) until RESEND_API_KEY and EMAIL_FROM are set. Nothing is reported as sent.</Notice></div>}
      <div className="space-y-6">
        {(seqs ?? []).map((s) => {
          const steps = ((s.email_sequence_steps ?? []) as { id: string; step_order: number; delay_days: number; subject: string; body: string }[]).sort((a, b) => a.step_order - b.step_order);
          return (
            <Card key={s.id}>
              <CardHeader title={s.name} description={<>{s.description} {s.trigger_type && <Badge tone="blue">auto-enrols: {s.trigger_type}</Badge>}</>}
                action={<form action={toggleSequence}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="active" value={String(!s.active)} /><Button size="sm" variant={s.active ? "danger" : "primary"}>{s.active ? "Deactivate" : "Activate"}</Button></form>} />
              <div className="space-y-3">
                {steps.map((st) => (
                  <details key={st.id} className="rounded-lg border border-line p-3">
                    <summary className="cursor-pointer text-[13.5px] text-fg">Step {st.step_order} · day +{st.delay_days} · {st.subject}</summary>
                    <ActionForm action={saveSequenceStep} submitLabel="Save step" size="sm" className="mt-3">
                      <input type="hidden" name="id" value={st.id} /><input type="hidden" name="sequence_id" value={s.id} />
                      <div className="grid grid-cols-2 gap-3"><Field label="Step #" name="step_order"><Input name="step_order" type="number" defaultValue={st.step_order} /></Field><Field label="Delay (days after previous)" name="delay_days"><Input name="delay_days" type="number" defaultValue={st.delay_days} /></Field></div>
                      <Field label="Subject" name="subject"><Input name="subject" defaultValue={st.subject} /></Field>
                      <Field label="Body" name="body"><Textarea name="body" className="min-h-[200px] font-mono text-[12.5px]" defaultValue={st.body} /></Field>
                    </ActionForm>
                  </details>
                ))}
                <details className="rounded-lg border border-dashed border-line-strong p-3">
                  <summary className="cursor-pointer text-[13px] text-signal-300">+ Add step</summary>
                  <ActionForm action={saveSequenceStep} submitLabel="Add step" size="sm" className="mt-3" resetOnSuccess>
                    <input type="hidden" name="sequence_id" value={s.id} />
                    <div className="grid grid-cols-2 gap-3"><Field label="Step #" name="step_order"><Input name="step_order" type="number" defaultValue={steps.length + 1} /></Field><Field label="Delay (days)" name="delay_days"><Input name="delay_days" type="number" defaultValue={3} /></Field></div>
                    <Field label="Subject" name="subject"><Input name="subject" /></Field>
                    <Field label="Body" name="body"><Textarea name="body" className="min-h-[160px] font-mono text-[12.5px]" /></Field>
                  </ActionForm>
                </details>
              </div>
            </Card>
          );
        })}
        <Card>
          <CardHeader title="New sequence" />
          <ActionForm action={createSequence} submitLabel="Create" resetOnSuccess>
            <div className="grid gap-3 sm:grid-cols-3"><Field label="Name" name="name"><Input name="name" /></Field><Field label="Description" name="description"><Input name="description" /></Field>
              <Field label="Auto-enrol trigger" name="trigger_type"><Select name="trigger_type" defaultValue=""><option value="">Manual only</option>{["contact", "quote", "consultation", "chatbot"].map((t) => <option key={t}>{t}</option>)}</Select></Field></div>
          </ActionForm>
        </Card>
        <Card><CardHeader title="Recent enrolments" />
          {!enrol?.length ? <EmptyState title="None" /> : <Table><thead><tr><Th>Contact</Th><Th>Sequence</Th><Th>Step</Th><Th>Status</Th><Th>Next send</Th></tr></thead>
            <tbody>{enrol.map((e) => <tr key={e.id}><Td>{(e.enquiries as { name: string; email: string })?.name} <span className="text-subtle">{(e.enquiries as { email: string })?.email}</span></Td><Td>{(e.email_sequences as { name: string })?.name}</Td><Td>{e.current_step}</Td><Td><StatusBadge status={e.status} /></Td><Td>{dateTime(e.next_send_at)}</Td></tr>)}</tbody></Table>}
        </Card>
        <Card><CardHeader title="Email log" description="Every email the platform attempted, with its real outcome." />
          {!log?.length ? <EmptyState title="No emails yet" /> : <Table><thead><tr><Th>When</Th><Th>To</Th><Th>Subject</Th><Th>Context</Th><Th>Status</Th></tr></thead>
            <tbody>{log.map((m) => <tr key={m.id}><Td className="whitespace-nowrap">{dateTime(m.created_at)}</Td><Td>{m.to_email}</Td><Td>{m.subject}</Td><Td>{m.context}</Td><Td><StatusBadge status={m.status} />{m.error && <p className="text-[11px] text-subtle">{m.error}</p>}</Td></tr>)}</tbody></Table>}
        </Card>
      </div>
    </>
  );
}
