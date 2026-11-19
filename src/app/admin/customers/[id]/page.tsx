import { notFound } from "next/navigation";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Card, CardHeader, StatusBadge, Badge, Notice, Table, Th, Td, EmptyState, Progress } from "@/components/ui/primitives";
import { ActionForm } from "@/components/forms/action-form";
import { Input, Select, Textarea, Checkbox, Label } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import {
  updateOrgStatus, createAutomation, updateAutomationConfig, moveAutomation, approveAutomation, runLiveTest, recordManualTest, setTaskStatus, seedTasks, pushCredentialToN8n,
} from "../../_actions/customers";
import { SERVICE_OPTIONS } from "@/lib/content/services";
import { INDUSTRY_LABEL } from "@/lib/content/industries";
import { n8nConfigured } from "@/lib/integrations/n8n";
import { gbp, dateTime, date } from "@/lib/format";
import { site } from "@/lib/env";

const NEXT: Record<string, { to: string; label: string; variant?: "primary" | "secondary" | "danger" }[]> = {
  requested: [{ to: "in_build", label: "Start build" }],
  in_build: [{ to: "testing", label: "Move to testing" }],
  testing: [{ to: "awaiting_approval", label: "Request approval" }, { to: "in_build", label: "Back to build", variant: "secondary" }],
  awaiting_approval: [{ to: "testing", label: "Back to testing", variant: "secondary" }],
  active: [{ to: "paused", label: "Pause", variant: "danger" }],
  paused: [{ to: "active", label: "Resume" }, { to: "in_build", label: "Rework", variant: "secondary" }],
  failed: [{ to: "in_build", label: "Back to build" }, { to: "testing", label: "Retest", variant: "secondary" }],
};

