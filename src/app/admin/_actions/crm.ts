"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/integrations/email";
import { chatComplete, openaiConfigured } from "@/lib/integrations/openai";
import { site } from "@/lib/env";
import { firstName, gbp } from "@/lib/format";
import { draftProposalCopy } from "@/lib/sales/proposals";
import type { ActionState } from "@/lib/validation";
import { logger } from "@/lib/logger";

const uuid = z.string().uuid();
const STAGES = ["new", "contacted", "qualified", "proposal_sent", "won", "lost"] as const;

export async function updateEnquiryStage(fd: FormData) {
  const { user } = await assertStaff();
  const id = uuid.parse(fd.get("id"));
  const stage = z.enum(STAGES).parse(fd.get("stage"));
  const lost = String(fd.get("lost_reason") ?? "").slice(0, 500) || null;
  const db = createAdminClient();
  await db.from("enquiries").update({ stage, lost_reason: stage === "lost" ? lost : null }).eq("id", id);
  await db.from("crm_activities").insert({ enquiry_id: id, type: "stage_change", body: `Stage → ${stage}${lost ? ` (${lost})` : ""}`, created_by: user.id });
  if (!["new", "contacted"].includes(stage)) await db.from("sequence_enrollments").update({ status: "stopped" }).eq("enquiry_id", id).eq("status", "active");
  revalidatePath("/admin/enquiries");
  revalidatePath(`/admin/enquiries/${id}`);
}

export async function addActivity(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await assertStaff();
  const id = uuid.parse(fd.get("enquiry_id"));
  const parsed = z.object({ type: z.enum(["note", "call", "email", "meeting"]), body: z.string().trim().min(2).max(5000) }).safeParse({ type: fd.get("type"), body: fd.get("body") });
  if (!parsed.success) return { error: "Write a note first." };
  const db = createAdminClient();
  await db.from("crm_activities").insert({ enquiry_id: id, ...parsed.data, created_by: user.id });
  const follow = String(fd.get("next_follow_up_at") ?? "");
  if (follow) await db.from("enquiries").update({ next_follow_up_at: new Date(follow).toISOString() }).eq("id", id);
  if (parsed.data.type !== "note") await db.from("enquiries").update({ stage: "contacted" }).eq("id", id).eq("stage", "new");
  revalidatePath(`/admin/enquiries/${id}`);
  return { ok: true, message: "Logged." };
}

export async function enrolInSequence(fd: FormData) {
  await assertStaff();
  const enquiry = uuid.parse(fd.get("enquiry_id"));
  const seq = uuid.parse(fd.get("sequence_id"));
  await createAdminClient().from("sequence_enrollments").upsert(
    { sequence_id: seq, enquiry_id: enquiry, status: "active", current_step: 1, next_send_at: new Date().toISOString() },
    { onConflict: "sequence_id,enquiry_id" },
  );
  revalidatePath(`/admin/enquiries/${enquiry}`);
}

export async function inviteCustomer(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await assertStaff();
  const id = uuid.parse(fd.get("enquiry_id"));
  const db = createAdminClient();
  const { data: e } = await db.from("enquiries").select("*").eq("id", id).single();
  if (!e) return { error: "Enquiry not found." };
  const { data: existing } = await db.from("profiles").select("id, organization_id").eq("email", e.email.toLowerCase()).maybeSingle();
  if (existing) {
    await db.from("enquiries").update({ organization_id: existing.organization_id }).eq("id", id);
    revalidatePath(`/admin/enquiries/${id}`);
    return { ok: true, message: "This person already has an account — linked to their organisation." };
  }
  const { data, error } = await db.auth.admin.inviteUserByEmail(e.email, {
    // Invites use the implicit flow (tokens in the URL fragment), handled client-side.
    redirectTo: `${site.url}/auth/accept?next=/reset-password`,
    data: { full_name: e.name, company_name: e.company ?? "", industry: e.industry ?? "" },
  });
  if (error || !data.user) {
    logger.warn("invite_failed", { code: error?.code });
    return { error: `Invite failed: ${error?.message ?? "unknown error"}. Check Supabase SMTP settings.` };
  }
  const { data: prof } = await db.from("profiles").select("organization_id").eq("id", data.user.id).single();
  await db.from("enquiries").update({ organization_id: prof?.organization_id }).eq("id", id);
  await db.from("organizations").update({ acquisition_source: `enquiry:${e.type}` }).eq("id", prof?.organization_id);
  await db.from("crm_activities").insert({ enquiry_id: id, type: "system", body: "Client portal invitation sent", created_by: user.id });
  await audit(user.id, "customer.invited", "enquiry", id);
  revalidatePath(`/admin/enquiries/${id}`);
  return { ok: true, message: "Invitation emailed. Their account and onboarding checklist have been created." };
}

