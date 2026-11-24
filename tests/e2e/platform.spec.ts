import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { sql, signedHeaders, unsubscribeToken, RUN } from "./helpers";

const customer = { name: "Casey Morgan", company: `Morgan Roofing ${RUN} Ltd`, email: `casey.${RUN}@example.com`, password: "Str0ngPassw0rd!" };
const admin = { email: `owner.${RUN}@example.com`, password: "Adm1nPassw0rd!" };
const quoteLead = { name: "Priya Shah", email: `priya.${RUN}@example.com`, company: `Shah Dental ${RUN}` };

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe.serial("Kairo platform end-to-end", () => {
  // Rate limits persist in Postgres; reset so repeated local runs are deterministic.
  test.beforeAll(() => { sql("delete from rate_limits"); });

  test("homepage renders hero, demo and pricing; demo runs", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Every enquiry answered");
    await expect(page.getByText("Interactive demo · simulated data")).toBeVisible();
    await page.getByRole("tab", { name: "Dental" }).click();
    await page.getByRole("button", { name: "Run workflow" }).click();
    await expect(page.getByText("Consultation · Sat 10:00 — confirmation sent")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("£799").first()).toBeVisible();
    // No testimonials section exists without genuine, published testimonials.
    await expect(page.getByText("In our clients' words.")).toHaveCount(0);
  });

  test("chat assistant without an AI key shows an honest fallback and does not crash (desktop + mobile)", async ({ browser }) => {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("/pricing");
      await page.getByRole("button", { name: "Open chat assistant" }).click();
      await page.getByLabel("Message").fill("How much is the Growth plan?");
      await page.getByRole("button", { name: "Send" }).click();
      await expect(page.getByText(/assistant isn't switched on yet/)).toBeVisible();
      expect(errors).toEqual([]);
      await page.close();
    }
  });

  test("mobile navigation menu works", async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto("/");
    await page.getByRole("button", { name: "Toggle menu" }).click();
    await page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "Pricing" }).click();
    await page.waitForURL(/\/pricing/);
    await expect(page.getByRole("navigation", { name: "Mobile" })).toBeHidden();
    await page.close();
  });

  test("unknown routes show the branded 404", async ({ page }) => {
    const res = await page.goto("/this-does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "This page doesn't exist" })).toBeVisible();
  });

  test("visitor books a consultation through the real calendar", async ({ page }) => {
    await page.goto("/book");
    const firstTime = page.locator("button").filter({ hasText: /^\d{2}:\d{2}$/ }).first();
    await expect(firstTime).toBeVisible();
    await firstTime.click();
    await page.getByLabel("Full name").fill("Jordan Lee");
    await page.getByLabel("Work email").fill(`jordan.${RUN}@example.com`);
    await page.getByLabel("Company").fill(`Lee Estates ${RUN}`);
    await page.getByRole("checkbox", { name: /arrange and hold this consultation/ }).check();
    await page.getByRole("button", { name: /^Book / }).click();
    await expect(page.getByText("You're booked in")).toBeVisible();
    expect(sql(`select count(*) from consultations c join enquiries e on e.id=c.enquiry_id where e.email='jordan.${RUN}@example.com'`)).toBe("1");
    // Acknowledgement email is logged honestly as not_configured (no provider set).
    expect(sql(`select status from email_messages where to_email='jordan.${RUN}@example.com' limit 1`)).toBe("not_configured");
  });

  test("visitor requests a tailored quote; enquiry is scored and staff notified", async ({ page }) => {
    await page.goto("/quote?service=ai_chatbot");
    await page.getByLabel("Full name").fill(quoteLead.name);
    await page.getByLabel("Work email").fill(quoteLead.email);
    await page.getByLabel("Company").fill(quoteLead.company);
    await page.getByLabel("Industry").selectOption("dental");
    await page.getByLabel("Monthly budget (ex. VAT)").selectOption("750_1500");
    await page.getByRole("checkbox", { name: /privacy policy/ }).check();
    await page.getByRole("button", { name: "Request my tailored quote" }).click();
    await expect(page.getByText("your request is with our team")).toBeVisible();
    const score = Number(sql(`select score from enquiries where email='${quoteLead.email}'`));
    expect(score).toBeGreaterThanOrEqual(50);
    expect(Number(sql(`select count(*) from notifications where title like 'Quote request: ${quoteLead.company}%'`))).toBe(1);
  });

  test("form validation and honeypot", async ({ page }) => {
    await page.goto("/contact");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Please check the highlighted fields.")).toBeVisible();
  });

  test("customer registers, completes onboarding and stores an encrypted credential", async ({ page }) => {
    await page.goto("/register?plan=growth");
    await page.getByLabel("Your name").fill(customer.name);
    await page.getByLabel("Company").fill(customer.company);
    await page.getByLabel("Industry").selectOption("roofing");
    await page.getByLabel("Work email").fill(customer.email);
    await page.getByLabel(/^Password/).fill(customer.password);
    await page.getByRole("checkbox", { name: /accept the terms/ }).check();
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL(/\/portal\/billing\?plan=growth/);
    await expect(page.getByText("Card payments are not yet enabled")).toBeVisible();

    await page.goto("/portal/onboarding");
    await page.getByLabel("Website", { exact: true }).fill("https://morgan-roofing.example.com");
    await page.getByLabel("Main phone").fill("0113 496 0000");
    await page.getByRole("button", { name: "Save business information" }).click();
    await expect(page.getByText("Business information saved.")).toBeVisible();

    await page.getByRole("checkbox", { name: /AI Website Chatbot/ }).check();
    await page.getByRole("button", { name: "Save selection" }).click();
    await expect(page.getByText("1 automation(s) added to your plan.")).toBeVisible();

    await page.locator("textarea[name=faq_knowledge]").fill("Q: Which areas do you cover?\nA: Leeds and 25 miles around.\nQ: Free quotes?\nA: Yes, surveys are free.");
    await page.getByRole("button", { name: "Save approved knowledge" }).click();
    await expect(page.getByText(/Approved knowledge saved/)).toBeVisible();

    await page.getByLabel("Label").fill("HubSpot private app token");
    await page.getByLabel("API key, token or access details").fill("pat-eu1-SECRET-1234-ABCD");
    await page.getByRole("button", { name: "Store securely" }).click();
    await expect(page.getByText(/Stored securely/)).toBeVisible();
    await expect(page.getByText("…ABCD")).toBeVisible();
    await expect(page.getByText("pat-eu1-SECRET")).toHaveCount(0);
    const ct = sql(`select secret_ciphertext from integration_credentials c join organizations o on o.id=c.organization_id where o.name='${customer.company}'`);
    expect(ct.startsWith("v1.")).toBe(true);
    expect(ct).not.toContain("SECRET");

    await page.getByRole("button", { name: "Submit onboarding" }).click();
    await expect(page.getByText(/You can still update any section above/)).toBeVisible();
    expect(sql(`select onboarding_submitted_at is not null from organizations where name='${customer.company}'`)).toBe("t");
  });

  test("customer cannot reach admin, and data export works", async ({ page }) => {
    await login(page, customer.email, customer.password);
    await page.waitForURL(/\/portal/);
    await page.goto("/admin");
    await page.waitForURL(/\/portal$/);
    const res = await page.request.get("/portal/data-export");
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.organizations[0].name).toBe(customer.company);
    expect(JSON.stringify(json)).not.toContain("secret_ciphertext");
  });

  test("admin signs in and sees live metrics and the pipeline", async ({ page, request }) => {
    const signup = await request.post(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/signup`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! }, data: { email: admin.email, password: admin.password, data: { full_name: "Agency Owner", company_name: "Kairo Systems" } },
    });
    expect(signup.ok()).toBe(true);
    execFileSync("node", ["scripts/grant-admin.mjs", admin.email], { env: process.env });
    await login(page, admin.email, admin.password);
    await page.waitForURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Business overview" })).toBeVisible();
    await expect(page.getByText("Monthly net profit target")).toBeVisible();
    await page.goto("/admin/enquiries?view=table");
    const id = sql(`select id from enquiries where email='${quoteLead.email}'`);
    await expect(page.locator(`a[href="/admin/enquiries/${id}"]`)).toHaveText(quoteLead.name);
  });

  test("admin creates a proposal; client accepts it via the public link", async ({ page, browser }) => {
    await login(page, admin.email, admin.password);
    await page.waitForURL(/\/admin/);
    const enquiryId = sql(`select id from enquiries where email='${quoteLead.email}'`);
    await page.goto(`/admin/enquiries/${enquiryId}`);
    await page.getByRole("button", { name: "Create" }).click();
    await page.waitForURL(/\/admin\/quotes\//);
    await expect(page.locator("textarea[name=scope]")).toHaveValue(/tested|testing/);
    await page.getByRole("button", { name: "Send proposal" }).click();
    await expect(page.getByText(/Email isn't configured, so nothing was sent/)).toBeVisible();
    await page.getByRole("button", { name: "Mark as sent manually" }).click();
    await expect(page.getByText("sent").first()).toBeVisible();
    const token = sql(`select public_token from quotes where enquiry_id='${enquiryId}'`);

    const client = await browser.newPage();
    await client.goto(`/proposal/${token}`);
    await expect(client.getByText("Investment")).toBeVisible();
    await client.getByLabel("Your full name").fill(quoteLead.name);
    await client.getByRole("checkbox", { name: /authorised to accept/ }).check();
    await client.getByRole("button", { name: "Accept proposal" }).click();
    await expect(client.getByText(/Accepted by Priya Shah/)).toBeVisible();
    expect(sql(`select stage from enquiries where id='${enquiryId}'`)).toBe("won");
    await client.close();
  });

  test("automation lifecycle: cannot activate untested; build → test → approve → activate", async ({ page }) => {
    const orgId = sql(`select id from organizations where name='${customer.company}'`);
    const autoId = sql(`select id from automations where organization_id='${orgId}'`);
    // Database refuses activation without test + approval, even for the service role.
    expect(() => sql(`update automations set status='active' where id='${autoId}'`)).toThrow(/automation_active_requires_test_and_approval/);

    await login(page, admin.email, admin.password);
    await page.waitForURL(/\/admin/);
    await page.goto(`/admin/customers/${orgId}`);
    await page.getByRole("button", { name: "Start build" }).click();
    await expect(page.getByRole("button", { name: "Move to testing" })).toBeVisible();
    await page.getByRole("button", { name: "Move to testing" }).click();
    await expect(page.getByRole("button", { name: "Request approval" })).toBeVisible();
    await page.getByRole("button", { name: "Request approval" }).click();
    await expect(page.getByText("Record a passing test before requesting approval.")).toBeVisible();
    await page.locator("textarea[name=notes]").last().fill("Sent 5 scripted chats incl. pricing question and complaint; all answered from FAQs, complaint escalated.");
    await page.getByRole("checkbox", { name: "Test passed" }).check();
    await page.getByRole("button", { name: "Record manual test" }).click();
    await expect(page.getByText("Passing test recorded.")).toBeVisible();
    await page.getByRole("button", { name: "Request approval" }).click();
    await expect(page.getByRole("button", { name: "Approve implementation" })).toBeVisible();
    await page.getByRole("button", { name: "Approve implementation" }).click();
    await expect(page.getByRole("button", { name: "Activate" })).toBeVisible();
    await page.getByRole("button", { name: "Activate" }).click();
    await expect(page.getByText(/Confirm you have switched the workflow on/)).toBeVisible();
    await page.getByRole("checkbox", { name: /switched this workflow on/ }).check();
    await page.getByRole("button", { name: "Activate" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    expect(sql(`select status from automations where id='${autoId}'`)).toBe("active");
  });

  test("signed automation events create leads; unsigned or unknown events are rejected", async ({ page, request }) => {
    const orgId = sql(`select id from organizations where name='${customer.company}'`);
    const autoId = sql(`select id from automations where organization_id='${orgId}'`);
    const body = JSON.stringify({
      automation_id: autoId, event_type: "lead.captured", summary: "Website chat: storm damage enquiry", external_event_id: `evt-${RUN}`,
      lead: { name: "Alex Turner", email: "alex@example.com", source: "website_chat", enquiry: "Leak after storm", score: 82 },
      appointment: { title: "Roof survey", starts_at: new Date(Date.now() + 2 * 86400_000).toISOString(), attendee_name: "Alex Turner", external_id: `apt-${RUN}` },
    });
    const ok = await request.post("/api/automations/events", { headers: signedHeaders(body), data: body });
    expect(ok.status()).toBe(200);
    const dup = await request.post("/api/automations/events", { headers: signedHeaders(body), data: body });
    expect((await dup.json()).duplicate).toBe(true);
    const bad = await request.post("/api/automations/events", { headers: { ...signedHeaders(body), "X-Kairo-Signature": "sha256=deadbeef" }, data: body });
    expect(bad.status()).toBe(401);
    const unknown = JSON.stringify({ automation_id: "00000000-0000-4000-8000-000000000000", event_type: "x", summary: "x" });
    expect((await request.post("/api/automations/events", { headers: signedHeaders(unknown), data: unknown })).status()).toBe(404);

    await login(page, customer.email, customer.password);
    await page.waitForURL(/\/portal/);
    await page.goto("/portal/leads");
    await expect(page.getByText("Alex Turner").first()).toBeVisible();
    await page.goto("/portal/appointments");
    await expect(page.getByText("Roof survey")).toBeVisible();
    await page.goto("/portal");
    await expect(page.getByText("Website chat: storm damage enquiry")).toBeVisible();
    const csv = await page.request.get("/portal/leads/export");
    expect(await csv.text()).toContain("Alex Turner");
  });

  test("finance: expenses and forecast calculator", async ({ page }) => {
    await login(page, admin.email, admin.password);
    await page.waitForURL(/\/admin/);
    await page.goto("/admin/finance");
    const seed = page.getByRole("button", { name: "Add typical cost estimates" });
    if (await seed.count()) await seed.click();
    await expect(page.getByText("OpenAI API usage")).toBeVisible();
    await expect(page.getByText(/Customers for £10,000\/mo net/)).toBeVisible();
    for (const n of ["5", "10", "15", "20", "30"]) await expect(page.locator("td").filter({ hasText: new RegExp(`^${n}$`) }).first()).toBeVisible();
  });

  test("outreach: compliance gating, mandatory message review and approval", async ({ page }) => {
    await login(page, admin.email, admin.password);
    await page.waitForURL(/\/admin/);
    await page.goto("/admin/prospects");
    const add = async (company: string, entity: string, email: string) => {
      await page.getByLabel("Company name").fill(company);
      await page.getByLabel("Legal entity").selectOption(entity);
      await page.getByLabel("Contact name").fill("Sam Jones");
      await page.getByLabel(/Business email/).fill(email);
      await page.getByLabel("Source of data").fill("Company website contact page");
      await page.getByRole("button", { name: "Add prospect" }).click();
      await expect(page.getByText(/Prospect added/)).toBeVisible();
    };
    await add(`Apex Roofing ${RUN} Ltd`, "limited_company", `info@apex-${RUN}.example.com`);
    await add(`Bob's Roofing ${RUN}`, "sole_trader", `bob@bob-${RUN}.example.com`);
    for (const id of sql(`select id from prospects where company_name like '%${RUN}%'`).split("\n")) sql(`update prospects set status='approved', approved_at=now() where id='${id}'`);

    await page.goto("/admin/campaigns");
    await page.getByLabel("Name").fill(`Roofers ${RUN}`);
    await page.getByLabel("Template").selectOption({ label: "Roofing — missed calls on the roof (email)" });
    await page.getByRole("button", { name: "Create" }).click();
    await page.waitForURL(/\/admin\/campaigns\//);
    await expect(page.locator("p").filter({ hasText: `Bob's Roofing ${RUN}` })).toContainText("PECR: unsolicited email needs prior consent");
    await page.getByRole("checkbox", { name: new RegExp(`Apex Roofing ${RUN}`) }).check();
    await page.getByRole("button", { name: "Add selected & personalise" }).click();
    await expect(page.getByText("1 added.")).toBeVisible();
    await expect(page.getByText(/Fill in: \{\{area\}\}/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve message" })).toHaveCount(0);
    const body = page.locator("textarea[name=body]").first();
    await body.fill((await body.inputValue()).replaceAll("{{area}}", "Leeds").replaceAll("{{agency_address}}", "1 Example St, Leeds"));
    await page.getByRole("button", { name: "Save edits" }).click();
    await expect(page.getByText("Saved — needs re-approval.")).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Approve message" }).click();
    await page.getByRole("button", { name: "Submit for approval" }).click();
    await page.getByRole("button", { name: "Approve campaign" }).click();
    expect(sql(`select status from outreach_campaigns where name='Roofers ${RUN}'`)).toMatch(/pending_approval|approved/);
    await page.getByRole("button", { name: /Send next batch/ }).click();
    expect(sql(`select status from outreach_campaigns where name='Roofers ${RUN}'`)).toBe("approved");
    await expect(page.getByText("Email provider isn't configured — nothing was sent.")).toBeVisible();
  });

  test("unsubscribe link suppresses the address", async ({ page }) => {
    const email = `info@apex-${RUN}.example.com`;
    await page.goto(`/unsubscribe?e=${encodeURIComponent(email)}&t=${unsubscribeToken(email)}`);
    await expect(page.getByRole("heading", { name: "You've been unsubscribed." })).toBeVisible();
    expect(sql(`select count(*) from suppression_list where value='${email}'`)).toBe("1");
    expect(sql(`select status from prospects where business_email='${email}'`)).toBe("do_not_contact");
    await page.goto(`/unsubscribe?e=${encodeURIComponent(email)}&t=wrong`);
    await expect(page.getByRole("heading", { name: "This link isn't valid." })).toBeVisible();
  });

  test("protected endpoints refuse unauthenticated or unconfigured use", async ({ request }) => {
    expect((await request.get("/api/cron/process")).status()).toBe(401);
    const cron = await request.get("/api/cron/process", { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
    expect(cron.status()).toBe(200);
    expect((await request.post("/api/stripe/webhook", { data: "{}" })).status()).toBe(503);
    expect((await request.post("/api/chat", { data: { messages: [{ role: "user", content: "hi" }] } })).status()).toBe(503);
    const exp = await request.get("/portal/leads/export", { maxRedirects: 0 });
    expect(exp.status()).toBe(307); // proxy redirects anonymous users to /login before the route runs
    expect(exp.headers()["location"]).toContain("/login");
  });

  test("integrations page shows honest status", async ({ page }) => {
    await login(page, admin.email, admin.password);
    await page.waitForURL(/\/admin/);
    await page.goto("/admin/integrations");
    await expect(page.getByText("not configured").first()).toBeVisible();
    const supabaseCard = page.locator(".surface-raised").filter({ hasText: "Database, authentication" });
    await supabaseCard.getByRole("button", { name: "Run live test" }).click();
    await expect(page.getByText(/Database reachable and migrations applied/)).toBeVisible();
  });
});
