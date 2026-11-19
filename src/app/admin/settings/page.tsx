import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Card, CardHeader, Table, Th, Td, StatusBadge, EmptyState, Badge } from "@/components/ui/primitives";
import { ActionForm } from "@/components/forms/action-form";
import { Input, Select, Label } from "@/components/ui/form";
import { setUserRole, updateDataRequest, updatePlanPricing } from "../_actions/admin";
import { dateTime, gbp } from "@/lib/format";

export default async function SettingsPage() {
  await requireAdmin();
  const db = createAdminClient();
  const [{ data: team }, { data: requests }, { data: audit }, { data: plans }] = await Promise.all([
    db.from("profiles").select("id,email,full_name,role").in("role", ["admin", "staff"]),
    db.from("data_requests").select("*").order("created_at", { ascending: false }).limit(50),
    db.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100),
    db.from("plans").select("*").in("id", ["starter", "growth", "premium"]).order("sort_order"),
  ]);
  return (
    <>
      <PageHeader title="Settings" description="Team access, plan pricing, GDPR requests and the audit trail." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Team" description="Staff can manage sales and delivery. Only admins see finance, integrations, settings and can activate automations or approve campaigns." />
          <ul className="mb-4 space-y-1.5 text-[13px]">{(team ?? []).map((t) => <li key={t.id} className="flex justify-between"><span className="text-fg">{t.full_name ?? t.email} <span className="text-subtle">{t.email}</span></span><Badge tone={t.role === "admin" ? "violet" : "blue"}>{t.role}</Badge></li>)}</ul>
          <ActionForm action={setUserRole} submitLabel="Update role" size="sm" variant="secondary">
            <div className="grid grid-cols-[1fr_130px] gap-2"><Input name="email" type="email" placeholder="user@company.co.uk" required /><Select name="role" defaultValue="staff"><option value="staff">staff</option><option value="admin">admin</option><option value="customer">customer (revoke)</option></Select></div>
          </ActionForm>
        </Card>
        <Card>
          <CardHeader title="Plan pricing" description="Used by the website and new checkouts. Existing subscriptions keep their price." />
          <div className="space-y-3">{(plans ?? []).map((p) => (
            <ActionForm key={p.id} action={updatePlanPricing} submitLabel="Save" size="sm" variant="secondary" className="flex flex-wrap items-end gap-2 space-y-0">
              <input type="hidden" name="id" value={p.id} />
              <p className="w-20 pb-2 text-[13px] font-medium text-fg">{p.name}</p>
              <div><Label>Setup £</Label><Input name="setup" type="number" defaultValue={p.setup_fee_pence / 100} className="w-28" /></div>
              <div><Label>Monthly £</Label><Input name="monthly" type="number" defaultValue={p.monthly_pence / 100} className="w-28" /></div>
              <p className="pb-2 text-[11.5px] text-subtle">now {gbp(p.setup_fee_pence)} + {gbp(p.monthly_pence)}/mo</p>
            </ActionForm>
          ))}</div>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader title="Data subject requests (UK GDPR)" description="Respond within one calendar month." />
        {!requests?.length ? <EmptyState title="No requests" /> : (
          <Table><thead><tr><Th>Received</Th><Th>Email</Th><Th>Type</Th><Th>Due</Th><Th>Status</Th></tr></thead>
            <tbody>{requests.map((r) => (
              <tr key={r.id}><Td>{dateTime(r.created_at)}</Td><Td>{r.email}</Td><Td>{r.kind}</Td><Td>{dateTime(new Date(new Date(r.created_at).getTime() + 30 * 86400_000).toISOString())}</Td>
                <Td><form action={updateDataRequest} className="flex flex-wrap gap-2"><input type="hidden" name="id" value={r.id} />
                  <select name="status" defaultValue={r.status} className="rounded-md border border-line-strong bg-ink-900 px-2 py-1 text-[12.5px]">{["received", "in_progress", "completed", "rejected"].map((s) => <option key={s}>{s}</option>)}</select>
                  <input name="notes" defaultValue={r.notes ?? ""} placeholder="Notes" className="rounded-md border border-line-strong bg-ink-900 px-2 py-1 text-[12.5px]" /><button className="text-[12px] text-signal-300">Save</button></form>
                  <StatusBadge status={r.status} /></Td></tr>
            ))}</tbody>
          </Table>
        )}
        <p className="mt-3 text-[12px] text-subtle">To erase a customer: delete their auth user in Supabase (Authentication → Users). Profiles cascade; retain invoices for 6 years as required by HMRC.</p>
      </Card>
      <Card className="mt-6">
        <CardHeader title="Audit log" description="Last 100 security-relevant and financial actions." />
        {!audit?.length ? <EmptyState title="No entries" /> : (
          <Table><thead><tr><Th>When</Th><Th>Action</Th><Th>Entity</Th><Th>Actor</Th><Th>Details</Th></tr></thead>
            <tbody>{audit.map((a) => <tr key={a.id}><Td className="whitespace-nowrap">{dateTime(a.created_at)}</Td><Td className="font-mono text-[12px]">{a.action}</Td><Td className="text-[12px]">{a.entity_type} {a.entity_id?.slice(0, 8)}</Td><Td className="font-mono text-[11px] text-subtle">{a.actor_id?.slice(0, 8) ?? "system"}</Td><Td className="max-w-xs truncate text-[11.5px] text-subtle">{a.metadata ? JSON.stringify(a.metadata) : ""}</Td></tr>)}</tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