// ---------- Consultations & availability ----------
export async function updateConsultation(fd: FormData) {
  await assertStaff();
  const id = uuid.parse(fd.get("id"));
  const status = z.enum(["scheduled", "completed", "cancelled", "no_show"]).parse(fd.get("status"));
  const meeting_url = String(fd.get("meeting_url") ?? "").trim();
  const notes = String(fd.get("notes") ?? "").slice(0, 4000);
  await createAdminClient().from("consultations").update({
    status, meeting_url: /^https:\/\//.test(meeting_url) ? meeting_url : null, notes: notes || null,
  }).eq("id", id);
  revalidatePath("/admin/consultations");
}

export async function addAvailability(fd: FormData) {
  await assertStaff();
  const toMin = (v: FormDataEntryValue | null) => { const [h, m] = String(v ?? "").split(":").map(Number); return h * 60 + (m || 0); };
  const row = z.object({ weekday: z.coerce.number().int().min(0).max(6), start_minute: z.number().min(0).max(1439), end_minute: z.number().min(1).max(1440), slot_minutes: z.coerce.number().int().min(15).max(120) })
    .refine((r) => r.end_minute > r.start_minute)
    .parse({ weekday: fd.get("weekday"), start_minute: toMin(fd.get("start")), end_minute: toMin(fd.get("end")), slot_minutes: fd.get("slot_minutes") });
  await createAdminClient().from("availability_rules").insert(row);
  revalidatePath("/admin/consultations");
}

export async function deleteAvailability(fd: FormData) {
  await assertStaff();
  await createAdminClient().from("availability_rules").delete().eq("id", uuid.parse(fd.get("id")));
  revalidatePath("/admin/consultations");
}

// ---------- Quotes / proposals ----------
export async function createQuote(fd: FormData) {
  const { user } = await assertStaff();
  const db = createAdminClient();
  const enquiryId = fd.get("enquiry_id") ? uuid.parse(fd.get("enquiry_id")) : null;
  const planId = z.enum(["starter", "growth", "premium", "enterprise"]).parse(fd.get("plan_id") || "growth");
  const { data: plan } = await db.from("plans").select("*").eq("id", planId).single();
  let enquiry: Record<string, string | null> | null = null;
  if (enquiryId) enquiry = (await db.from("enquiries").select("*").eq("id", enquiryId).single()).data;
  const copy = draftProposalCopy({ company: enquiry?.company ?? null, industry: enquiry?.industry ?? null, planName: plan?.name ?? planId, message: enquiry?.message ?? null, services: (enquiry as unknown as { services?: string[] })?.services ?? [] });
  const valid = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  const items = plan && plan.monthly_pence > 0 ? [{ description: `${plan.name} plan`, setup_pence: plan.setup_fee_pence, monthly_pence: plan.monthly_pence }] : [];
  const { data: q, error } = await db.from("quotes").insert({
    enquiry_id: enquiryId, recipient_name: enquiry?.name ?? "Client", recipient_email: enquiry?.email ?? "client@example.com",
    company: enquiry?.company ?? null, plan_id: planId, title: `${plan?.name ?? "Custom"} automation proposal${enquiry?.company ? ` for ${enquiry.company}` : ""}`,
    introduction: copy.introduction, scope: copy.scope, line_items: items,
    setup_total_pence: items.reduce((t, i) => t + i.setup_pence, 0), monthly_total_pence: items.reduce((t, i) => t + i.monthly_pence, 0),
    valid_until: valid, created_by: user.id,
  }).select("id").single();
  if (error || !q) throw new Error(error?.message);
  await audit(user.id, "quote.created", "quote", q.id);
  redirect(`/admin/quotes/${q.id}`);
}

function parseLineItems(text: string) {
  // One per line: "Description | setup £ | monthly £"
  return text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const [description, setup, monthly] = l.split("|").map((x) => x.trim());
    const toPence = (v?: string) => Math.max(0, Math.round(Number((v ?? "0").replace(/[£,\s]/g, "")) * 100) || 0);
    return { description: description.slice(0, 300), setup_pence: toPence(setup), monthly_pence: toPence(monthly) };
  });
}

export async function updateQuote(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await assertStaff();
  const id = uuid.parse(fd.get("id"));
  const parsed = z.object({
    title: z.string().trim().min(3).max(200), recipient_name: z.string().trim().min(2).max(160), recipient_email: z.string().trim().toLowerCase().email(),
    company: z.string().trim().max(200).optional(), introduction: z.string().max(8000).optional(), scope: z.string().max(12000).optional(),
    valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), plan_id: z.enum(["starter", "growth", "premium", "enterprise"]),
  }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Please check the fields.", fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])) };
  const items = parseLineItems(String(fd.get("line_items") ?? ""));
  if (!items.length) return { error: "Add at least one line item." };
  const db = createAdminClient();
  const { data: q } = await db.from("quotes").select("status").eq("id", id).single();
  if (q?.status === "accepted") return { error: "Accepted proposals can't be edited. Duplicate it instead." };
  await db.from("quotes").update({
    ...parsed.data, company: parsed.data.company || null, line_items: items,
    setup_total_pence: items.reduce((t, i) => t + i.setup_pence, 0), monthly_total_pence: items.reduce((t, i) => t + i.monthly_pence, 0),
  }).eq("id", id);
  await audit(user.id, "quote.updated", "quote", id);
  revalidatePath(`/admin/quotes/${id}`);
  return { ok: true, message: "Proposal saved." };
}

