import "server-only";
import { createSign } from "node:crypto";
import { serverEnv, hasSupabase, hasServiceRole } from "@/lib/env";
import { httpJson } from "./http";
import { getStripe } from "./stripe";

export type IntegrationCategory = "core" | "payments" | "ai" | "messaging" | "automation" | "crm" | "calendar" | "voice";

export type Integration = {
  id: string;
  name: string;
  category: IntegrationCategory;
  purpose: string;
  envVars: string[];
  optionalEnvVars?: string[];
  docsUrl: string;
  setup: string[];
  costNote: string;
  /** Makes a REAL authenticated API call. Returns a human-readable outcome. */
  test: () => Promise<{ ok: boolean; detail: string }>;
};

const configured = (vars: string[]) => vars.every((v) => Boolean(serverEnv(v)));

export const INTEGRATIONS: Integration[] = [
  {
    id: "supabase",
    name: "Supabase",
    category: "core",
    purpose: "Database, authentication and row-level security for every customer and admin feature.",
    envVars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
    docsUrl: "https://supabase.com/docs/guides/getting-started",
    setup: [
      "Create a project at supabase.com (choose the London region, eu-west-2).",
      "Copy the Project URL, anon key and service_role key from Project Settings → API.",
      "Run `npm run db:migrate` with DATABASE_URL set to the project's direct connection string.",
      "Under Authentication → URL Configuration set the Site URL to your domain and add /auth/callback to redirect URLs.",
      "Configure custom SMTP (e.g. Resend) under Authentication → Emails so confirmation emails come from your domain.",
    ],
    costNote: "Free tier for development; Pro (~$25/month) recommended for production backups and no pausing.",
    test: async () => {
      if (!hasServiceRole()) return { ok: false, detail: "Not configured" };
      const res = await httpJson(`${serverEnv("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1/plans?select=id&limit=1`, {
        headers: { apikey: serverEnv("SUPABASE_SERVICE_ROLE_KEY")!, Authorization: `Bearer ${serverEnv("SUPABASE_SERVICE_ROLE_KEY")}` },
      });
      return res.ok ? { ok: true, detail: "Database reachable and migrations applied (plans table readable)." } : { ok: false, detail: `HTTP ${res.status}: ${res.text.slice(0, 200)}` };
    },
  },
  {
    id: "stripe",
    name: "Stripe",
    category: "payments",
    purpose: "Setup fees, monthly subscriptions, invoices, and the customer billing portal.",
    envVars: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    optionalEnvVars: ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"],
    docsUrl: "https://docs.stripe.com/billing/subscriptions/build-subscriptions",
    setup: [
      "Create a Stripe account and complete business verification (required before live payments).",
      "Copy the secret key from Developers → API keys (use test mode first: sk_test_…).",
      "Add a webhook endpoint at https://YOUR-DOMAIN/api/stripe/webhook listening to: checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted.",
      "Copy the webhook signing secret (whsec_…) into STRIPE_WEBHOOK_SECRET.",
      "Activate the Customer Portal under Settings → Billing → Customer portal.",
    ],
    costNote: "No monthly fee. UK cards ~1.5% + 20p; Billing adds ~0.7% of recurring volume.",
    test: async () => {
      const stripe = getStripe();
      if (!stripe) return { ok: false, detail: "Not configured" };
      try {
        const bal = await stripe.balance.retrieve();
        const mode = serverEnv("STRIPE_SECRET_KEY")!.startsWith("sk_live") ? "LIVE" : "TEST";
        const webhook = serverEnv("STRIPE_WEBHOOK_SECRET") ? "webhook secret set" : "WARNING: STRIPE_WEBHOOK_SECRET missing — payments will not be recorded";
        return { ok: Boolean(serverEnv("STRIPE_WEBHOOK_SECRET")), detail: `${mode} mode key valid (${bal.available.length} balance currencies); ${webhook}.` };
      } catch (e) {
        return { ok: false, detail: (e as Error).message };
      }
    },
  },
  {
    id: "openai",
    name: "OpenAI",
    category: "ai",
    purpose: "Powers the website assistant, AI proposal drafting and client chatbot workflows.",
    envVars: ["OPENAI_API_KEY"],
    optionalEnvVars: ["OPENAI_MODEL"],
    docsUrl: "https://platform.openai.com/docs/quickstart",
    setup: [
      "Create an API key at platform.openai.com → API keys (use a project-scoped key).",
      "Set a monthly usage limit under Settings → Limits to cap spend.",
      "Optionally set OPENAI_MODEL to a model available on your account.",
    ],
    costNote: "Pay-per-token. Small 'mini' models typically cost pennies per conversation; set hard limits.",
    test: async () => {
      if (!configured(["OPENAI_API_KEY"])) return { ok: false, detail: "Not configured" };
      const res = await httpJson<{ data: { id: string }[] }>("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${serverEnv("OPENAI_API_KEY")}` },
      });
      if (!res.ok) return { ok: false, detail: `HTTP ${res.status}: ${res.text.slice(0, 200)}` };
      const model = serverEnv("OPENAI_MODEL") || "gpt-5-mini";
      const has = res.data?.data?.some((m) => m.id === model);
      return { ok: Boolean(has), detail: has ? `Key valid; model "${model}" available.` : `Key valid but model "${model}" not found on this account — set OPENAI_MODEL.` };
    },
  },
  {
    id: "resend",
    name: "Resend (email)",
    category: "messaging",
    purpose: "Enquiry notifications, follow-up sequences, proposals and approved outreach emails.",
    envVars: ["RESEND_API_KEY", "EMAIL_FROM"],
    optionalEnvVars: ["ADMIN_NOTIFICATION_EMAIL"],
    docsUrl: "https://resend.com/docs/send-with-nodejs",
    setup: [
      "Create a Resend account and add your sending domain; publish the SPF, DKIM and DMARC DNS records it shows.",
      "Create an API key with sending access.",
      "Set EMAIL_FROM to an address on the verified domain, e.g. \"Kairo Systems <hello@yourdomain.co.uk>\".",
      "Use a separate subdomain (e.g. outreach.yourdomain.co.uk) for cold outreach to protect your main domain's reputation.",
    ],
    costNote: "Free up to 3,000 emails/month; paid plans from ~$20/month.",
    test: async () => {
      if (!configured(["RESEND_API_KEY", "EMAIL_FROM"])) return { ok: false, detail: "Not configured" };
      const res = await httpJson<{ data: { name: string; status: string }[] }>("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${serverEnv("RESEND_API_KEY")}` },
      });
      if (res.status === 401 && /restricted/i.test(res.text)) return { ok: true, detail: "Key valid (sending-only key; domain list not readable)." };
      if (!res.ok) return { ok: false, detail: `HTTP ${res.status}: ${res.text.slice(0, 200)}` };
      const fromDomain = serverEnv("EMAIL_FROM")!.match(/@([^>\s]+)/)?.[1];
      const d = res.data?.data?.find((x) => x.name === fromDomain);
      return d?.status === "verified"
        ? { ok: true, detail: `Key valid; ${fromDomain} verified.` }
        : { ok: false, detail: `Key valid but sending domain ${fromDomain ?? "(unknown)"} is ${d?.status ?? "not added"}.` };
    },
  },
  {
    id: "n8n",
    name: "n8n",
    category: "automation",
    purpose: "Runs client automation workflows. Recommended engine: self-hosted for low, predictable cost.",
    envVars: ["N8N_BASE_URL", "N8N_API_KEY", "AUTOMATION_WEBHOOK_SECRET"],
    docsUrl: "https://docs.n8n.io/api/",
    setup: [
      "Deploy n8n (self-hosted on a small VPS with Docker, or n8n Cloud). Use HTTPS.",
      "Set NODE_FUNCTION_ALLOW_BUILTIN=crypto on n8n so Code nodes can sign callbacks.",
      "Create an API key in n8n → Settings → n8n API and set N8N_BASE_URL and N8N_API_KEY.",
      "Import the templates in automation-templates/n8n and set the KAIRO_WEBHOOK_SECRET variable to AUTOMATION_WEBHOOK_SECRET.",
      "Workflows report activity to https://YOUR-DOMAIN/api/automations/events (HMAC-signed).",
    ],
    costNote: "Self-hosted: VPS ~£5–15/month, unlimited executions. n8n Cloud from ~€24/month.",
    test: async () => {
      if (!configured(["N8N_BASE_URL", "N8N_API_KEY"])) return { ok: false, detail: "Not configured" };
      const res = await httpJson<{ data: unknown[] }>(`${serverEnv("N8N_BASE_URL")!.replace(/\/$/, "")}/api/v1/workflows?limit=1`, {
        headers: { "X-N8N-API-KEY": serverEnv("N8N_API_KEY")! },
      });
      return res.ok ? { ok: true, detail: "n8n API reachable and key valid." } : { ok: false, detail: `HTTP ${res.status}: ${res.text.slice(0, 200)}` };
    },
  },
  {
    id: "make",
    name: "Make",
    category: "automation",
    purpose: "Optional alternative engine for clients already on Make. Uses the same signed event webhook.",
    envVars: ["MAKE_API_TOKEN"],
    optionalEnvVars: ["MAKE_ZONE"],
    docsUrl: "https://developers.make.com/api-documentation",
    setup: ["Create an API token in Make → Profile → API.", "Set MAKE_ZONE to your account's zone (e.g. eu1.make.com)."],
    costNote: "Operation-based pricing; can become expensive at high volume compared with self-hosted n8n.",
    test: async () => {
      if (!configured(["MAKE_API_TOKEN"])) return { ok: false, detail: "Not configured" };
      const res = await httpJson(`https://${serverEnv("MAKE_ZONE") || "eu1.make.com"}/api/v2/users/me`, {
        headers: { Authorization: `Token ${serverEnv("MAKE_API_TOKEN")}` },
      });
      return res.ok ? { ok: true, detail: "Make API token valid." } : { ok: false, detail: `HTTP ${res.status}: ${res.text.slice(0, 200)}` };
    },
  },
  {
    id: "twilio",
    name: "Twilio",
    category: "voice",
    purpose: "UK phone numbers, SMS confirmations/reminders, missed-call text-back and voice routing for the AI receptionist.",
    envVars: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
    optionalEnvVars: ["TWILIO_FROM_NUMBER"],
    docsUrl: "https://www.twilio.com/docs/usage/api",
    setup: [
      "Create a Twilio account and upgrade from trial.",
      "Complete the UK regulatory bundle (proof of address) required to buy UK numbers.",
      "Copy the Account SID and Auth Token from the console.",
    ],
    costNote: "UK local numbers ~£1/month; SMS and voice minutes billed per use.",
    test: async () => {
      if (!configured(["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"])) return { ok: false, detail: "Not configured" };
      const sid = serverEnv("TWILIO_ACCOUNT_SID")!;
      const auth = Buffer.from(`${sid}:${serverEnv("TWILIO_AUTH_TOKEN")}`).toString("base64");
      const res = await httpJson<{ status: string; friendly_name: string }>(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      return res.ok ? { ok: true, detail: `Account "${res.data?.friendly_name}" status: ${res.data?.status}.` } : { ok: false, detail: `HTTP ${res.status}` };
    },
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    category: "voice",
    purpose: "Optional premium voice synthesis for AI receptionist deployments.",
    envVars: ["ELEVENLABS_API_KEY"],
    docsUrl: "https://elevenlabs.io/docs/api-reference/introduction",
    setup: ["Create an API key in ElevenLabs → Profile → API keys.", "Only use voices you have rights to use commercially."],
    costNote: "Character-based plans; often bundled via voice-AI platforms instead.",
    test: async () => {
      if (!configured(["ELEVENLABS_API_KEY"])) return { ok: false, detail: "Not configured" };
      const res = await httpJson<{ subscription?: { tier: string } }>("https://api.elevenlabs.io/v1/user", {
        headers: { "xi-api-key": serverEnv("ELEVENLABS_API_KEY")! },
      });
      return res.ok ? { ok: true, detail: `Key valid (tier: ${res.data?.subscription?.tier ?? "unknown"}).` } : { ok: false, detail: `HTTP ${res.status}` };
    },
  },
  {
    id: "hubspot",
    name: "HubSpot",
    category: "crm",
    purpose: "CRM integration for client workflows (contacts, deals, tasks).",
    envVars: ["HUBSPOT_PRIVATE_APP_TOKEN"],
    docsUrl: "https://developers.hubspot.com/docs/api/private-apps",
    setup: [
      "In HubSpot: Settings → Integrations → Private Apps → Create.",
      "Grant scopes: crm.objects.contacts.read/write, crm.objects.deals.read/write.",
      "For client portals, prefer each client creating their own private app and sharing the token through onboarding.",
    ],
    costNote: "Free CRM tier available; workflow features need paid tiers.",
    test: async () => {
      if (!configured(["HUBSPOT_PRIVATE_APP_TOKEN"])) return { ok: false, detail: "Not configured" };
      const res = await httpJson<{ portalId: number }>("https://api.hubapi.com/account-info/v3/details", {
        headers: { Authorization: `Bearer ${serverEnv("HUBSPOT_PRIVATE_APP_TOKEN")}` },
      });
      return res.ok ? { ok: true, detail: `Connected to HubSpot portal ${res.data?.portalId}.` } : { ok: false, detail: `HTTP ${res.status}` };
    },
  },
  {
    id: "calendly",
    name: "Calendly",
    category: "calendar",
    purpose: "Optional: embed Calendly on the booking page instead of the built-in consultation calendar.",
    envVars: ["CALENDLY_API_TOKEN"],
    optionalEnvVars: ["NEXT_PUBLIC_CALENDLY_URL"],
    docsUrl: "https://developer.calendly.com/",
    setup: ["Create a personal access token in Calendly → Integrations → API & Webhooks.", "Set NEXT_PUBLIC_CALENDLY_URL to your scheduling link to show it on /book."],
    costNote: "Free tier available; API features on paid plans.",
    test: async () => {
      if (!configured(["CALENDLY_API_TOKEN"])) return { ok: false, detail: "Not configured" };
      const res = await httpJson<{ resource: { name: string } }>("https://api.calendly.com/users/me", {
        headers: { Authorization: `Bearer ${serverEnv("CALENDLY_API_TOKEN")}` },
      });
      return res.ok ? { ok: true, detail: `Connected as ${res.data?.resource?.name}.` } : { ok: false, detail: `HTTP ${res.status}` };
    },
  },
  {
    id: "google_calendar",
    name: "Google Calendar",
    category: "calendar",
    purpose: "Calendar access for appointment automations via a Google service account.",
    envVars: ["GOOGLE_SERVICE_ACCOUNT_JSON_BASE64", "GOOGLE_CALENDAR_ID"],
    docsUrl: "https://developers.google.com/calendar/api/guides/overview",
    setup: [
      "In Google Cloud, create a project, enable the Calendar API and create a service account with a JSON key.",
      "Base64-encode the JSON key into GOOGLE_SERVICE_ACCOUNT_JSON_BASE64.",
      "Share the target calendar with the service account email ('Make changes to events').",
    ],
    costNote: "Free within Google API quotas.",
    test: async () => {
      if (!configured(["GOOGLE_SERVICE_ACCOUNT_JSON_BASE64", "GOOGLE_CALENDAR_ID"])) return { ok: false, detail: "Not configured" };
      try {
        const sa = JSON.parse(Buffer.from(serverEnv("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64")!, "base64").toString("utf8"));
        const now = Math.floor(Date.now() / 1000);
        const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
        const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
          iss: sa.client_email, scope: "https://www.googleapis.com/auth/calendar.readonly",
          aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 300,
        })}`;
        const sig = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");
        const tok = await httpJson<{ access_token: string }>("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
        });
        if (!tok.ok) return { ok: false, detail: `Token exchange failed: HTTP ${tok.status}` };
        const cal = await httpJson<{ summary: string }>(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(serverEnv("GOOGLE_CALENDAR_ID")!)}`,
          { headers: { Authorization: `Bearer ${tok.data?.access_token}` } },
        );
        return cal.ok ? { ok: true, detail: `Calendar "${cal.data?.summary}" accessible.` } : { ok: false, detail: `Calendar not accessible: HTTP ${cal.status}` };
      } catch (e) {
        return { ok: false, detail: `Invalid service account JSON: ${(e as Error).message}` };
      }
    },
  },
];

export function integrationStatus(i: Integration): "configured" | "partial" | "missing" {
  if (i.id === "supabase") return hasServiceRole() ? "configured" : hasSupabase() ? "partial" : "missing";
  const set = i.envVars.filter((v) => Boolean(serverEnv(v))).length;
  if (set === i.envVars.length) return "configured";
  return set > 0 ? "partial" : "missing";
}
