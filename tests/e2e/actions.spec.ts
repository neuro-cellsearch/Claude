import { test, expect, type Page, type Browser } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { sql, RUN } from "./helpers";

/** Exercises the remaining buttons/forms in the portal and admin, verifying effects in the database. */
const cust = { email: `btn.cust.${RUN}@example.com`, pw: "ButtonsCust0mer!", company: `Buttons Co ${RUN}` };
const adm = { email: `btn.admin.${RUN}@example.com`, pw: "ButtonsAdm1n!!" };

async function makeUser(email: string, pw: string, company: string) {
  const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/signup`, { method: "POST", headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: pw, data: { company_name: company, full_name: "Button Tester" } }) });
  expect(r.ok).toBe(true);
  sql(`update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where email='${email}'`);
}
async function login(page: Page, email: string, pw: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(pw);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(portal|admin)/);
}
async function as(browser: Browser, who: "cust" | "adm") {
  const page = await browser.newPage();
  await login(page, who === "cust" ? cust.email : adm.email, who === "cust" ? cust.pw : adm.pw);
  return page;
}

test.describe.serial("Every remaining button and form", () => {
  let orgId = "";
  test.beforeAll(async () => {
    sql("delete from rate_limits");
    await makeUser(cust.email, cust.pw, cust.company);
    await makeUser(adm.email, adm.pw, "Kairo");
    execFileSync("node", ["scripts/grant-admin.mjs", adm.email], { env: process.env });
    orgId = sql(`select organization_id from profiles where email='${cust.email}'`);
    sql(`insert into customer_leads(organization_id,name,email,source) values('${orgId}','Lead To Update','l@example.com','website')`);
  });

  test("customer: business details, profile, lead status, automation request, deletion request", async ({ browser }) => {
    const p = await as(browser, "cust");
    await p.goto("/portal/business");
    await p.getByLabel("Website", { exact: true }).fill("https://buttons.example");
    await p.getByRole("button", { name: "Save changes" }).click();
    await expect(p.getByText("Business information saved.")).toBeVisible();
    await p.getByLabel("Full name").fill("Renamed Tester");
    await p.getByRole("button", { name: "Update profile" }).click();
    await expect(p.getByText("Profile updated.")).toBeVisible();
    await p.getByRole("button", { name: "Request data deletion" }).click();
    await expect(p.getByText(/Request received/)).toBeVisible();
    expect(sql(`select website from organizations where id='${orgId}'`)).toBe("https://buttons.example");
    expect(sql(`select full_name from profiles where email='${cust.email}'`)).toBe("Renamed Tester");
    expect(sql(`select kind from data_requests where email='${cust.email}'`)).toBe("deletion");

    await p.goto("/portal/leads");
    await p.locator("select[name=status]").first().selectOption("qualified");
    await p.getByRole("button", { name: "Save" }).first().click();
    await expect.poll(() => sql(`select status from customer_leads where organization_id='${orgId}'`)).toBe("qualified");

    await p.goto("/portal/requests");
    await p.getByLabel("Describe what you need").fill("Send review requests two days after each completed job.");
    await p.getByRole("button", { name: "Submit request" }).click();
    await expect(p.getByText(/Request submitted/)).toBeVisible();
    await p.close();
  });

  test("customer and staff support conversation, internal notes stay internal", async ({ browser }) => {
    const c = await as(browser, "cust");
    await c.goto("/portal/support/new");
    await c.getByLabel("Subject").fill("Chatbot answer wrong");
    await c.getByLabel("Priority").selectOption("high");
    await c.getByLabel("Details").fill("The bot gave the old opening hours to a customer.");
    await c.getByRole("button", { name: "Submit request" }).click();
    await c.waitForURL(/\/portal\/support\/[0-9a-f-]{36}/);
    const ticketId = c.url().split("/").pop()!;

    const a = await as(browser, "adm");
    await a.goto(`/admin/support/${ticketId}`);
    await a.getByPlaceholder("Reply to the customer…").fill("Internal: check FAQ version");
    await a.getByRole("checkbox", { name: /Internal note/ }).check();
    await a.getByRole("button", { name: "Send" }).click();
    await expect(a.getByText("Internal note added.")).toBeVisible();
    await a.getByPlaceholder("Reply to the customer…").fill("Fixed — hours updated in your approved FAQs.");
    await a.getByRole("button", { name: "Send" }).click();
    await expect(a.getByText("Reply sent.")).toBeVisible();
    await a.locator("select[name=status]").selectOption("resolved");
    await a.getByRole("button", { name: "Update" }).click();
    await expect.poll(() => sql(`select status from support_tickets where id='${ticketId}'`)).toBe("resolved");

    await c.reload();
    await expect(c.getByText("Fixed — hours updated")).toBeVisible();
    await expect(c.getByText("Internal: check FAQ version")).toHaveCount(0);
    await c.getByPlaceholder("Write a reply…").fill("Thanks!");
    await c.getByRole("button", { name: "Send reply" }).click();
    await expect(c.getByText("Reply sent.")).toBeVisible();
    await c.close(); await a.close();
  });

  test("admin: customer record — create automation, checklist status, failing live test is recorded as failed", async ({ browser }) => {
    const a = await as(browser, "adm");
    await a.goto(`/admin/customers/${orgId}`);
    await a.getByPlaceholder("Automation name").fill("Review requests");
    await a.getByRole("button", { name: "Add automation" }).click();
    await expect(a.getByText("Review requests").first()).toBeVisible();
    const autoId = sql(`select id from automations where organization_id='${orgId}' and name='Review requests'`);

    const task = a.locator("li").filter({ hasText: "Kick-off call" });
    await task.locator("select[name=status]").selectOption("done");
    await task.getByRole("button", { name: "✓" }).click();
    await expect.poll(() => sql(`select status from onboarding_tasks where organization_id='${orgId}' and key='kickoff'`)).toBe("done");

    const card = a.locator("div.rounded-xl").filter({ hasText: autoId });
    await card.getByText("Configuration").click();
    await card.getByLabel(/Test webhook URL/).fill("https://127.0.0.1:9/webhook-test/none");
    await card.getByRole("button", { name: "Save config" }).click();
    await expect(a.getByText(/Configuration saved/)).toBeVisible();
    await a.getByRole("button", { name: "Start build" }).last().click();
    await a.getByRole("button", { name: "Move to testing" }).last().click();
    await a.getByRole("button", { name: "Send live test webhook" }).last().click();
    await expect(a.getByText(/Test failed/)).toBeVisible();
    expect(sql(`select status||'/'||test_passed from automations where id='${autoId}'`)).toBe("failed/false");
    expect(sql(`select passed from automation_tests where automation_id='${autoId}' and method='live_webhook'`)).toBe("f");

    await a.goto("/admin/automations");
    const req = a.locator("tr").filter({ hasText: "review requests two days" }).filter({ hasText: cust.company });
    await req.locator("select[name=status]").selectOption("quoted");
    await req.locator("input[name=admin_notes]").fill("Quote sent by email");
    await req.getByRole("button", { name: "Save" }).click();
    await expect.poll(() => sql(`select status from automation_requests where organization_id='${orgId}'`)).toBe("quoted");
    await a.close();
  });

  test("admin: enquiry stage, activity log, sequence enrolment; quote editing and decline", async ({ browser }) => {
    const enq = sql(`insert into enquiries(type,name,email,company) values('contact','Stage Tester','stage.${RUN}@example.com','Stage Ltd') returning id`).split("\n")[0];
    const a = await as(browser, "adm");
    await a.goto(`/admin/enquiries/${enq}`);
    await a.locator("select[name=type]").selectOption("call");
    await a.getByPlaceholder("What happened?").fill("Called, interested in Growth.");
    await a.getByRole("button", { name: "Log" }).click();
    await expect(a.getByText("Called, interested in Growth.")).toBeVisible();
    expect(sql(`select stage from enquiries where id='${enq}'`)).toBe("contacted");
    await a.locator("select[name=stage]").selectOption("qualified");
    await a.getByRole("button", { name: "Update stage" }).click();
    await expect.poll(() => sql(`select stage from enquiries where id='${enq}'`)).toBe("qualified");
    await a.getByRole("button", { name: "Enrol" }).click();
    await expect.poll(() => sql(`select count(*) from sequence_enrollments where enquiry_id='${enq}'`)).toBe("1");

    await a.getByRole("button", { name: "Create" }).click();
    await a.waitForURL(/\/admin\/quotes\//);
    await a.locator("textarea[name=line_items]").fill("Growth plan | 999 | 799\nAI receptionist add-on | 500 | 350");
    await a.getByRole("button", { name: "Save proposal" }).click();
    await expect(a.getByText("Proposal saved.")).toBeVisible();
    const qid = a.url().split("/").pop();
    expect(sql(`select setup_total_pence||'/'||monthly_total_pence from quotes where id='${qid}'`)).toBe("149900/114900");
    await a.getByRole("button", { name: "Generate AI draft" }).click();
    await expect(a.getByText(/OpenAI isn't configured/)).toBeVisible();
    await a.getByRole("button", { name: "Mark declined" }).click();
    await expect.poll(() => sql(`select status from quotes where id='${qid}'`)).toBe("declined");
    await a.close();
  });

  test("admin: consultations and availability", async ({ browser }) => {
    const a = await as(browser, "adm");
    await a.goto("/admin/consultations");
    const before = Number(sql("select count(*) from availability_rules"));
    await a.locator("select[name=weekday]").selectOption("6");
    await a.locator("input[name=start]").fill("10:00");
    await a.locator("input[name=end]").fill("12:00");
    await a.getByRole("button", { name: "Add" }).click();
    await expect.poll(() => Number(sql("select count(*) from availability_rules"))).toBe(before + 1);
    await a.locator("li").filter({ hasText: "Saturday 10:00–12:00" }).getByRole("button", { name: "Remove" }).click();
    await expect.poll(() => Number(sql("select count(*) from availability_rules"))).toBe(before);
    const row = a.locator("tr").filter({ has: a.locator("select[name=status]") }).first();
    if (await row.count()) {
      await row.locator("select[name=status]").selectOption("completed");
      await row.getByRole("button", { name: "Save" }).click();
      await expect.poll(() => sql("select count(*) from consultations where status='completed'")).not.toBe("0");
    }
    await a.close();
  });

  test("admin: sequences, templates (opt-out enforced), suppression and do-not-contact", async ({ browser }) => {
    const a = await as(browser, "adm");
    await a.goto("/admin/sequences");
    const seq = a.locator(".surface-raised").filter({ hasText: "Consultation reminder & preparation" });
    const wasActive = sql("select active from email_sequences where name='Consultation reminder & preparation'");
    await seq.getByRole("button", { name: wasActive === "t" ? "Deactivate" : "Activate" }).click();
    await expect.poll(() => sql("select active from email_sequences where name='Consultation reminder & preparation'")).not.toBe(wasActive);
    await a.getByRole("button", { name: "Process due emails now" }).click();
    await expect(a.getByText(/^Processed \d+/)).toBeVisible();

    await a.goto("/admin/templates");
    const create = a.locator(".surface-raised").filter({ hasText: "New template" });
    await create.locator("input[name=industry]").fill("dental");
    await create.locator("input[name=name]").fill(`No opt-out ${RUN}`);
    await create.locator("textarea[name=body]").fill("Hi {{first_name}}, buy our product now please.");
    await create.getByRole("button", { name: "Create template" }).click();
    await expect(a.getByText(/must include a clear opt-out/)).toBeVisible();
    await create.locator("textarea[name=body]").fill("Hi {{first_name}}, a short note. Reply unsubscribe and we won't contact you again.");
    await create.getByRole("button", { name: "Create template" }).click();
    await expect(a.getByText("Template saved.")).toBeVisible();
    await a.reload();
    const t = a.locator(".surface-raised").filter({ hasText: `No opt-out ${RUN}` });
    await t.locator("summary").click();
    await t.getByRole("button", { name: "Delete template" }).click();
    await expect.poll(() => sql(`select count(*) from outreach_templates where name='No opt-out ${RUN}'`)).toBe("0");

    await a.goto("/admin/prospects");
    await a.getByPlaceholder("email, @domain or phone").fill(`@blocked-${RUN}.example`);
    await a.getByRole("button", { name: "Suppress" }).click();
    await expect(a.getByText("Added to suppression list.")).toBeVisible();
    const pid = sql(`insert into prospects(company_name,entity_type,business_email,business_phone,source) values('DNC ${RUN} Ltd','limited_company','dnc.${RUN}@example.com','01130000000','test') returning id`).split("\n")[0];
    await a.reload();
    await a.locator("tr").filter({ hasText: `DNC ${RUN} Ltd` }).getByRole("button", { name: "Do not contact" }).click();
    await expect.poll(() => sql(`select status from prospects where id='${pid}'`)).toBe("do_not_contact");
    expect(sql(`select count(*) from suppression_list where value in ('dnc.${RUN}@example.com','01130000000')`)).toBe("2");
    await a.close();
  });

  test("admin: testimonials need permission; published proof appears on the website", async ({ browser }) => {
    const a = await as(browser, "adm");
    await a.goto("/admin/content");
    const box = a.locator(".surface-raised").filter({ hasText: "Testimonials" });
    await box.getByText("+ New testimonial").click();
    await box.locator("input[name=author_name]").fill(`Real Client ${RUN}`);
    await box.locator("textarea[name=quote]").fill("They answered every call while we were on site.");
    await box.getByRole("checkbox", { name: "Publish now" }).check();
    await box.getByRole("button", { name: "Save testimonial" }).click();
    await expect(a.getByText(/Only publish testimonials the client has given permission/)).toBeVisible();
    await box.getByRole("checkbox", { name: /approved this exact wording/ }).check();
    await box.getByRole("button", { name: "Save testimonial" }).click();
    await expect(a.getByText("Testimonial saved.")).toBeVisible();
    const home = await browser.newPage();
    await home.goto("/");
    await expect(home.getByText("They answered every call while we were on site.")).toBeVisible();
    await a.reload();
    await a.locator("li").filter({ hasText: `Real Client ${RUN}` }).getByRole("button", { name: "Delete" }).click();
    await expect.poll(() => sql(`select count(*) from testimonials where author_name='Real Client ${RUN}'`)).toBe("0");
    await home.reload();
    await expect(home.getByText("They answered every call while we were on site.")).toHaveCount(0);
    await home.close(); await a.close();
  });

  test("admin: expenses, pricing, roles, data requests, notifications", async ({ browser }) => {
    const a = await as(browser, "adm");
    await a.goto("/admin/finance");
    await a.getByText("+ Add expense").click();
    const add = a.locator("details").filter({ hasText: "+ Add expense" });
    await add.locator("input[name=name]").fill(`Audit expense ${RUN}`);
    await add.locator("input[name=amount]").fill("42.50");
    await add.getByRole("button", { name: "Add expense" }).click();
    await expect(a.getByText("Expense saved.")).toBeVisible();
    expect(sql(`select amount_pence from expenses where name='Audit expense ${RUN}'`)).toBe("4250");
    await a.reload();
    const row = a.locator("tr").filter({ hasText: `Audit expense ${RUN}` });
    await row.getByText("Edit").click();
    await row.locator("input[name=amount]").fill("50");
    await row.getByRole("button", { name: "Save" }).click();
    await expect.poll(() => sql(`select amount_pence from expenses where name='Audit expense ${RUN}'`)).toBe("5000");
    await row.getByRole("button", { name: "Delete" }).click();
    await expect.poll(() => sql(`select count(*) from expenses where name='Audit expense ${RUN}'`)).toBe("0");

    await a.goto("/admin/settings");
    const starter = a.locator("form").filter({ hasText: "Starter" });
    await starter.locator("input[name=monthly]").fill("349");
    await starter.getByRole("button", { name: "Save" }).click();
    await expect(a.getByText(/Pricing updated/)).toBeVisible();
    const pricing = await browser.newPage();
    await pricing.goto("/pricing");
    await expect(pricing.getByText("£349").first()).toBeVisible();
    await starter.locator("input[name=monthly]").fill("299");
    await starter.getByRole("button", { name: "Save" }).click();
    await expect.poll(() => sql("select monthly_pence from plans where id='starter'")).toBe("29900");
    await pricing.close();

    await a.getByPlaceholder("user@company.co.uk").fill(cust.email);
    await a.locator("select[name=role]").selectOption("staff");
    await a.getByRole("button", { name: "Update role" }).click();
    await expect(a.getByText(`${cust.email} is now staff.`)).toBeVisible();
    await a.getByPlaceholder("user@company.co.uk").fill(cust.email);
    await a.locator("select[name=role]").selectOption("customer");
    await a.getByRole("button", { name: "Update role" }).click();
    await expect.poll(() => sql(`select role from profiles where email='${cust.email}'`)).toBe("customer");

    const dr = a.locator("tr").filter({ hasText: cust.email });
    await dr.locator("select[name=status]").selectOption("completed");
    await dr.getByRole("button", { name: "Save" }).click();
    await expect.poll(() => sql(`select status from data_requests where email='${cust.email}'`)).toBe("completed");

    await a.goto("/admin");
    await a.getByRole("button", { name: "Mark all read" }).click();
    await expect.poll(() => sql("select count(*) from notifications where audience='staff' and read_at is null")).toBe("0");
    await a.close();
  });
});
