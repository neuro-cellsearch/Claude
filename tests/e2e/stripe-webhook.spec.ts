import { test, expect } from "@playwright/test";
import Stripe from "stripe";
import { sql, RUN } from "./helpers";

/**
 * WEBHOOK LOGIC TESTS — these do NOT prove the Stripe integration works.
 * Events are signed locally with Stripe's library and a test secret, then posted
 * to an app instance started with:
 *   STRIPE_SECRET_KEY=sk_test_dummy STRIPE_WEBHOOK_SECRET=whsec_localtest npx next start -p 3001
 * and STRIPE_TEST_URL=http://localhost:3001. A real Stripe test-mode run is still required.
 */
const URL_ = process.env.STRIPE_TEST_URL;
const SECRET = "whsec_localtest";
test.skip(!URL_, "STRIPE_TEST_URL not set");

const stripe = new Stripe("sk_test_dummy");
const now = () => Math.floor(Date.now() / 1000);
let n = 0;
async function send(type: string, object: Record<string, unknown>, id = `evt_${RUN}_${++n}`) {
  const payload = JSON.stringify({ id, object: "event", type, created: now(), data: { object } });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  const r = await fetch(`${URL_}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": header, "content-type": "application/json" }, body: payload });
  return { status: r.status, body: await r.json() };
}

test.describe.serial("Stripe webhook handling (synthetic signed events)", () => {
  let org = "", cus = "";
  test.beforeAll(() => {
    org = sql(`insert into organizations(name,status) values('Stripe Test ${RUN}','prospect') returning id`).split("\n")[0];
    cus = `cus_${RUN}`;
    sql(`update organizations set stripe_customer_id='${cus}' where id='${org}'`);
  });

  test("rejects unsigned and tampered events", async () => {
    expect((await fetch(`${URL_}/api/stripe/webhook`, { method: "POST", body: "{}" })).status).toBe(400);
    const payload = JSON.stringify({ id: "evt_x", type: "invoice.paid", data: { object: {} } });
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_wrong" });
    expect((await fetch(`${URL_}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": header }, body: payload })).status).toBe(400);
  });

  test("an UNPAID completed checkout (delayed payment method) does not grant access", async () => {
    const r = await send("checkout.session.completed", { id: `cs_unpaid_${RUN}`, object: "checkout.session", mode: "subscription", payment_status: "unpaid", customer: cus, subscription: null, client_reference_id: org, metadata: { organization_id: org, plan_id: "growth", setup_pence: "99900", monthly_pence: "79900" } });
    expect(r.status).toBe(200);
    expect(sql(`select status from subscriptions where stripe_checkout_session_id='cs_unpaid_${RUN}'`)).toBe("incomplete");
    expect(sql(`select status from organizations where id='${org}'`)).toBe("prospect");
  });

  test("async payment success then activates the subscription", async () => {
    await send("checkout.session.async_payment_succeeded", { id: `cs_unpaid_${RUN}`, object: "checkout.session", mode: "subscription", payment_status: "paid", customer: cus, subscription: null, client_reference_id: org, metadata: { organization_id: org, plan_id: "growth", setup_pence: "99900", monthly_pence: "79900" } });
    expect(sql(`select status from subscriptions where stripe_checkout_session_id='cs_unpaid_${RUN}'`)).toBe("active");
    expect(sql(`select status from organizations where id='${org}'`)).toBe("onboarding");
    sql(`update subscriptions set stripe_subscription_id='sub_${RUN}' where stripe_checkout_session_id='cs_unpaid_${RUN}'`);
  });

  test("duplicate deliveries are ignored (idempotency)", async () => {
    const id = `evt_dup_${RUN}`;
    await send("invoice.payment_failed", { id: `in_dup_${RUN}`, object: "invoice", customer: cus, currency: "gbp", amount_due: 100, amount_paid: 0, lines: { data: [] } }, id);
    const r = await send("invoice.payment_failed", { id: `in_dup_${RUN}`, object: "invoice", customer: cus, currency: "gbp", amount_due: 100, amount_paid: 0, lines: { data: [] } }, id);
    expect(r.body.duplicate).toBe(true);
    expect(sql(`select count(*) from payments where stripe_invoice_id='in_dup_${RUN}'`)).toBe("1");
  });

  test("first invoice is split into setup and recurring revenue", async () => {
    await send("invoice.paid", { id: `in_${RUN}`, object: "invoice", number: "T-1", customer: cus, currency: "gbp", amount_paid: 179800, amount_due: 179800, subscription: `sub_${RUN}`, status_transitions: { paid_at: now() },
      lines: { data: [{ amount: 79900, price: { recurring: { interval: "month" } } }, { amount: 99900, price: { recurring: null } }] } });
    expect(sql(`select string_agg(type||':'||amount_pence, ',' order by type) from payments where stripe_invoice_id like 'in_${RUN}%'`)).toBe("setup:99900,subscription:79900");
    expect(sql(`select count(*) from payments where stripe_invoice_id like 'in_${RUN}%' and subscription_id is not null`)).toBe("2");
  });

  test("a failed renewal marks the subscription past_due", async () => {
    await send("invoice.payment_failed", { id: `in_fail_${RUN}`, object: "invoice", customer: cus, currency: "gbp", amount_due: 79900, amount_paid: 0, subscription: `sub_${RUN}`, lines: { data: [] } });
    expect(sql(`select status from subscriptions where stripe_subscription_id='sub_${RUN}'`)).toBe("past_due");
  });

  test("refunds are recorded as negative payments, once", async () => {
    const charge = { id: `ch_${RUN}`, object: "charge", customer: cus, payment_intent: `pi_${RUN}`, refunds: { data: [{ id: `re_${RUN}`, amount: 99900, currency: "gbp", status: "succeeded", created: now() }] } };
    await send("charge.refunded", charge); await send("charge.refunded", charge);
    expect(sql(`select string_agg(amount_pence::text, ',') from payments where stripe_invoice_id='refund:re_${RUN}'`)).toBe("-99900");
  });

  test("cancellation marks the customer as churned", async () => {
    await send("customer.subscription.deleted", { id: `sub_${RUN}`, object: "subscription", status: "canceled", cancel_at_period_end: false, items: { data: [] } });
    expect(sql(`select o.status||'/'||s.status from organizations o join subscriptions s on s.organization_id=o.id where o.id='${org}'`)).toBe("churned/canceled");
  });
});

test("server refuses a second checkout when a live subscription exists (stale tab / double submit)", async ({ browser }) => {
  const email = `dupsub.${RUN}@example.com`, pw = "DupSubPassw0rd!";
  const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/signup`, { method: "POST", headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: pw }) });
  expect(r.ok).toBe(true);
  sql(`update auth.users set email_confirmed_at = now() where email='${email}'`);
  const page = await browser.newPage({ baseURL: URL_ });
  await page.goto("/login");
  await page.getByLabel("Email").fill(email); await page.getByLabel("Password").fill(pw);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/portal/);
  await page.goto("/portal/billing");
  const orgId = sql(`select organization_id from profiles where email='${email}'`);
  sql(`insert into subscriptions(organization_id,plan_id,status,monthly_pence,started_at) values('${orgId}','starter','active',29900,now())`);
  await page.getByRole("button", { name: "Select Growth" }).click();
  await page.waitForURL(/error=already_subscribed/);
  await page.close();
});
