/**
 * Centralised environment access. Server-only secrets are read lazily so the
 * app can build and render public pages before every integration is set up.
 */
export const site = {
  url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  name: "Kairo Systems",
  legalName: process.env.NEXT_PUBLIC_COMPANY_LEGAL_NAME || "Kairo Systems Ltd",
  companyNumber: process.env.NEXT_PUBLIC_COMPANY_NUMBER || "",
  address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hello@example.com",
  phone: process.env.NEXT_PUBLIC_CONTACT_PHONE || "",
  icoRegistration: process.env.NEXT_PUBLIC_ICO_REGISTRATION || "",
  calendlyUrl: process.env.NEXT_PUBLIC_CALENDLY_URL || "",
};

export function hasSupabase(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function hasServiceRole(): boolean {
  return hasSupabase() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function serverEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export function requireServerEnv(name: string): string {
  const v = serverEnv(name);
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}