export async function aiDraftQuote(_p: ActionState, fd: FormData): Promise<ActionState> {
  await assertStaff();
  if (!openaiConfigured()) return { error: "OpenAI isn't configured — the template draft is already in place. Add OPENAI_API_KEY to enable AI drafting." };
  const id = uuid.parse(fd.get("id"));
  const db = createAdminClient();
  const { data: q } = await db.from("quotes").select("*, enquiries(message, industry, services)").eq("id", id).single();
  if (!q) return { error: "Not found" };
  const enq = q.enquiries as { message?: string; industry?: string; services?: string[] } | null;
  try {
    const text = await chatComplete([
      { role: "system", content: "You write concise, professional B2B proposals for a UK AI automation agency (Kairo Systems). British English. Never invent statistics, results or client names. Never guarantee outcomes. Output two sections separated by a line containing only '---': first an introduction (2 short paragraphs), then a scope of work as bullet points starting with '• '." },
      { role: "user", content: `Client: ${q.company ?? q.recipient_name}. Industry: ${enq?.industry ?? "unknown"}. Services of interest: ${(enq?.services ?? []).join(", ") || "not specified"}. Plan: ${q.plan_id}. Their message: ${enq?.message ?? "none"}. Line items: ${JSON.stringify(q.line_items)}.` },
    ], { maxTokens: 900 });
    const [intro, scope] = text.split(/\n-{3,}\n/);
    if (!intro || !scope) return { error: "AI response wasn't in the expected format — please try again." };
    await db.from("quotes").update({ introduction: intro.trim(), scope: scope.trim() }).eq("id", id);
    revalidatePath(`/admin/quotes/${id}`);
    return { ok: true, message: "AI draft inserted. Review every sentence before sending." };
  } catch (err) {
    logger.error("ai_quote_failed", { err });
    return { error: "AI drafting failed. The existing text is unchanged." };
  }
}

export async function sendQuote(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await assertStaff();
  const id = uuid.parse(fd.get("id"));
  const db = createAdminClient();
  const { data: q } = await db.from("quotes").select("*").eq("id", id).single();
  if (!q) return { error: "Not found" };
  if (!["draft", "sent"].includes(q.status)) return { error: `Proposal is ${q.status}.` };
  const link = `${site.url}/proposal/${q.public_token}`;
  const res = await sendEmail({
    to: q.recipient_email,
    subject: `Your proposal from Kairo Systems — ${q.title}`,
    text: `Hi ${firstName(q.recipient_name)},\n\nThank you for your time. Your proposal is ready to review:\n\n${link}\n\nSummary: ${gbp(q.setup_total_pence)} one-off setup and ${gbp(q.monthly_total_pence)} per month (ex. VAT). The proposal is valid until ${q.valid_until}.\n\nIf you have any questions, just reply to this email.\n\nKind regards,\nKairo Systems`,
    context: "proposal", relatedId: id,
  });
  if (res.status !== "sent") {
    return { error: res.status === "not_configured" ? `Email isn't configured, so nothing was sent. Share this link manually: ${link}` : `Email failed: ${res.error ?? res.status}` };
  }
  await db.from("quotes").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", id);
  if (q.enquiry_id) {
    await db.from("enquiries").update({ stage: "proposal_sent" }).eq("id", q.enquiry_id).in("stage", ["new", "contacted", "qualified"]);
    await db.from("crm_activities").insert({ enquiry_id: q.enquiry_id, type: "email", body: `Proposal ${q.number} sent`, created_by: user.id });
  }
  await audit(user.id, "quote.sent", "quote", id);
  revalidatePath(`/admin/quotes/${id}`);
  return { ok: true, message: "Proposal emailed." };
}

export async function markQuoteSentManually(fd: FormData) {
  const { user } = await assertStaff();
  const id = uuid.parse(fd.get("id"));
  await createAdminClient().from("quotes").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", id).eq("status", "draft");
  await audit(user.id, "quote.marked_sent", "quote", id);
  revalidatePath(`/admin/quotes/${id}`);
}

export async function setQuoteStatus(fd: FormData) {
  const { user } = await assertStaff();
  const id = uuid.parse(fd.get("id"));
  const status = z.enum(["declined", "expired", "draft"]).parse(fd.get("status"));
  await createAdminClient().from("quotes").update({ status }).eq("id", id).neq("status", "accepted");
  await audit(user.id, `quote.${status}`, "quote", id);
  revalidatePath(`/admin/quotes/${id}`);
}
