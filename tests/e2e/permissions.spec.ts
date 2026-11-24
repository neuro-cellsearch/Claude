import { test, expect, request as pwRequest, type APIRequestContext } from "@playwright/test";
import { sql, RUN } from "./helpers";

/**
 * Permission matrix: real Supabase REST calls with real user JWTs.
 * Verifies RLS + column grants independently of the app's server-side checks.
 */
const U = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function signUp(req: APIRequestContext, email: string, company: string) {
  const r = await req.post(`${U()}/auth/v1/signup`, { headers: { apikey: ANON() }, data: { email, password: "Perm1ssionsTest!", data: { company_name: company } } });
  expect(r.ok()).toBe(true);
}
async function token(req: APIRequestContext, email: string) {
  const r = await req.post(`${U()}/auth/v1/token?grant_type=password`, { headers: { apikey: ANON() }, data: { email, password: "Perm1ssionsTest!" } });
  return (await r.json()).access_token as string;
}
function rest(req: APIRequestContext, jwt: string | null) {
  const headers = { apikey: ANON(), Authorization: `Bearer ${jwt ?? ANON()}`, "Content-Type": "application/json", Prefer: "return=representation" };
  return {
    get: async (path: string) => { const r = await req.get(`${U()}/rest/v1/${path}`, { headers }); return { status: r.status(), body: await r.json() }; },
    post: async (table: string, data: unknown) => { const r = await req.post(`${U()}/rest/v1/${table}`, { headers, data }); return { status: r.status(), body: await r.json().catch(() => null) }; },
    patch: async (path: string, data: unknown) => { const r = await req.patch(`${U()}/rest/v1/${path}`, { headers, data }); return { status: r.status(), body: await r.json().catch(() => null) }; },
    del: async (path: string) => { const r = await req.delete(`${U()}/rest/v1/${path}`, { headers }); return { status: r.status(), body: await r.json().catch(() => null) }; },
  };
}
const denied = (r: { status: number; body: unknown }) => r.status >= 400 || (Array.isArray(r.body) && r.body.length === 0);

