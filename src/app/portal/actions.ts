"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  businessInfoSchema, knowledgeSchema, credentialSchema, ticketSchema, automationRequestSchema, fieldErrors, type ActionState,
} from "@/lib/validation";
import { encryptSecret } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { notifyStaff } from "@/lib/integrations/notify";
import { getStripe } from "@/lib/integrations/stripe";
import { SERVICE_BY_KEY } from "@/lib/content/services";
import { rateLimit } from "@/lib/rate-limit";
import { site, serverEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { z } from "zod";

async function ctx() {
  const session = await getSession();
  if (!session) throw new Error("Not signed in");
  const orgId = session.profile.organization_id;
  if (!orgId) throw new Error("No organisation linked to this account");
  return { ...session, orgId };
}

async function completeTask(orgId: string, key: string) {
  await createAdminClient()
    .from("onboarding_tasks")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .eq("key", key);
}

export async function updateBusinessInfo(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, orgId, user } = await ctx();
  const parsed = businessInfoSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const values = Object.fromEntries(Object.entries(parsed.data).map(([k, v]) => [k, v ?? null]));
  const { error } = await supabase.from("organizations").update(values).eq("id", orgId);
  if (error) return { error: "Could not save your details." };
  await completeTask(orgId, "business_info");
  await audit(user.id, "organization.updated", "organization", orgId);
  revalidatePath("/portal", "layout");
  return { ok: true, message: "Business information saved." };
}