export default async function CustomerDetail(props: PageProps<"/admin/customers/[id]">) {
  const { id } = await props.params;
  const { profile } = await requireStaff();
  const db = createAdminClient();
  const { data: org } = await db.from("organizations").select("*").eq("id", id).maybeSingle();
  if (!org) notFound();
  const [{ data: members }, { data: subs }, { data: automations }, { data: tasks }, { data: creds }, { data: tests }, { data: payments }, { data: tickets }, { count: leads30 }] = await Promise.all([
    db.from("profiles").select("id,email,full_name,role").eq("organization_id", id),
    db.from("subscriptions").select("*").eq("organization_id", id).order("created_at", { ascending: false }),
    db.from("automations").select("*").eq("organization_id", id).order("created_at"),
    db.from("onboarding_tasks").select("*").eq("organization_id", id).order("sort_order"),
    db.from("integration_credentials").select("id,provider,label,hint,created_at").eq("organization_id", id),
    db.from("automation_tests").select("*, automations!inner(organization_id)").eq("automations.organization_id", id).order("created_at", { ascending: false }).limit(30),
    db.from("payments").select("*").eq("organization_id", id).order("created_at", { ascending: false }).limit(20),
    db.from("support_tickets").select("id,subject,status,priority,updated_at").eq("organization_id", id).order("updated_at", { ascending: false }).limit(10),
    db.from("customer_leads").select("id", { count: "exact", head: true }).eq("organization_id", id).gte("created_at", new Date(Date.now() - 30 * 86400_000).toISOString()),
  ]);
  const isAdmin = profile.role === "admin";
  const done = (tasks ?? []).filter((t) => t.status === "done").length;
  const live = subs?.find((s) => ["active", "trialing", "past_due"].includes(s.status));

  return (
    <>
      <PageHeader title={org.name} description={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={org.status} /><span className="text-[13px] text-muted">{INDUSTRY_LABEL[org.industry ?? ""] ?? "No industry"} · customer since {date(org.created_at)} · {leads30 ?? 0} leads in 30 days</span></span>}
        actions={<form action={updateOrgStatus} className="flex gap-2"><input type="hidden" name="id" value={id} /><Select name="status" defaultValue={org.status} className="w-36">{["prospect", "onboarding", "active", "paused", "churned"].map((s) => <option key={s}>{s}</option>)}</Select><Button variant="secondary">Set status</Button></form>} />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Automations" description="Lifecycle: requested → build → testing → approval → live. Activation requires a recorded passing test and admin approval (enforced by the database)." />
            {!automations?.length && <EmptyState title="No automations" description="The customer selects automations during onboarding, or add one below." />}
            <div className="space-y-4">
              {(automations ?? []).map((a) => {
                const cfg = (a.config ?? {}) as { test_webhook_url?: string; notes?: string };
                return (
                  <div key={a.id} className="rounded-xl border border-line bg-ink-900 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div><p className="font-medium text-fg">{a.name}</p><p className="font-mono text-[11.5px] text-subtle">{a.id}</p></div>
                      <div className="flex flex-wrap gap-1.5"><StatusBadge status={a.status} />{a.test_passed ? <Badge tone="green">test passed</Badge> : <Badge tone="amber">not tested</Badge>}{a.approved_at ? <Badge tone="green">approved</Badge> : <Badge>not approved</Badge>}</div>
                    </div>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <details className="rounded-lg border border-line p-3">
                        <summary className="cursor-pointer text-[13px] font-medium text-fg">Configuration</summary>
                        <ActionForm action={updateAutomationConfig} submitLabel="Save config" size="sm" variant="secondary" className="mt-3">
                          <input type="hidden" name="id" value={a.id} />
                          <div className="grid grid-cols-2 gap-2">
                            <div><Label>Engine</Label><Select name="provider" defaultValue={a.provider}>{["n8n", "make", "vapi", "retell", "custom"].map((p) => <option key={p}>{p}</option>)}</Select></div>
                            <div><Label>Workflow ID</Label><Input name="external_workflow_id" defaultValue={a.external_workflow_id ?? ""} /></div>
                          </div>
                          <div><Label hint="(HTTPS)">Test webhook URL</Label><Input name="test_webhook_url" defaultValue={cfg.test_webhook_url ?? ""} placeholder="https://n8n.example.com/webhook-test/…" /></div>
                          <div><Label>Build notes</Label><Textarea name="notes" className="min-h-[60px]" defaultValue={cfg.notes ?? ""} /></div>
                          <p className="text-[11.5px] text-subtle">Event callback: {site.url}/api/automations/events · automation_id above</p>
                        </ActionForm>
                      </details>
                      <div className="space-y-3">
                        {(NEXT[a.status] ?? []).map((n) => (
                          <ActionForm key={n.to} action={moveAutomation} submitLabel={n.label} size="sm" variant={n.variant ?? "primary"} className="space-y-2">
                            <input type="hidden" name="id" value={a.id} /><input type="hidden" name="to" value={n.to} />
                            {(n.to === "active" || n.to === "paused") && !(a.provider === "n8n" && a.external_workflow_id && n8nConfigured()) && (
                              <Checkbox name="confirm_manual" label={`I have ${n.to === "active" ? "switched on" : "switched off"} this workflow in ${a.provider}`} />
                            )}
                          </ActionForm>
                        ))}
                        {a.status === "awaiting_approval" && isAdmin && !a.approved_at && (
                          <ActionForm action={approveAutomation} submitLabel="Approve implementation" size="sm"><input type="hidden" name="id" value={a.id} /><p className="text-[12px] text-muted">Confirms you've reviewed the build and test evidence.</p></ActionForm>
                        )}
                        {a.status === "awaiting_approval" && a.approved_at && isAdmin && (
                          <ActionForm action={moveAutomation} submitLabel="Activate" size="sm" className="space-y-2">
                            <input type="hidden" name="id" value={a.id} /><input type="hidden" name="to" value="active" />
                            {!(a.provider === "n8n" && a.external_workflow_id && n8nConfigured()) && <Checkbox name="confirm_manual" label={`I have switched this workflow on in ${a.provider}`} />}
                          </ActionForm>
                        )}
                        {a.status === "awaiting_approval" && !isAdmin && <p className="text-[12px] text-muted">Waiting for an administrator to approve.</p>}
                        {["testing", "in_build", "failed"].includes(a.status) && (
                          <details className="rounded-lg border border-line p-3" open={a.status === "testing"}>
                            <summary className="cursor-pointer text-[13px] font-medium text-fg">Run / record a test</summary>
                            <div className="mt-3 space-y-3">
                              <ActionForm action={runLiveTest} submitLabel="Send live test webhook" size="sm" variant="secondary" pendingText="Testing…"><input type="hidden" name="id" value={a.id} />{!cfg.test_webhook_url && <p className="text-[12px] text-warning">No test webhook URL configured.</p>}</ActionForm>
                              <ActionForm action={recordManualTest} submitLabel="Record manual test" size="sm" variant="secondary">
                                <input type="hidden" name="id" value={a.id} />
                                <Textarea name="notes" className="min-h-[70px]" placeholder="Scenario, steps, expected vs actual result, evidence link…" />
                                <Checkbox name="passed" label="Test passed" />
                              </ActionForm>
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                    <p className="mt-3 text-[11.5px] text-subtle">{a.last_tested_at && `Last tested ${dateTime(a.last_tested_at)} · `}{a.approved_at && `Approved ${dateTime(a.approved_at)} · `}{a.activated_at && `Live since ${dateTime(a.activated_at)}`}</p>
                  </div>
                );
              })}
            </div>
            <form action={createAutomation} className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
              <input type="hidden" name="organization_id" value={id} />
              <Select name="service_key" className="w-56">{SERVICE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
              <Input name="name" placeholder="Automation name" className="w-64" required />
              <Button variant="secondary">Add automation</Button>
            </form>
          </Card>

          <Card>
            <CardHeader title="Test log" />
            {!tests?.length ? <EmptyState title="No tests recorded" /> : (
              <Table><thead><tr><Th>When</Th><Th>Method</Th><Th>Result</Th><Th>Notes</Th></tr></thead>
                <tbody>{tests.map((t) => <tr key={t.id}><Td className="whitespace-nowrap">{dateTime(t.created_at)}</Td><Td>{t.method}</Td><Td>{t.passed ? <Badge tone="green">passed</Badge> : <Badge tone="red">failed</Badge>}</Td><Td className="max-w-md"><p className="whitespace-pre-wrap text-[12.5px] text-muted">{t.notes}</p>{t.result && <pre className="mt-1 max-h-24 overflow-auto rounded bg-ink-950 p-2 text-[11px] text-subtle">{JSON.stringify(t.result, null, 1)}</pre>}</Td></tr>)}</tbody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader title="Business information & approved knowledge" />
            <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
              {[["Website", org.website], ["Phone", org.phone], ["Address", org.address], ["Company no.", org.company_number], ["Hours", org.business_hours], ["Team size", org.employee_count]].map(([k, v]) => <div key={k}><dt className="text-subtle">{k}</dt><dd className="whitespace-pre-wrap text-fg/90">{v || "—"}</dd></div>)}
            </dl>
            {org.description && <p className="mt-4 whitespace-pre-wrap text-[13px] text-muted">{org.description}</p>}
            <p className="mt-4 text-[12px] font-medium uppercase tracking-wider text-subtle">Approved FAQs</p>
            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-ink-950 p-3 text-[12.5px] text-fg/80">{org.faq_knowledge || "Not provided yet."}</pre>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Subscription" />
            {live ? (<><p className="text-lg font-semibold capitalize text-fg">{live.plan_id} · {gbp(live.monthly_pence)}/mo</p><p className="text-[13px] text-muted"><StatusBadge status={live.status} /> renews {date(live.current_period_end)}</p></>) : <p className="text-[13px] text-muted">No active subscription.</p>}
            {payments?.length ? <ul className="mt-3 space-y-1 text-[12.5px] text-muted">{payments.slice(0, 6).map((p) => <li key={p.id} className="flex justify-between"><span>{date(p.paid_at ?? p.created_at)} · {p.type}</span><span>{gbp(p.amount_pence, { decimals: true })} <StatusBadge status={p.status} /></span></li>)}</ul> : null}
          </Card>
          <Card>
            <CardHeader title="Onboarding checklist" description={`${done}/${tasks?.length ?? 0} complete${org.onboarding_submitted_at ? ` · submitted ${date(org.onboarding_submitted_at)}` : ""}`} />
            <Progress value={tasks?.length ? (done / tasks.length) * 100 : 0} />
            <ul className="mt-3 space-y-2">
              {(tasks ?? []).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className={t.status === "done" ? "text-muted line-through" : "text-fg"}>{t.title} <span className="text-[11px] text-subtle">({t.owner})</span></span>
                  <form action={setTaskStatus} className="flex items-center gap-1"><input type="hidden" name="id" value={t.id} />
                    <select name="status" defaultValue={t.status} className="rounded border border-line-strong bg-ink-900 px-1.5 py-0.5 text-[11.5px]">{["todo", "in_progress", "done", "blocked"].map((s) => <option key={s}>{s}</option>)}</select>
                    <button className="text-[11.5px] text-signal-300">✓</button></form>
                </li>
              ))}
            </ul>
            {!tasks?.length && <form action={seedTasks}><input type="hidden" name="organization_id" value={id} /><Button size="sm" variant="secondary">Create checklist</Button></form>}
          </Card>
          <Card>
            <CardHeader title="Stored credentials" description="Encrypted. Never displayed. Admins can push a credential directly into n8n." />
            {!creds?.length ? <p className="text-[13px] text-muted">None provided.</p> : (
              <ul className="space-y-3">{creds.map((c) => (
                <li key={c.id} className="rounded-lg border border-line p-2.5 text-[13px]">
                  <p className="text-fg">{c.label} <Badge>{c.provider}</Badge> <span className="font-mono text-subtle">{c.hint}</span></p>
                  {isAdmin && n8nConfigured() && (
                    <ActionForm action={pushCredentialToN8n} submitLabel="Push to n8n" size="sm" variant="ghost" className="mt-2 space-y-2">
                      <input type="hidden" name="id" value={c.id} />
                      <div className="grid grid-cols-2 gap-2"><Input name="header_name" defaultValue="Authorization" className="h-8 text-[12px]" /><Input name="prefix" defaultValue="Bearer " className="h-8 text-[12px]" /></div>
                    </ActionForm>
                  )}
                </li>
              ))}</ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Users" />
            <ul className="space-y-1 text-[13px]">{(members ?? []).map((m) => <li key={m.id} className="text-fg/90">{m.full_name ?? m.email} <span className="text-subtle">{m.email}</span></li>)}</ul>
          </Card>
          <Card>
            <CardHeader title="Support" />
            {!tickets?.length ? <p className="text-[13px] text-muted">No tickets.</p> : <ul className="space-y-1.5 text-[13px]">{tickets.map((t) => <li key={t.id} className="flex justify-between gap-2"><Link className="text-fg hover:text-signal-300" href={`/admin/support/${t.id}`}>{t.subject}</Link><StatusBadge status={t.status} /></li>)}</ul>}
          </Card>
          {org.status === "churned" && <Notice tone="red">Churned {date(org.churned_at)}.</Notice>}
        </aside>
      </div>
    </>
  );
}
