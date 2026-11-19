import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Card, CardHeader, Table, Th, Td, StatusBadge, EmptyState, StatCard } from "@/components/ui/primitives";
import { BarsChart } from "@/components/dashboard/charts";
import { updateRequest } from "../_actions/customers";
import { SERVICE_BY_KEY } from "@/lib/content/services";
import { dateTime, date } from "@/lib/format";
import { countBy } from "@/lib/series";

export default async function AutomationsAdmin() {
  const db = createAdminClient();
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const [{ data: autos }, { data: events }, { data: tests }, { data: requests }] = await Promise.all([
    db.from("automations").select("id,name,status,service_key,provider,last_tested_at,activated_at,organization_id, organizations(name)").order("updated_at", { ascending: false }),
    db.from("automation_events").select("automation_id,event_type").gte("occurred_at", since).limit(20000),
    db.from("automation_tests").select("passed").gte("created_at", since),
    db.from("automation_requests").select("*, organizations(name)").order("created_at", { ascending: false }).limit(50),
  ]);
  const A = autos ?? [];
  const evBy = countBy(events ?? [], (e) => e.automation_id ?? "none");
  const failedEvents = (events ?? []).filter((e) => /fail|error/.test(e.event_type)).length;
  const byService = Array.from(countBy(A.filter((a) => a.status === "active"), (a) => SERVICE_BY_KEY[a.service_key]?.name ?? a.service_key)).map(([label, count]) => ({ label, count }));
  const T = tests ?? [];
  return (
    <>
      <PageHeader title="Automations" description="Every client automation, its lifecycle state and 30-day performance." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Live automations" value={A.filter((a) => a.status === "active").length} />
        <StatCard label="Awaiting approval" value={A.filter((a) => a.status === "awaiting_approval").length} />
        <StatCard label="Actions run (30d)" value={(events ?? []).length} hint={failedEvents ? `${failedEvents} failure events` : "No failure events"} tone={failedEvents ? "down" : "neutral"} />
        <StatCard label="Test pass rate (30d)" value={T.length ? `${Math.round((T.filter((t) => t.passed).length / T.length) * 100)}%` : "—"} hint={`${T.length} tests`} />
      </div>
      {byService.length > 0 && <Card className="mt-6"><CardHeader title="Live automations by service" /><BarsChart data={byService} series={[{ key: "count", label: "Live" }]} height={200} /></Card>}
      <Card className="mt-6">
        <CardHeader title="All automations" />
        {!A.length ? <EmptyState title="No automations yet" /> : (
          <Table><thead><tr><Th>Automation</Th><Th>Customer</Th><Th>Engine</Th><Th>Status</Th><Th>Actions (30d)</Th><Th>Last tested</Th><Th>Live since</Th></tr></thead>
            <tbody>{A.map((a) => (
              <tr key={a.id}><Td>{a.name}</Td><Td><Link className="text-signal-300" href={`/admin/customers/${a.organization_id}`}>{(a.organizations as unknown as { name: string })?.name}</Link></Td><Td>{a.provider}</Td><Td><StatusBadge status={a.status} /></Td><Td className="tabular-nums">{evBy.get(a.id) ?? 0}</Td><Td>{dateTime(a.last_tested_at)}</Td><Td>{date(a.activated_at)}</Td></tr>
            ))}</tbody>
          </Table>
        )}
      </Card>
      <Card className="mt-6">
        <CardHeader title="Additional automation requests" description="Submitted by customers from their portal." />
        {!requests?.length ? <EmptyState title="No requests" /> : (
          <Table><thead><tr><Th>Received</Th><Th>Customer</Th><Th>Request</Th><Th>Status / notes</Th></tr></thead>
            <tbody>{requests.map((r) => (
              <tr key={r.id}><Td className="whitespace-nowrap">{date(r.created_at)}</Td><Td><Link className="text-signal-300" href={`/admin/customers/${r.organization_id}`}>{(r.organizations as { name: string })?.name}</Link></Td>
                <Td className="max-w-md"><p className="font-medium">{SERVICE_BY_KEY[r.service_key]?.name ?? r.service_key}</p><p className="whitespace-pre-wrap text-[12.5px] text-muted">{r.description}</p></Td>
                <Td><form action={updateRequest} className="space-y-1.5"><input type="hidden" name="id" value={r.id} />
                  <select name="status" defaultValue={r.status} className="rounded-md border border-line-strong bg-ink-900 px-2 py-1 text-[12.5px]">{["submitted", "reviewing", "quoted", "approved", "declined", "built"].map((s) => <option key={s}>{s}</option>)}</select>
                  <input name="admin_notes" defaultValue={r.admin_notes ?? ""} placeholder="Note visible to customer" className="block w-full rounded-md border border-line-strong bg-ink-900 px-2 py-1 text-[12.5px]" />
                  <button className="text-[12px] text-signal-300">Save</button></form></Td></tr>
            ))}</tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
