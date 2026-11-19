import { getPortalContext } from "../context";
import { PageHeader, Card, CardHeader, StatCard, EmptyState } from "@/components/ui/primitives";
import { TrendChart, BarsChart, DonutChart } from "@/components/dashboard/charts";
import { lastNDays, dayKey, countBy } from "@/lib/series";
import { gbp } from "@/lib/format";

export default async function AnalyticsPage() {
  const { supabase } = await getPortalContext();
  const since = new Date(Date.now() - 90 * 86400_000).toISOString();
  const [{ data: leads }, { data: appts }, { data: events }] = await Promise.all([
    supabase.from("customer_leads").select("created_at,status,source,estimated_value_pence").gte("created_at", since),
    supabase.from("appointments").select("starts_at,status").gte("starts_at", since),
    supabase.from("automation_events").select("occurred_at,event_type").gte("occurred_at", since),
  ]);
  const L = leads ?? [], A = appts ?? [], E = events ?? [];
  if (!L.length && !A.length && !E.length) {
    return (<><PageHeader title="Analytics" description="Last 90 days" /><EmptyState title="No data yet" description="Analytics populate as your live automations capture leads, book appointments and report activity." /></>);
  }
  const days = lastNDays(90);
  const lByDay = countBy(L, (r) => dayKey(r.created_at));
  const eByDay = countBy(E, (r) => dayKey(r.occurred_at));
  const trend = days.map((d) => ({ label: d.label, leads: lByDay.get(d.key) ?? 0, actions: eByDay.get(d.key) ?? 0 }));
  const bySource = Array.from(countBy(L, (r) => r.source ?? "unknown")).map(([name, value]) => ({ name, value }));
  const statuses = ["new", "contacted", "qualified", "won", "lost"];
  const lStatus = countBy(L, (r) => r.status);
  const funnel = statuses.map((s) => ({ label: s, leads: lStatus.get(s) ?? 0 }));
  const aStatus = Array.from(countBy(A, (r) => r.status)).map(([name, value]) => ({ name, value }));
  const won = L.filter((l) => l.status === "won");
  const wonValue = won.reduce((s, l) => s + (l.estimated_value_pence ?? 0), 0);
  const noShows = A.filter((a) => a.status === "no_show").length;

  return (
    <>
      <PageHeader title="Analytics" description="Performance over the last 90 days." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Leads captured" value={L.length} />
        <StatCard label="Conversion to won" value={L.length ? `${Math.round((won.length / L.length) * 100)}%` : "—"} />
        <StatCard label="Recorded value won" value={gbp(wonValue)} hint="From lead values you record" />
        <StatCard label="No-show rate" value={A.length ? `${Math.round((noShows / A.length) * 100)}%` : "—"} />
      </div>
      <Card className="mt-6"><CardHeader title="Leads and automation actions" description="Daily" /><TrendChart data={trend} series={[{ key: "leads", label: "Leads" }, { key: "actions", label: "Automation actions" }]} height={260} /></Card>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card><CardHeader title="Lead sources" />{bySource.length ? <DonutChart data={bySource} /> : <EmptyState title="No leads" />}</Card>
        <Card><CardHeader title="Lead pipeline" /><BarsChart data={funnel} series={[{ key: "leads", label: "Leads" }]} /></Card>
        <Card><CardHeader title="Appointment outcomes" />{aStatus.length ? <DonutChart data={aStatus} /> : <EmptyState title="No appointments" />}</Card>
      </div>
    </>
  );
}
