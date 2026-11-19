import { getPortalContext } from "../context";
import { getPlans } from "@/lib/content/plans";
import { PageHeader, Card, CardHeader, StatusBadge, Notice, Table, Th, Td, EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { startCheckout, openBillingPortal } from "../actions";
import { stripeConfigured } from "@/lib/integrations/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { gbp, date } from "@/lib/format";

const ERRORS: Record<string, string> = {
  stripe_not_configured: "Online payments aren't switched on yet. We'll send you an invoice instead — or contact support.",
  plan: "That plan isn't available for online checkout.",
  quote: "That proposal couldn't be found for your account.",
  checkout: "We couldn't start checkout. Please try again or contact support.",
  no_customer: "No billing account exists yet — choose a plan first.",
  portal: "The billing portal couldn't be opened. Please try again.",
};

export default async function BillingPage(props: PageProps<"/portal/billing">) {
  const sp = await props.searchParams;
  const { supabase, profile, org } = await getPortalContext();
  const [{ data: subs }, { data: payments }, plans] = await Promise.all([
    supabase.from("subscriptions").select("*").order("created_at", { ascending: false }),
    supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(50),
    getPlans(),
  ]);
  // Accepted proposals addressed to this user that are awaiting payment.
  const { data: quotes } = await createAdminClient()
    .from("quotes").select("id,number,title,setup_total_pence,monthly_total_pence")
    .eq("status", "accepted").ilike("recipient_email", profile.email);
  const current = subs?.find((s) => ["active", "trialing", "past_due"].includes(s.status));
  const highlighted = typeof sp.plan === "string" ? sp.plan : null;
  const payable = (quotes ?? []).filter((q) => !subs?.some((s) => s.status === "active" && s.monthly_pence === q.monthly_total_pence));

  return (
    <>
      <PageHeader title="Billing" description="Your plan, invoices and payment details." />
      {sp.checkout === "success" && <div className="mb-6"><Notice tone="green" title="Payment received">Thank you. Your subscription will appear here as soon as Stripe confirms it (usually within a minute).</Notice></div>}
      {sp.checkout === "cancelled" && <div className="mb-6"><Notice tone="amber">Checkout was cancelled — you haven't been charged.</Notice></div>}
      {typeof sp.error === "string" && ERRORS[sp.error] && <div className="mb-6"><Notice tone="red">{ERRORS[sp.error]}</Notice></div>}
      {!stripeConfigured() && <div className="mb-6"><Notice tone="amber" title="Online payments not configured">Card payments are not yet enabled on this platform.</Notice></div>}

      {current ? (
        <Card>
          <CardHeader title="Current plan" action={<StatusBadge status={current.status} />} />
          <div className="grid gap-4 sm:grid-cols-3">
            <div><p className="text-[12px] text-subtle">Plan</p><p className="text-lg font-semibold capitalize text-fg">{current.plan_id}</p></div>
            <div><p className="text-[12px] text-subtle">Monthly</p><p className="text-lg font-semibold text-fg">{gbp(current.monthly_pence)} <span className="text-[13px] font-normal text-muted">+ VAT</span></p></div>
            <div><p className="text-[12px] text-subtle">{current.cancel_at_period_end ? "Ends" : "Renews"}</p><p className="text-lg font-semibold text-fg">{date(current.current_period_end)}</p></div>
          </div>
          {org?.stripe_customer_id && (
            <form action={openBillingPortal} className="mt-5"><Button variant="secondary">Manage payment method, invoices &amp; plan</Button></form>
          )}
        </Card>
      ) : (
        <>
          {payable.length > 0 && (
            <Card className="mb-6">
              <CardHeader title="Your accepted proposal" description="Complete payment to begin implementation." />
              {payable.map((q) => (
                <form key={q.id} action={startCheckout} className="flex flex-col justify-between gap-3 rounded-lg border border-signal-500/40 bg-signal-500/5 p-4 sm:flex-row sm:items-center">
                  <input type="hidden" name="quote" value={q.id} />
                  <div><p className="font-medium text-fg">{q.title} <span className="text-subtle">({q.number})</span></p><p className="text-[13px] text-muted">{gbp(q.setup_total_pence)} setup + {gbp(q.monthly_total_pence)}/month, ex. VAT</p></div>
                  <Button disabled={!stripeConfigured()}>Proceed to secure payment</Button>
                </form>
              ))}
            </Card>
          )}
          <Card>
            <CardHeader title="Choose a plan" description="Setup fee and first month are charged today. Prices exclude VAT, which is added at checkout where applicable." />
            <div className="grid gap-4 md:grid-cols-3">
              {plans.filter((p) => p.id !== "enterprise").map((p) => (
                <form key={p.id} action={startCheckout} className={`flex flex-col rounded-xl border p-5 ${highlighted === p.id ? "border-signal-500 glow-ring" : "border-line"}`}>
                  <input type="hidden" name="plan" value={p.id} />
                  <p className="font-semibold text-fg">{p.name}</p>
                  <p className="mt-2 text-2xl font-semibold text-fg">{gbp(p.monthly_pence)}<span className="text-[13px] font-normal text-muted">/mo</span></p>
                  <p className="text-[12.5px] text-subtle">+ {gbp(p.setup_fee_pence)} setup</p>
                  <ul className="mt-3 flex-1 space-y-1 text-[12.5px] text-muted">{p.features.slice(0, 4).map((f) => <li key={f}>· {f}</li>)}</ul>
                  <Button className="mt-4" variant={highlighted === p.id ? "primary" : "secondary"} disabled={!stripeConfigured()}>Select {p.name}</Button>
                </form>
              ))}
            </div>
            <p className="mt-4 text-[12.5px] text-subtle">Need something custom? <a className="text-signal-300 underline" href="/quote">Request a tailored quote</a>.</p>
          </Card>
        </>
      )}

      <Card className="mt-6">
        <CardHeader title="Payment history" />
        {!payments?.length ? <EmptyState title="No payments yet" /> : (
          <Table>
            <thead><tr><Th>Date</Th><Th>Description</Th><Th>Type</Th><Th>Amount</Th><Th>Status</Th></tr></thead>
            <tbody>{payments.map((p) => (
              <tr key={p.id}><Td>{date(p.paid_at ?? p.created_at)}</Td><Td>{p.description ?? "—"}</Td><Td className="capitalize">{p.type.replace("_", " ")}</Td><Td className="tabular-nums">{gbp(p.amount_pence, { decimals: true })}</Td><Td><StatusBadge status={p.status} /></Td></tr>
            ))}</tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
