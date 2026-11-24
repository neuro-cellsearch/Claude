/** Validates configuration at startup and on the admin Integrations page. Pure — unit tested. */
export type EnvIssue = { level: "error" | "warn"; variable: string; message: string };

export function checkEnv(env: Record<string, string | undefined> = process.env, production = env.NODE_ENV === "production"): EnvIssue[] {
  const issues: EnvIssue[] = [];
  const v = (k: string) => (env[k] ?? "").trim();
  const need = (k: string, why: string) => { if (!v(k)) issues.push({ level: "error", variable: k, message: `Missing — ${why}` }); };

  need("NEXT_PUBLIC_SUPABASE_URL", "database and authentication will not work");
  need("NEXT_PUBLIC_SUPABASE_ANON_KEY", "database and authentication will not work");
  need("SUPABASE_SERVICE_ROLE_KEY", "admin area, forms and webhooks will not work");
  need("ENCRYPTION_KEY", "clients cannot store integration credentials; unsubscribe links are weaker");
  need("AUTOMATION_WEBHOOK_SECRET", "automations cannot report activity");
  need("CRON_SECRET", "follow-up emails and proposal expiry will not run");
  need("IP_HASH_SALT", "IP hashes use a default salt");

  if (v("ENCRYPTION_KEY") && Buffer.from(v("ENCRYPTION_KEY"), "base64").length !== 32) {
    issues.push({ level: "error", variable: "ENCRYPTION_KEY", message: "Must be exactly 32 bytes, base64-encoded" });
  }
  for (const k of ["AUTOMATION_WEBHOOK_SECRET", "CRON_SECRET"]) {
    if (v(k) && v(k).length < 24) issues.push({ level: "error", variable: k, message: "Too short — use at least 24 random characters" });
  }
  const site = v("NEXT_PUBLIC_SITE_URL");
  if (!site) issues.push({ level: production ? "error" : "warn", variable: "NEXT_PUBLIC_SITE_URL", message: "Missing — email links and Stripe redirects will point to localhost" });
  else if (production && !site.startsWith("https://")) issues.push({ level: "error", variable: "NEXT_PUBLIC_SITE_URL", message: "Must use https:// in production" });
  if (production && v("NEXT_PUBLIC_SUPABASE_URL").startsWith("http://")) issues.push({ level: "error", variable: "NEXT_PUBLIC_SUPABASE_URL", message: "Must use https:// in production" });

  if (v("STRIPE_SECRET_KEY") && !v("STRIPE_WEBHOOK_SECRET")) issues.push({ level: "error", variable: "STRIPE_WEBHOOK_SECRET", message: "Stripe key set without webhook secret — payments would be taken but never recorded" });
  if (v("STRIPE_SECRET_KEY") && !/^(sk|rk)_(test|live)_/.test(v("STRIPE_SECRET_KEY"))) issues.push({ level: "error", variable: "STRIPE_SECRET_KEY", message: "Doesn't look like a Stripe secret key" });
  if (production && v("STRIPE_SECRET_KEY").startsWith("sk_test_")) issues.push({ level: "warn", variable: "STRIPE_SECRET_KEY", message: "Test-mode key in production — no real payments will be taken" });
  if (v("RESEND_API_KEY") && !v("EMAIL_FROM")) issues.push({ level: "error", variable: "EMAIL_FROM", message: "Resend key set without a sender address" });
  if (v("N8N_BASE_URL") && !v("N8N_API_KEY")) issues.push({ level: "warn", variable: "N8N_API_KEY", message: "n8n URL set without API key — activation must be done manually" });
  if (v("TWILIO_ACCOUNT_SID") && !v("TWILIO_AUTH_TOKEN")) issues.push({ level: "error", variable: "TWILIO_AUTH_TOKEN", message: "Twilio SID set without auth token" });
  if (production && !v("NEXT_PUBLIC_COMPANY_ADDRESS")) issues.push({ level: "warn", variable: "NEXT_PUBLIC_COMPANY_ADDRESS", message: "UK law requires your company address on the website and in marketing emails" });
  if (production && !v("NEXT_PUBLIC_COMPANY_NUMBER")) issues.push({ level: "warn", variable: "NEXT_PUBLIC_COMPANY_NUMBER", message: "Companies Act requires your company number on the website" });
  return issues;
}