export async function saveKnowledge(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, orgId } = await ctx();
  const parsed = knowledgeSchema.safeParse({ faq_knowledge: fd.get("faq_knowledge") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { error } = await supabase.from("organizations").update({ faq_knowledge: parsed.data.faq_knowledge }).eq("id", orgId);
  if (error) return { error: "Could not save." };
  await completeTask(orgId, "knowledge");
  revalidatePath("/portal/onboarding");
  return { ok: true, message: "Approved knowledge saved. Your assistant will only use this information." };
}

export async function selectServices(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { orgId, user } = await ctx();
  const keys = fd.getAll("services").map(String).filter((k) => SERVICE_BY_KEY[k]);
  if (!keys.length) return { error: "Choose at least one automation." };
  const notes = String(fd.get("notes") ?? "").slice(0, 2000);
  const db = createAdminClient();
  const { data: existing } = await db.from("automations").select("service_key").eq("organization_id", orgId);
  const have = new Set((existing ?? []).map((a) => a.service_key));
  const rows = keys.filter((k) => !have.has(k)).map((k) => ({
    organization_id: orgId, service_key: k, name: SERVICE_BY_KEY[k].name, description: notes || null, status: "requested",
  }));
  if (rows.length) {
    const { error } = await db.from("automations").insert(rows);
    if (error) return { error: "Could not save your selection." };
  }
  await completeTask(orgId, "select_services");
  await audit(user.id, "automations.requested", "organization", orgId, { keys });
  revalidatePath("/portal", "layout");
  return { ok: true, message: rows.length ? `${rows.length} automation(s) added to your plan.` : "Selection saved." };
}

export async function addCredential(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { orgId, user } = await ctx();
  if (!(await rateLimit(`cred:${user.id}`, 20, 3600))) return { error: "Too many submissions. Please try later." };
  const parsed = credentialSchema.safeParse({ provider: fd.get("provider"), label: fd.get("label"), secret: fd.get("secret") });
  if (!parsed.success) return { error: "Please complete all fields.", fieldErrors: fieldErrors(parsed.error) };
  if (!serverEnv("ENCRYPTION_KEY")) return { error: "Secure storage isn't configured yet. Please don't send credentials by email — contact support." };
  const secret = parsed.data.secret.trim();
  const { error } = await createAdminClient().from("integration_credentials").insert({
    organization_id: orgId, provider: parsed.data.provider, label: parsed.data.label,
    secret_ciphertext: encryptSecret(secret), hint: secret.length > 8 ? `…${secret.slice(-4)}` : "••••", created_by: user.id,
  });
  if (error) return { error: "Could not store the credential." };
  await completeTask(orgId, "integrations");
  await audit(user.id, "credential.added", "organization", orgId, { provider: parsed.data.provider });
  revalidatePath("/portal/onboarding");
  return { ok: true, message: "Stored securely. It's encrypted and can't be viewed in the browser." };
}

export async function deleteCredential(fd: FormData) {
  const { orgId, user } = await ctx();
  const id = z.string().uuid().parse(fd.get("id"));
  await createAdminClient().from("integration_credentials").delete().eq("id", id).eq("organization_id", orgId);
  await audit(user.id, "credential.deleted", "integration_credential", id);
  revalidatePath("/portal/onboarding");
}

export async function submitOnboarding(_p: ActionState): Promise<ActionState> {
  const { supabase, orgId, user } = await ctx();
  const { data: org } = await supabase.from("organizations").select("name, faq_knowledge").eq("id", orgId).single();
  const { count } = await supabase.from("automations").select("id", { count: "exact", head: true }).eq("organization_id", orgId);
  if (!count) return { error: "Choose at least one automation before submitting." };
  await supabase.from("organizations").update({ onboarding_submitted_at: new Date().toISOString() }).eq("id", orgId);
  await notifyStaff(`Onboarding submitted: ${org?.name}`, `${org?.name} has completed onboarding with ${count} automation(s). Review and schedule kick-off.`, `/admin/customers/${orgId}`);
  await audit(user.id, "onboarding.submitted", "organization", orgId);
  revalidatePath("/portal", "layout");
  return { ok: true, message: "Thanks — onboarding submitted. We'll be in touch to schedule your kick-off call." };
}

export async function updateProfile(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await ctx();
  const parsed = z.object({ full_name: z.string().trim().min(2).max(120), phone: z.string().trim().max(30).optional() }).safeParse({
    full_name: fd.get("full_name"), phone: fd.get("phone") || undefined,
  });
  if (!parsed.success) return { error: "Please enter your name." };
  const { error } = await supabase.from("profiles").update({
    full_name: parsed.data.full_name, phone: parsed.data.phone ?? null, marketing_consent: fd.get("marketing_consent") === "on",
  }).eq("id", user.id);
  if (error) return { error: "Could not update profile." };
  revalidatePath("/portal/business");
  return { ok: true, message: "Profile updated." };
}

export async function createTicket(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, orgId, user } = await ctx();
  const parsed = ticketSchema.safeParse({ subject: fd.get("subject"), body: fd.get("body"), priority: fd.get("priority") || "normal" });
  if (!parsed.success) return { error: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const { data: ticket, error } = await supabase.from("support_tickets").insert({
    organization_id: orgId, created_by: user.id, subject: parsed.data.subject, priority: parsed.data.priority,
  }).select("id").single();
  if (error || !ticket) return { error: "Could not create ticket." };
  await supabase.from("ticket_messages").insert({ ticket_id: ticket.id, author_id: user.id, body: parsed.data.body });
  await notifyStaff(`Support (${parsed.data.priority}): ${parsed.data.subject}`, parsed.data.body.slice(0, 600), `/admin/support/${ticket.id}`);
  redirect(`/portal/support/${ticket.id}`);
}

export async function replyTicket(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await ctx();
  const id = z.string().uuid().parse(fd.get("ticket_id"));
  const body = z.string().trim().min(1).max(5000).safeParse(fd.get("body"));
  if (!body.success) return { error: "Write a message first." };
  const { error } = await supabase.from("ticket_messages").insert({ ticket_id: id, author_id: user.id, body: body.data });
  if (error) return { error: "Could not send reply." };
  await notifyStaff("Customer replied to ticket", body.data.slice(0, 400), `/admin/support/${id}`);
  revalidatePath(`/portal/support/${id}`);
  return { ok: true, message: "Reply sent." };
}

export async function requestAutomation(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, orgId, user } = await ctx();
  const parsed = automationRequestSchema.safeParse({ service_key: fd.get("service_key"), description: fd.get("description") });
  if (!parsed.success) return { error: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const { error } = await supabase.from("automation_requests").insert({ organization_id: orgId, created_by: user.id, ...parsed.data });
  if (error) return { error: "Could not submit request." };
  await notifyStaff("New automation request", `${SERVICE_BY_KEY[parsed.data.service_key]?.name ?? parsed.data.service_key}: ${parsed.data.description.slice(0, 500)}`, "/admin/automations");
  revalidatePath("/portal/requests");
  return { ok: true, message: "Request submitted. We'll review it and send you a quote if needed." };
}

export async function updateLeadStatus(fd: FormData) {
  const { supabase } = await ctx();
  const id = z.string().uuid().parse(fd.get("id"));
  const status = z.enum(["new", "contacted", "qualified", "won", "lost"]).parse(fd.get("status"));
  await supabase.from("customer_leads").update({ status }).eq("id", id);
  revalidatePath("/portal/leads");
}

export async function requestDataDeletion(_p: ActionState): Promise<ActionState> {
  const { supabase, user, profile } = await ctx();
  const { error } = await supabase.from("data_requests").insert({ profile_id: user.id, email: profile.email, kind: "deletion" });
  if (error) return { error: "Could not submit request." };
  await notifyStaff("GDPR deletion request", `${profile.email} has requested deletion of their data. Respond within one month.`, "/admin/settings");
  return { ok: true, message: "Request received. We'll confirm within one month, as required by UK GDPR." };
}

/** Starts Stripe Checkout for a plan or an accepted quote. Prices come from the DB, never the browser. */
export async function startCheckout(fd: FormData) {
  const { orgId, user, profile } = await ctx();
  const stripe = getStripe();
  if (!stripe) redirect("/portal/billing?error=stripe_not_configured");
  const db = createAdminClient();
  // Prevent duplicate subscriptions: one live subscription per organisation.
  const { count: live } = await db.from("subscriptions").select("id", { count: "exact", head: true })
    .eq("organization_id", orgId).in("status", ["active", "trialing", "past_due"]);
  if (live) redirect("/portal/billing?error=already_subscribed");
  const planId = String(fd.get("plan") ?? "");
  const quoteId = String(fd.get("quote") ?? "");

  let name: string, setup: number, monthly: number, plan: string, quoteRef: string | null = null;
  if (quoteId) {
    const { data: q } = await db.from("quotes").select("*").eq("id", quoteId).eq("status", "accepted").single();
    if (!q || (q.organization_id && q.organization_id !== orgId) || q.recipient_email.toLowerCase() !== profile.email.toLowerCase()) {
      redirect("/portal/billing?error=quote");
    }
    if (q.monthly_total_pence <= 0) redirect("/portal/billing?error=quote");
    name = `${q.title} (${q.number})`; setup = q.setup_total_pence; monthly = q.monthly_total_pence; plan = q.plan_id ?? "enterprise"; quoteRef = q.id;
    await db.from("quotes").update({ organization_id: orgId }).eq("id", q.id);
  } else {
    const { data: p } = await db.from("plans").select("*").eq("id", planId).eq("is_public", true).single();
    if (!p || p.monthly_pence <= 0) redirect("/portal/billing?error=plan");
    name = `Kairo ${p.name}`; setup = p.setup_fee_pence; monthly = p.monthly_pence; plan = p.id;
  }

  const { data: org } = await db.from("organizations").select("name, stripe_customer_id").eq("id", orgId).single();
  let customer = org?.stripe_customer_id ?? undefined;
  if (!customer) {
    const c = await stripe.customers.create({ email: profile.email, name: org?.name, metadata: { organization_id: orgId } });
    customer = c.id;
    await db.from("organizations").update({ stripe_customer_id: customer }).eq("id", orgId);
  }

  const line_items: import("stripe").Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { quantity: 1, price_data: { currency: "gbp", unit_amount: monthly, recurring: { interval: "month" }, product_data: { name: `${name} — monthly` } } },
  ];
  if (setup > 0) line_items.push({ quantity: 1, price_data: { currency: "gbp", unit_amount: setup, product_data: { name: `${name} — one-off setup` } } });

  let url: string | null = null;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      line_items,
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      customer_update: { address: "auto", name: "auto" },
      allow_promotion_codes: true,
      client_reference_id: orgId,
      metadata: { organization_id: orgId, plan_id: plan, quote_id: quoteRef ?? "", setup_pence: String(setup), monthly_pence: String(monthly) },
      subscription_data: { metadata: { organization_id: orgId, plan_id: plan, quote_id: quoteRef ?? "" } },
      success_url: `${site.url}/portal/billing?checkout=success`,
      cancel_url: `${site.url}/portal/billing?checkout=cancelled`,
    });
    url = session.url;
    await audit(user.id, "checkout.started", "organization", orgId, { plan, setup, monthly });
  } catch (err) {
    logger.error("checkout_failed", { err });
    redirect("/portal/billing?error=checkout");
  }
  redirect(url!);
}

export async function openBillingPortal() {
  const { orgId } = await ctx();
  const stripe = getStripe();
  if (!stripe) redirect("/portal/billing?error=stripe_not_configured");
  const { data: org } = await createAdminClient().from("organizations").select("stripe_customer_id").eq("id", orgId).single();
  if (!org?.stripe_customer_id) redirect("/portal/billing?error=no_customer");
  let url: string;
  try {
    const s = await stripe.billingPortal.sessions.create({ customer: org.stripe_customer_id, return_url: `${site.url}/portal/billing` });
    url = s.url;
  } catch (err) {
    logger.error("billing_portal_failed", { err });
    redirect("/portal/billing?error=portal");
  }
  redirect(url);
}
