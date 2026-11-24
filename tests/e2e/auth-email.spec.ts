import { test, expect, type Page } from "@playwright/test";
import { sql, RUN } from "./helpers";

/**
 * Real email-based auth flows (confirmation, password reset, staff invite).
 * Requires the local stack started with docker-compose.email.yml (Mailpit),
 * and MAILPIT_URL set, e.g. MAILPIT_URL=http://localhost:54329
 */
const MAILPIT = process.env.MAILPIT_URL;
test.skip(!MAILPIT, "MAILPIT_URL not set — start the stack with docker-compose.email.yml");

async function latestLink(to: string, subject: RegExp): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json();
    const msg = (list.messages ?? []).find((m: { Subject: string }) => subject.test(m.Subject));
    if (msg) {
      const full = await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json();
      const link = (full.Text as string).match(/https?:\/\/\S+verify\?\S+/)?.[0];
      if (link) return link.replace(/[)\]>]+$/, "");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No "${subject}" email for ${to}`);
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe.serial("Email-based authentication flows", () => {
  const email = `confirm.${RUN}@example.com`;
  const pw1 = "FirstPassw0rd!", pw2 = "SecondPassw0rd!";

  test.beforeAll(() => { sql("delete from rate_limits"); });

  test("registration requires email confirmation, and the link signs the user in", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Your name").fill("Confirm Tester");
    await page.getByLabel("Company").fill(`Confirm Co ${RUN}`);
    await page.getByLabel("Work email").fill(email);
    await page.getByLabel(/^Password/).fill(pw1);
    await page.getByRole("checkbox", { name: /accept the terms/ }).check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText(/Check your inbox to confirm/)).toBeVisible();

    await login(page, email, pw1);
    await expect(page.getByText(/Please confirm your email address first/)).toBeVisible();

    await page.goto(await latestLink(email, /Confirm/i));
    await page.waitForURL(/\/portal\/onboarding/);
    await expect(page.getByRole("heading", { name: "Onboarding" })).toBeVisible();
  });

  test("sign out ends the session", async ({ page }) => {
    await login(page, email, pw1);
    await page.waitForURL(/\/portal/);
    await page.getByRole("button", { name: "Sign out" }).first().click();
    await page.waitForURL(/\/login/);
    await page.goto("/portal");
    await page.waitForURL(/\/login\?next=%2Fportal/);
  });

  test("password reset via emailed link", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/If an account exists/)).toBeVisible();
    await page.goto(await latestLink(email, /Reset/i));
    await page.waitForURL(/\/reset-password/);
    await page.getByLabel("New password").fill(pw2);
    await page.getByLabel("Confirm password").fill(pw2);
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByText("Password updated.")).toBeVisible();

    await page.context().clearCookies();
    await login(page, email, pw1);
    await expect(page.getByText("Incorrect email or password.")).toBeVisible();
    await login(page, email, pw2);
    await page.waitForURL(/\/portal/);
  });

  test("reset request for an unknown email gives the same response (no account enumeration)", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(`nobody.${RUN}@example.com`);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/If an account exists/)).toBeVisible();
  });

  test("admin invites an enquirer; invite link lets them set a password and reach the portal", async ({ page, browser }) => {
    const admin = `inviter.${RUN}@example.com`, invitee = `invitee.${RUN}@example.com`;
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/signup`, { method: "POST", headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, "Content-Type": "application/json" }, body: JSON.stringify({ email: admin, password: pw1 }) });
    expect(r.ok).toBe(true);
    sql(`update auth.users set email_confirmed_at = now() where email='${admin}'`);
    sql(`update profiles set role='admin' where email='${admin}'`);
    const enquiryId = sql(`insert into enquiries(type,name,email,company) values('quote','Invited Person','${invitee}','Invitee Ltd') returning id`).split("\n")[0];

    await login(page, admin, pw1);
    await page.waitForURL(/\/admin/);
    await page.goto(`/admin/enquiries/${enquiryId}`);
    await page.getByRole("button", { name: "Invite to client portal" }).click();
    await expect(page.getByRole("link", { name: /Open customer record/ })).toBeVisible();

    const client = await browser.newPage();
    await client.goto(await latestLink(invitee, /invited/i));
    await client.waitForURL(/\/reset-password/);
    await client.getByLabel("New password").fill(pw2);
    await client.getByLabel("Confirm password").fill(pw2);
    await client.getByRole("button", { name: "Update password" }).click();
    await expect(client.getByText("Password updated.")).toBeVisible();
    await client.goto("/portal");
    await expect(client.getByText(/Invitee Ltd/).first()).toBeVisible();
    await client.close();
  });
});
