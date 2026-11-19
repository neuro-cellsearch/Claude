import Link from "next/link";
import { getPortalContext } from "./context";
import { PageHeader, StatCard, Card, CardHeader, EmptyState, StatusBadge, Progress, Notice } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { TrendChart } from "@/components/dashboard/charts";
import { lastNDays, dayKey, countBy } from "@/lib/series";
import { dateTime, firstName } from "@/lib/format";

export default async function PortalOverview() {
  const { supabase, profile, org } = await getPortalContext();
  if (!org) return <Notice tone="amber" title="No organisation linked">Your account isn't linked to a business yet. Please contact support.</Notice>;
  const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();
  const now = new Date().toISOString();

  const [leads, appts, events, automations, tasks, sub] = await Promise.all([
    supabase.from("customer_leads").select("created_at,status").gte("created_at", since30),
    supabase.from("appointments").select("id,title,starts_at,status,attendee_name").gte("starts_at", now).order("starts_at").limit(5),
    supabase.from("automation_events").select("id,summary,event_type,occurred_at").order("occurred_at", { ascending: false }).limit(8),
    supabase.from("automations").select("id,status"),
    supabase.from("onboarding_tasks").select("status"),
    supabase.from("subscriptions").select("status,plan_id").in("status", ["active", "trialing", "past_due"]).maybeSingle(),
  ]);

  const leadRows = leads.data ?? [];
  const days = lastNDays(30);
  const byDay = countBy(leadRows, (r) => dayKey(r.created_at));
  const chart = days.map((d) => ({ label: d.label, leads: byDay.get(d.key) ?? 0 }));
  const won = leadRows.filter((l) => l.status === "won").length;
  const active = (automations.data ?? []).filter((a) => a.status === "active").length;
  const taskRows = tasks.data ?? [];
  const progress = taskRows.length ? Math.round((taskRows.filter((t) => t.status === "done").length / taskRows.length) * 100) : 0;

  return (
    <>
      <PageHeader title={`Welcome back, ${firstName(profile.full_name)}`} description={`Here's how ${org.name}'s automations have performed over the last 30 days.`} />

      {sub.data?.status === "past_due" && <div className="mb-6"><Notice tone="red" title="Payment issue">Your last payment failed. Please <Link className="underline" href="/portal/billing">update your payment method</Link> to avoid interruption.</Notice></div>}
      {progress < 100 && (
        <Card className="mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <p className="font-medium text-fg">Onboarding {progress}% complete</p>
              <p className="mt-1 text-[13px] text-muted">{org.onboarding_submitted_at ? "Thanks — our team is configuring and testing your automations." : "Complete the remaining steps so we can start building."}</p>
              <div className="mt-3 max-w-md"><Progress value={progress} /></div>
            </div>
            <ButtonLink href="/portal/onboarding" variant="secondary">View checklist</ButtonLink>
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Leads (30 days)" value={leadRows.length} />
        <StatCard label="Won (30 days)" value={won} hint={leadRows.length ? `${Math.round((won / leadRows.length) * 100)}% conversion` : undefined} />
        <StatCard label="Upcoming appointments" value={appts.data?.length ?? 0} />
        <StatCard label="Active automations" value={active} hint={sub.data ? `Plan: ${sub.data.plan_id}` : "No active plan"} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Leads captured" description="Last 30 days" />
          {leadRows.length ? <TrendChart data={chart} series={[{ key: "leads", label: "Leads" }]} /> : <EmptyState title="No leads yet" description="Leads captured by your live automations will appear here." />}
        </Card>
        <Card>
          <CardHeader title="Upcoming appointments" action={<Link href="/portal/appointments" className="text-[12.5px] text-signal-300">View all</Link>} />
          {appts.data?.length ? (
            <ul className="space-y-3">
              {appts.data.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 text-[13px]">
                  <div><p className="text-fg">{a.title}</p><p className="text-subtle">{dateTime(a.starts_at)}{a.attendee_name && ` · ${a.attendee_name}`}</p></div>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          ) : <EmptyState title="Nothing booked yet" />}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Recent automation activity" action={<Link href="/portal/activity" className="text-[12.5px] text-signal-300">View all</Link>} />
        {events.data?.length ? (
          <ul className="divide-y divide-line">
            {events.data.map((e) => (
              <li key={e.id} className="flex justify-between gap-4 py-2.5 text-[13px]">
                <span className="text-fg/90">{e.summary}</span>
                <span className="shrink-0 text-subtle">{dateTime(e.occurred_at)}</span>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="No activity recorded yet" description="Activity appears once an automation has been tested, approved and activated." />}
      </Card>
    </>
  );
}
