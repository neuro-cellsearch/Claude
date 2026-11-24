"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, registerSchema, email as emailSchema, fieldErrors, type ActionState } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { hashIp } from "@/lib/crypto";
import { hasSupabase, site } from "@/lib/env";
import { logger } from "@/lib/logger";
import { audit } from "@/lib/audit";
import { z } from "zod";
import { safeRedirectPath } from "@/lib/redirect";

function safeNext(next: FormDataEntryValue | null, fallback: string) {
  return safeRedirectPath(next, fallback);
}

async function limited(kind: string, max: number, windowSec: number) {
  const ip = hashIp(await clientIp()) ?? "unknown";
  return !(await rateLimit(`${kind}:${ip}`, max, windowSec));
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!hasSupabase()) return { error: "Authentication is not configured yet." };
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter your email and password.", fieldErrors: fieldErrors(parsed.error) };
  if (await limited("login", 10, 900)) return { error: "Too many sign-in attempts. Please wait 15 minutes and try again." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    logger.warn("login_failed", { reason: error?.code });
    return { error: error?.code === "email_not_confirmed" ? "Please confirm your email address first — check your inbox." : "Incorrect email or password." };
  }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
  const fallback = profile?.role === "admin" || profile?.role === "staff" ? "/admin" : "/portal";
  redirect(safeNext(formData.get("next"), fallback));
}

export async function register(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!hasSupabase()) return { error: "Registration is not configured yet." };
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    companyName: formData.get("companyName"),
    industry: formData.get("industry") || undefined,
    email: formData.get("email"),
    password: formData.get("password"),
    marketingConsent: formData.get("marketingConsent") === "on",
    termsAccepted: formData.get("termsAccepted") === "on",
  });
  if (!parsed.success) return { error: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  if (await limited("register", 5, 3600)) return { error: "Too many registrations from your connection. Please try later." };

  const d = parsed.data;
  const plan = typeof formData.get("plan") === "string" ? String(formData.get("plan")) : "";
  const next = plan ? `/portal/billing?plan=${encodeURIComponent(plan)}` : "/portal/onboarding";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: d.email,
    password: d.password,
    options: {
      emailRedirectTo: `${site.url}/auth/callback?next=${encodeURIComponent(next)}`,
      data: { full_name: d.fullName, company_name: d.companyName, industry: d.industry ?? "", marketing_consent: d.marketingConsent },
    },
  });
  if (error) {
    logger.warn("register_failed", { code: error.code });
    if (error.code === "user_already_exists") return { error: "An account with this email already exists. Try signing in." };
    if (error.code === "weak_password") return { error: "Please choose a stronger password." };
    return { error: "We couldn't create your account. Please try again." };
  }
  await audit(data.user?.id ?? null, "account.registered", "profile", data.user?.id);
  if (data.session) redirect(next);
  return { ok: true, message: "Check your inbox to confirm your email address, then sign in." };
}

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!hasSupabase()) return { error: "Authentication is not configured yet." };
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address." };
  if (await limited("reset", 5, 3600)) return { error: "Too many requests. Please try later." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo: `${site.url}/auth/callback?next=/reset-password` });
  // Same response whether or not the account exists (prevents account enumeration).
  return { ok: true, message: "If an account exists for that email, a reset link is on its way." };
}

export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ password: registerSchema.shape.password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] })
    .safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your reset link has expired. Please request a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Could not update your password. Please request a new link." };
  await audit(user.id, "account.password_changed", "profile", user.id);
  return { ok: true, message: "Password updated. You can now continue to your portal." };
}
