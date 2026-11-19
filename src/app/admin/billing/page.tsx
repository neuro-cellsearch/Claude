import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Card, CardHeader, Table, Th, Td, StatusBadge, EmptyState, StatCard, Notice } from "@/components/ui/primitives";
import { stripeConfigured } from "@/lib/integrations/stripe";
import { gbp, date } from "@/lib/format";

export default async function BillingAdmin() {
  const db = createAdminClient();
  const [{ data: subs }, { data: payments }] = await Promise.all([
    db.from("subscriptions").select("*, organizations(id,name)").order("created_at", { ascending: false }).limit(500),
    db.from("payments").select("*, organizations(id,name)").order("created_at", { ascending: false }).limit(300),
  ]);
  const S = subs ?? [];
  const live = S.filter((s) => ["active", "trialing", "past_due"].includes(s.status));
  const pastDue = S.filter((s) => s.status === "past_due");
  const paid = (payments ?? []).filter((p) => p.status === "paid");
  const thisMonth = new Date(); thisMonth.setUTCDate(1); thisMonth.setUTCHours(0, 0, 0, 0);
  return (
    <>
      <PageHeader title="Subscriptions & payments" description="Synced from Stripe via webhooks. Manage refunds and disputes in the Stripe dashboard." />
      {!stripeConfigured() && <div className="mb-6"><Notice tone="amber" title="Stripe not configured">No payments will be recorded until Stripe keys and the webhook are set up — see Integrations.</Notice></div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="MRR" value={gbp(live.reduce((t, s) => t + s.monthly_pence, 0))} />
        <StatCard label="Live subscriptions" value={live.length} />
        <StatCard label="Past due" value={pastDue.length} tone={pastDue.length ? "down" : "neutral"} hint={pastDue.length ? gbp(pastDue.reduce((t, s) => t + s.monthly_pence, 0)) + " at risk" : undefined} />
        <StatCard label="Collected this month" value={gbp(paid.filter((p) => p.paid_at && new Date(p.paid_at) >= thisMonth).reduce((t, p) => t + p.amount_pence, 0))} />
      </div>
      <Card className="mt-6"><CardHeader title="Subscriptions" />
        {!S.length ? <EmptyState title="No subscriptions yet" /> : (
          <Table><thead><tr><Th>Customer</Th><Th>Plan</Th><Th>Monthly</Th><Th>Setup</Th><Th>Status</Th><Th>Started</Th><Th>Renews / ended</Th></tr></thead>
            <tbody>{S.map((s) => { const o = s.organizations as { id: string; name: string }; return (
              <tr key={s.id}><Td><Link className="text-signal-300" href={`/admin/customers/${o?.id}`}>{o?.name}</Link></Td><Td className="capitalize">{s.plan_id}</Td><Td>{gbp(s.monthly_pence)}</Td><Td>{gbp(s.setup_fee_pence)}</Td><Td><StatusBadge status={s.status} />{s.cancel_at_period_end && <span className="ml-1 text-[11px] text-warning">cancelling</span>}</Td><Td>{date(s.started_at)}</Td><Td>{s.canceled_at ? date(s.canceled_at) : date(s.current_period_end)}</Td></tr>
            ); })}</tbody>
          </Table>
        )}
      </Card>
      <Card className="mt-6"><CardHeader title="Payments" />
        {!payments?.length ? <EmptyState title="No payments recorded" /> : (
          <Table><thead><tr><Th>Date</Th><Th>Customer</Th><Th>Description</Th><Th>Type</Th><Th>Amount</Th><Th>Status</Th></tr></thead>
            <tbody>{payments.map((p) => { const o = p.organizations as { id: string; name: string } | null; return (
              <tr key={p.id}><Td>{date(p.paid_at ?? p.created_at)}</Td><Td>{o?.name ?? "—"}</Td><Td>{p.description}</Td><Td>{p.type}</Td><Td className="tabular-nums">{gbp(p.amount_pence, { decimals: true })}</Td><Td><StatusBadge status={p.status} /></Td></tr>
            ); })}</tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