test.describe.serial("Row-level security permission matrix", () => {
  const a = `perm.a.${RUN}@example.com`, b = `perm.b.${RUN}@example.com`, s = `perm.staff.${RUN}@example.com`;
  let A: ReturnType<typeof rest>, B: ReturnType<typeof rest>, S: ReturnType<typeof rest>, X: ReturnType<typeof rest>;
  let orgA = "", orgB = "", leadB = "", autoA = "";

  let ctx: APIRequestContext;
  test.afterAll(async () => { await ctx?.dispose(); });
  test.beforeAll(async () => {
    ctx = await pwRequest.newContext();
    const request = ctx;
    await signUp(request, a, `Perm A ${RUN}`); await signUp(request, b, `Perm B ${RUN}`); await signUp(request, s, `Perm S ${RUN}`);
    sql(`update profiles set role='staff' where email='${s}'`);
    orgA = sql(`select organization_id from profiles where email='${a}'`);
    orgB = sql(`select organization_id from profiles where email='${b}'`);
    autoA = sql(`insert into automations(organization_id,service_key,name) values('${orgA}','ai_chatbot','perm') returning id`).split("\n")[0];
    leadB = sql(`insert into customer_leads(organization_id,name,email) values('${orgB}','Secret Lead','secret@b.example') returning id`).split("\n")[0];
    sql(`insert into integration_credentials(organization_id,provider,label,secret_ciphertext) values('${orgA}','x','x','v1.a.b.c')`);
    A = rest(request, await token(request, a)); B = rest(request, await token(request, b)); S = rest(request, await token(request, s)); X = rest(request, null);
  });

  test("anonymous visitors see only public plans and published proof", async () => {
    for (const t of ["organizations", "profiles", "enquiries", "customer_leads", "subscriptions", "payments", "quotes", "prospects", "expenses", "audit_logs", "automations"]) {
      expect(denied(await X.get(`${t}?select=id&limit=1`)), t).toBe(true);
    }
    expect((await X.get("plans?select=id")).body.length).toBeGreaterThan(0);
    expect(denied(await X.post("enquiries", { type: "contact", name: "x", email: "x@x.com" }))).toBe(true);
  });

  test("customers are isolated to their own organisation", async () => {
    const orgs = (await A.get("organizations?select=id")).body as { id: string }[];
    expect(orgs.map((o) => o.id)).toEqual([orgA]);
    expect(denied(await A.get(`customer_leads?id=eq.${leadB}`))).toBe(true);
    expect(denied(await A.patch(`customer_leads?id=eq.${leadB}`, { status: "won" }))).toBe(true);
    expect(sql(`select status from customer_leads where id='${leadB}'`)).toBe("new");
    expect(denied(await A.post("support_tickets", { organization_id: orgB, subject: "x" }))).toBe(true);
    expect(denied(await A.post("automation_requests", { organization_id: orgB, service_key: "x", description: "x" }))).toBe(true);
    expect((await A.get("profiles?select=email")).body).toEqual([{ email: a }]);
  });

  test("customers cannot escalate privileges or change protected fields", async () => {
    expect(denied(await A.patch(`profiles?email=eq.${a}`, { role: "admin" }))).toBe(true);
    expect(denied(await A.patch(`profiles?email=eq.${a}`, { organization_id: orgB }))).toBe(true);
    expect(denied(await A.patch(`organizations?id=eq.${orgA}`, { status: "active" }))).toBe(true);
    expect(denied(await A.patch(`organizations?id=eq.${orgA}`, { stripe_customer_id: "cus_hijack" }))).toBe(true);
    expect(denied(await A.post("automations", { organization_id: orgA, service_key: "x", name: "x" }))).toBe(true);
    expect(denied(await A.patch(`automations?id=eq.${autoA}`, { status: "active", test_passed: true }))).toBe(true);
    expect(denied(await A.post("subscriptions", { organization_id: orgA, plan_id: "premium", monthly_pence: 0, status: "active" }))).toBe(true);
    expect(denied(await A.post("payments", { organization_id: orgA, amount_pence: 1, type: "setup" }))).toBe(true);
    expect(denied(await A.post("ticket_messages", { ticket_id: "00000000-0000-4000-8000-000000000000", body: "x", is_internal: true }))).toBe(true);
    expect(sql(`select role from profiles where email='${a}'`)).toBe("customer");
    // Allowed: editing own business details.
    expect((await A.patch(`organizations?id=eq.${orgA}`, { website: "https://a.example" })).status).toBe(200);
  });

  test("encrypted credentials are unreadable by every browser role", async () => {
    for (const c of [A, B, S, X]) expect(denied(await c.get("integration_credentials?select=*"))).toBe(true);
  });

  test("rate-limit and privileged functions are not callable from the browser", async () => {
    for (const c of [A, S, X]) {
      expect((await c.post("rpc/check_rate_limit", { p_key: "x", p_limit: 1, p_window_seconds: 1 })).status).toBeGreaterThanOrEqual(400);
      expect((await c.post("rpc/seed_onboarding_tasks", { p_org: orgA })).status).toBeGreaterThanOrEqual(400);
    }
  });

  test("staff can read but cannot write directly (admin approvals cannot be bypassed)", async () => {
    expect((await S.get("enquiries?select=id&limit=1")).status).toBe(200);
    expect(denied(await S.patch(`automations?id=eq.${autoA}`, { test_passed: true, approved_at: new Date().toISOString(), status: "active" }))).toBe(true);
    expect(sql(`select status from automations where id='${autoA}'`)).toBe("requested");
    expect(denied(await S.post("outreach_campaigns", { name: "x", channel: "email", status: "approved", approved_at: new Date().toISOString() }))).toBe(true);
    expect(denied(await S.patch(`profiles?email=eq.${s}`, { role: "admin" }))).toBe(true);
    expect(denied(await S.get("expenses?select=id"))).toBe(true);
    expect(denied(await S.del(`customer_leads?id=eq.${leadB}`))).toBe(true);
    expect(sql(`select count(*) from customer_leads where id='${leadB}'`)).toBe("1");
  });
});
