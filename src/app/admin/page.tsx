import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBusinessMetrics } from "@/lib/admin/metrics";
import { PageHeader, StatCard, Card, CardHeader, EmptyState, StatusBadge, Notice } from "@/components/ui/primitives";
import { TrendChart, BarsChart } from "@/components/dashboard/charts";
import { gbp, pct, dateTime } from "@/lib/format";
import { markNotificationsRead } from "./_actions/admin";
import { Button } from "@/components/ui/button";

export default async function AdminOverview() {
  const { profile } = await requireStaff();
  const db = createAdminClient();
  const m = await getBusinessMetrics(12);
  const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();
  const [{ data: pipeline }, { data: notes }, { data: upcoming }, { data: settings }] = await Promise.all([
    db.from("enquiries").select("stage, estimated_monthly_pence, created_at"),
    db.from("notifications").select("*").eq("audience", "staff").order("created_at", { ascending: false }).limit(8),
    db.from("consultations").select("id, scheduled_for, enquiries(name, company)").eq("status", "scheduled").gte("scheduled_for", new Date().toISOString()).order("scheduled_for").limit(5),
    db.from("app_settings").select("value").eq("key", "finance").maybeSingle(),
  ]);
  const target = (settings?.value as { net_profit_target_pence?: number })?.net_profit_target_pence ?? 1_000_000;
  const P = pipeline ?? [];
  const new30 = P.filter((e) => e.created_at >= since30).length;
  const openStages = ["new", "contacted", "qualified", "proposal_sent"];
  const pipelineValue = P.filter((e) => openStages.includes(e.stage)).reduce((t, e) => t + (e.estimated_monthly_pence ?? 0), 0);
  const stageCounts = ["new", "contacted", "qualified", "proposal_sent", "won", "lost"].map((s) => ({ label: s.replace("_", " "), count: P.filter((e) => e.stage === s).length }));
  const isAdmin = profile.role === "admin";
  const progress = Math.max(0, Math.min(1, m.runRate.profitAfterTax / target));

  return (
    <>
      <PageHeader title="Business overview" description="Live figures from subscriptions, payments and the expenses you've recorded." />
      {isAdmin && (
        <Card className="mb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[12px] font-medium uppercase tracking-wider text-subtle">Monthly net profit target (run-rate, after estimated corporation tax)</p>
              <p className="mt-1 text-2xl font-semibold text-fg">{gbp(m.runRate.profitAfterTax)} <span className="text-base font-normal text-muted">of {gbp(target)}</span></p>
              <div className="mt-3 h-2 w-full max-w-xl overflow-hidden rounded-full bg-ink-700"><div className="h-full rounded-full bg-gradient-to-r from-signal-500 to-aura-500" style={{ width: `${progress * 100}%` }} /></div>
            </div>
            <Link href="/admin/finance" className="text-sm text-signal-300 hover:underline">Open finance & forecast →</Link>
          </div>
          {m.runRate.costDelivery + m.runRate.costOperating === 0 && <p className="mt-3 text-[12.5px] text-warning">No expenses recorded yet — profit figures overstate reality until you add costs in Finance.</p>}
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="MRR" value={gbp(m.mrr)} hint={`ARR ${gbp(m.arr)}`} />
        <StatCard label="Active customers" value={m.activeCustomers} hint={`ARPA ${gbp(m.arpa)}`} />
        <StatCard label="Revenue this month" value={gbp(m.current.revenue)} hint={`${gbp(m.current.setup)} setup · ${gbp(m.current.recurring)} recurring`} />
        <StatCard label="Churn (3-mo avg)" value={pct(m.avgChurn)} hint={m.ltv ? `LTV ${gbp(m.ltv)}` : "LTV needs churn history"} />
        <StatCard label="New enquiries (30d)" value={new30} />
        <StatCard label="Open pipeline value" value={`${gbp(pipelineValue)}/mo`} hint="From stated budgets" />
        <StatCard label="Gross margin (run-rate)" value={pct(m.runRate.grossMargin)} />
        <StatCard label="Operating profit (run-rate)" value={gbp(m.runRate.operatingProfit)} tone={m.runRate.operatingProfit >= 0 ? "up" : "down"} hint="Before tax" />
      </div>

      {!m.hasRevenueData && <div className="mt-6"><Notice title="No revenue yet">Charts populate automatically from Stripe webhooks once customers subscribe.</Notice></div>}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card><CardHeader title="Revenue by month" description="Paid invoices, split by type" /><BarsChart data={m.series} series={[{ key: "recurring", label: "Recurring" }, { key: "setup", label: "Setup" }]} format="gbp" stacked /></Card>
        <Card><CardHeader title="Monthly recurring revenue" description="MRR at month end" /><TrendChart data={m.series} series={[{ key: "mrr", label: "MRR" }]} format="gbp" /></Card>
        <Card><CardHeader title="Customer acquisition & churn" /><BarsChart data={m.series} series={[{ key: "newCustomers", label: "New" }, { key: "churned", label: "Churned" }]} /></Card>
        {isAdmin && <Card><CardHeader title="Profit by month" description="Gross and operating profit (before tax)" /><TrendChart data={m.series} series={[{ key: "grossProfit", label: "Gross profit" }, { key: "operatingProfit", label: "Operating profit" }]} format="gbp" /></Card>}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Sales pipeline" action={<Link className="text-[12.5px] text-signal-300" href="/admin/enquiries">Open</Link>} />
          <BarsChart data={stageCounts} series={[{ key: "count", label: "Enquiries" }]} height={200} />
        </Card>
        <Card>
          <CardHeader title="Upcoming consultations" action={<Link className="text-[12.5px] text-signal-300" href="/admin/consultations">All</Link>} />
          {upcoming?.length ? (
            <ul className="space-y-2.5 text-[13px]">{upcoming.map((c) => {
              const e = c.enquiries as unknown as { name: string; company: string | null } | null;
              return <li key={c.id} className="flex justify-between gap-2"><span className="text-fg">{e?.company || e?.name}</span><span className="text-subtle">{dateTime(c.scheduled_for)}</span></li>;
            })}</ul>
          ) : <EmptyState title="None booked" />}
        </Card>
        <Card>
          <CardHeader title="Notifications" action={<form action={markNotificationsRead}><Button size="sm" variant="ghost">Mark all read</Button></form>} />
          {notes?.length ? (
            <ul className="space-y-2.5">{notes.map((n) => (
              <li key={n.id} className="text-[13px]">
                <Link href={n.link ?? "#"} className={n.read_at ? "text-muted" : "font-medium text-fg"}>{n.title}</Link>
                <p className="text-[11.5px] text-subtle">{dateTime(n.created_at)} {!n.read_at && <StatusBadge status="new" />}</p>
              </li>
            ))}</ul>
          ) : <EmptyState title="All quiet" />}
        </Card>
      </div>
    </>
  );
}
