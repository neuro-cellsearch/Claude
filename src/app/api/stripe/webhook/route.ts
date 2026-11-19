import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/integrations/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { notifyStaff, notifyOrganization } from "@/lib/integrations/notify";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const STATUS_MAP: Record<string, string> = {
  active: "active", trialing: "trialing", past_due: "past_due", unpaid: "past_due", canceled: "canceled",
  incomplete: "incomplete", incomplete_expired: "canceled", paused: "past_due",
};

function periodEnd(sub: Stripe.Subscription): string | null {
  // current_period_end moved to subscription items in newer API versions.
  const anySub = sub as unknown as { current_period_end?: number; items?: { data?: { current_period_end?: number }[] } };
  const ts = anySub.current_period_end ?? anySub.items?.data?.[0]?.current_period_end;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = serverEnv("STRIPE_WEBHOOK_SECRET");
  if (!stripe || !secret) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig ?? "", secret);
  } catch (err) {
    logger.warn("stripe_webhook_bad_signature", { err });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const db = createAdminClient();
  // Idempotency: ignore events we've already processed.
  const { error: dupErr } = await db.from("stripe_events").insert({ id: event.id, type: event.type });
  if (dupErr?.code === "23505") return NextResponse.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const orgId = s.metadata?.organization_id || s.client_reference_id;
        if (!orgId || s.mode !== "subscription") break;
        const subId = typeof s.subscription === "string" ? s.subscription : s.subscription?.id;
        const sub = subId ? await stripe.subscriptions.retrieve(subId) : null;
        const { data: row } = await db.from("subscriptions").upsert(
          {
            organization_id: orgId,
            plan_id: s.metadata?.plan_id || "enterprise",
            status: sub ? STATUS_MAP[sub.status] ?? "active" : "active",
            monthly_pence: Number(s.metadata?.monthly_pence ?? 0),
            setup_fee_pence: Number(s.metadata?.setup_pence ?? 0),
            stripe_subscription_id: subId,
            stripe_checkout_session_id: s.id,
            current_period_end: sub ? periodEnd(sub) : null,
            started_at: new Date().toISOString(),
          },
          { onConflict: "stripe_checkout_session_id" },
        ).select("id").single();
        await db.from("organizations").update({ status: "onboarding", stripe_customer_id: typeof s.customer === "string" ? s.customer : s.customer?.id }).eq("id", orgId).in("status", ["prospect", "churned", "paused"]);
        if (s.metadata?.quote_id) await db.from("quotes").update({ organization_id: orgId }).eq("id", s.metadata.quote_id);
        const { data: org } = await db.from("organizations").select("name").eq("id", orgId).single();
        await notifyStaff(`New customer: ${org?.name}`, `${org?.name} purchased the ${s.metadata?.plan_id} plan. Start onboarding.`, `/admin/customers/${orgId}`);
        await notifyOrganization(orgId, "Welcome to Kairo", "Your payment was successful. Complete onboarding so we can start building.", "/portal/onboarding");
        await audit(null, "subscription.created", "subscription", row?.id, { orgId, plan: s.metadata?.plan_id });
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
        const { data: org } = await db.from("organizations").select("id,name").eq("stripe_customer_id", customerId).maybeSingle();
        const anyInv = inv as unknown as { subscription?: string | { id: string }; parent?: { subscription_details?: { subscription?: string } } };
        const subId = typeof anyInv.subscription === "string" ? anyInv.subscription : anyInv.subscription?.id ?? anyInv.parent?.subscription_details?.subscription;
        const { data: sub } = subId ? await db.from("subscriptions").select("id").eq("stripe_subscription_id", subId).maybeSingle() : { data: null };
        const paid = event.type === "invoice.paid";
        // Split setup vs recurring using line items for accurate revenue reporting.
        const lines = inv.lines?.data ?? [];
        const recurring = lines.filter((l) => {
          const lx = l as unknown as { price?: { recurring?: unknown }; pricing?: { price_details?: unknown }; parent?: { subscription_item_details?: unknown } };
          return Boolean(lx.price?.recurring || lx.parent?.subscription_item_details);
        }).reduce((t, l) => t + l.amount, 0);
        const setup = Math.max(0, (paid ? inv.amount_paid : inv.amount_due) - recurring);
        const base = {
          organization_id: org?.id ?? null, subscription_id: sub?.id ?? null, currency: inv.currency,
          status: paid ? "paid" : "failed", paid_at: paid ? new Date((inv.status_transitions?.paid_at ?? event.created) * 1000).toISOString() : null,
        };
        // Upsert keyed by invoice id; a setup portion is stored separately with a suffixed id.
        await db.from("payments").upsert(
          { ...base, amount_pence: paid ? Math.min(recurring || inv.amount_paid, inv.amount_paid) : inv.amount_due, type: recurring ? "subscription" : "one_off", description: `Invoice ${inv.number ?? inv.id}`, stripe_invoice_id: inv.id },
          { onConflict: "stripe_invoice_id" },
        );
        if (paid && recurring && setup > 0) {
          await db.from("payments").upsert(
            { ...base, amount_pence: setup, type: "setup", description: `Setup fee — invoice ${inv.number ?? inv.id}`, stripe_invoice_id: `${inv.id}:setup` },
            { onConflict: "stripe_invoice_id" },
          );
        }
        if (!paid && org) {
          if (sub) await db.from("subscriptions").update({ status: "past_due" }).eq("id", sub.id);
          await notifyStaff(`Payment failed: ${org.name}`, `Invoice ${inv.number ?? inv.id} for ${(inv.amount_due / 100).toFixed(2)} ${inv.currency.toUpperCase()} failed.`, `/admin/customers/${org.id}`);
          await notifyOrganization(org.id, "Payment failed", "Please update your payment method to avoid interruption.", "/portal/billing");
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const status = event.type === "customer.subscription.deleted" ? "canceled" : STATUS_MAP[sub.status] ?? "active";
        const recurringAmount = sub.items.data.reduce((t, i) => t + (i.price.unit_amount ?? 0) * (i.quantity ?? 1), 0);
        const { data: row } = await db.from("subscriptions").update({
          status,
          current_period_end: periodEnd(sub),
          cancel_at_period_end: sub.cancel_at_period_end,
          canceled_at: status === "canceled" ? new Date().toISOString() : null,
          ...(recurringAmount > 0 ? { monthly_pence: recurringAmount } : {}),
        }).eq("stripe_subscription_id", sub.id).select("organization_id").maybeSingle();
        if (status === "canceled" && row?.organization_id) {
          const { count } = await db.from("subscriptions").select("id", { count: "exact", head: true })
            .eq("organization_id", row.organization_id).in("status", ["active", "trialing", "past_due"]);
          if (!count) {
            await db.from("organizations").update({ status: "churned", churned_at: new Date().toISOString() }).eq("id", row.organization_id);
            await notifyStaff("Customer churned", `Subscription ${sub.id} was cancelled.`, `/admin/customers/${row.organization_id}`);
          }
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    logger.error("stripe_webhook_failed", { type: event.type, err });
    // Allow Stripe to retry: remove the idempotency marker.
    await db.from("stripe_events").delete().eq("id", event.id);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
