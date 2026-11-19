"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertStaff, assertAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { prospectSchema, fieldErrors, type ActionState } from "@/lib/validation";
import { outreachEligibility } from "@/lib/sales/compliance";
import { renderTemplate, unresolvedPlaceholders } from "@/lib/templating";
import { sendEmail, isSuppressed, emailConfigured } from "@/lib/integrations/email";
import { processDueSequences } from "@/lib/sales/sequences";
import { firstName } from "@/lib/format";
import { site } from "@/lib/env";
import { INDUSTRY_LABEL } from "@/lib/content/industries";

const uuid = z.string().uuid();

export async function createProspect(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await assertStaff();
  const parsed = prospectSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Please check the fields.", fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;
  const db = createAdminClient();
  if (d.business_email && (await isSuppressed(d.business_email))) return { error: "This email is on the suppression list and can't be added." };
  const { error } = await db.from("prospects").insert({ ...d, created_by: user.id });
  if (error) return { error: error.message };
  revalidatePath("/admin/prospects");
  return { ok: true, message: "Prospect added — review and approve before any outreach." };
}

export async function prospectAction(fd: FormData) {
  const { user } = await assertStaff();
  const id = uuid.parse(fd.get("id"));
  const op = z.enum(["approve", "unapprove", "dnc", "tps_clear", "tps_registered", "interested", "not_interested", "replied", "delete"]).parse(fd.get("op"));
  const db = createAdminClient();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    approve: { status: "approved", approved_by: user.id, approved_at: now },
    unapprove: { status: "new", approved_by: null, approved_at: null },
    dnc: { status: "do_not_contact" },
    tps_clear: { tps_checked_at: now, tps_registered: false },
    tps_registered: { tps_checked_at: now, tps_registered: true },
    interested: { status: "interested" },
    not_interested: { status: "not_interested" },
    replied: { status: "replied" },
    delete: {},
  }[op];
  if (op === "delete") {
    await db.from("prospects").delete().eq("id", id);
  } else {
    const { data: p } = await db.from("prospects").update(patch).eq("id", id).select("business_email,business_phone").single();
    if (op === "dnc" && p) {
      // Honour objections permanently.
      if (p.business_email) await db.from("suppression_list").upsert({ value: p.business_email.toLowerCase(), kind: "email", reason: "Do not contact (prospect)" }, { onConflict: "value", ignoreDuplicates: true });
      if (p.business_phone) await db.from("suppression_list").upsert({ value: p.business_phone.replace(/\s/g, ""), kind: "phone", reason: "Do not contact (prospect)" }, { onConflict: "value", ignoreDuplicates: true });
      await db.from("campaign_recipients").update({ status: "skipped", error: "Do not contact" }).eq("prospect_id", id).in("status", ["pending", "approved"]);
    }
  }
  await audit(user.id, `prospect.${op}`, "prospect", id);
  revalidatePath("/admin/prospects");
}

// ---------- Templates ----------
export async function saveTemplate(_p: ActionState, fd: FormData): Promise<ActionState> {
  await assertStaff();
  const parsed = z.object({
    id: z.string().uuid().optional().or(z.literal("")), channel: z.enum(["email", "linkedin", "phone"]), industry: z.string().trim().min(2).max(60),
    name: z.string().trim().min(2).max(160), subject: z.string().max(300).optional(), body: z.string().trim().min(10).max(10000),
  }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Please check the fields.", fieldErrors: fieldErrors(parsed.error) };
  const { id, ...v } = parsed.data;
  if (v.channel === "email" && !/unsubscribe|opt[- ]?out|not to hear|rather not/i.test(v.body)) {
    return { error: "Email templates must include a clear opt-out line (e.g. 'reply unsubscribe and we won't contact you again')." };
  }
  const db = createAdminClient();
  const res = id ? await db.from("outreach_templates").update(v).eq("id", id) : await db.from("outreach_templates").insert(v);
  if (res.error) return { error: res.error.message };
  revalidatePath("/admin/templates");
  return { ok: true, message: "Template saved." };
}

export async function deleteTemplate(fd: FormData) {
  await assertStaff();
  await createAdminClient().from("outreach_templates").delete().eq("id", uuid.parse(fd.get("id")));
  revalidatePath("/admin/templates");
}

// ---------- Campaigns ----------
export async function createCampaign(fd: FormData) {
  const { user } = await assertStaff();
  const v = z.object({ name: z.string().trim().min(3).max(160), template_id: z.string().uuid(), daily_limit: z.coerce.number().int().min(1).max(200) })
    .parse({ name: fd.get("name"), template_id: fd.get("template_id"), daily_limit: fd.get("daily_limit") || 25 });
  const db = createAdminClient();
  const { data: t } = await db.from("outreach_templates").select("channel, industry").eq("id", v.template_id).single();
  if (!t) throw new Error("Template not found");
  const { data } = await db.from("outreach_campaigns").insert({ ...v, channel: t.channel, industry: t.industry, created_by: user.id }).select("id").single();
  await audit(user.id, "campaign.created", "campaign", data!.id);
  redirect(`/admin/campaigns/${data!.id}`);
}

export async function addRecipients(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, profile } = await assertStaff();
  const campaignId = uuid.parse(fd.get("campaign_id"));
  const ids = fd.getAll("prospect_ids").map(String).filter((x) => uuid.safeParse(x).success);
  if (!ids.length) return { error: "Select at least one prospect." };
  const db = createAdminClient();
  const { data: c } = await db.from("outreach_campaigns").select("*, outreach_templates(subject, body)").eq("id", campaignId).single();
  if (!c) return { error: "Campaign not found." };
  if (!["draft", "pending_approval"].includes(c.status)) return { error: "Recipients can only be added while the campaign is a draft." };
  const tpl = c.outreach_templates as { subject: string | null; body: string } | null;
  if (!tpl) return { error: "Campaign template was deleted." };
  const { data: prospects } = await db.from("prospects").select("*").in("id", ids);
  let added = 0; const skipped: string[] = [];
  for (const p of prospects ?? []) {
    const suppressed = p.business_email ? await isSuppressed(p.business_email) : false;
    const elig = outreachEligibility(p, c.channel, suppressed);
    if (!elig.ok) { skipped.push(`${p.company_name}: ${elig.reason}`); continue; }
    const vars = {
      first_name: firstName(p.contact_name), company_name: p.company_name, sender_name: profile.full_name || "The Kairo team",
      agency_name: "Kairo Systems", agency_address: site.address || "{{agency_address}}", booking_url: `${site.url}/book`,
      area: "{{area}}", industry: INDUSTRY_LABEL[p.industry ?? ""] ?? p.industry ?? "",
    };
    const { error } = await db.from("campaign_recipients").insert({
      campaign_id: campaignId, prospect_id: p.id, subject: tpl.subject ? renderTemplate(tpl.subject, vars) : null, body: renderTemplate(tpl.body, vars),
    });
    if (!error) added++; else if (error.code === "23505") skipped.push(`${p.company_name}: already in campaign`);
  }
  await audit(user.id, "campaign.recipients_added", "campaign", campaignId, { added, skipped: skipped.length });
  revalidatePath(`/admin/campaigns/${campaignId}`);
  return { ok: true, message: `${added} added. ${skipped.length ? `Skipped ${skipped.length}: ${skipped.slice(0, 6).join("; ")}${skipped.length > 6 ? "…" : ""}` : ""}` };
}

export async function updateRecipient(_p: ActionState, fd: FormData): Promise<ActionState> {
  await assertStaff();
  const id = uuid.parse(fd.get("id"));
  const subject = String(fd.get("subject") ?? "").slice(0, 300) || null;
  const body = z.string().trim().min(10).max(10000).safeParse(fd.get("body"));
  if (!body.success) return { error: "Message is too short." };
  const db = createAdminClient();
  // Editing an approved message sends it back for approval.
  const { data } = await db.from("campaign_recipients").update({ subject, body: body.data, status: "pending", approved_at: null }).eq("id", id).in("status", ["pending", "approved"]).select("campaign_id").single();
  revalidatePath(`/admin/campaigns/${data?.campaign_id}`);
  return { ok: true, message: "Saved — needs re-approval." };
}

export async function recipientAction(fd: FormData) {
  const { user } = await assertStaff();
  const id = uuid.parse(fd.get("id"));
  const op = z.enum(["approve", "skip", "mark_sent", "replied", "reset"]).parse(fd.get("op"));
  const db = createAdminClient();
  const { data: r } = await db.from("campaign_recipients").select("*, outreach_campaigns(channel, status)").eq("id", id).single();
  if (!r) return;
  const camp = r.outreach_campaigns as { channel: string; status: string };
  if (op === "approve") {
    const issues = unresolvedPlaceholders(`${r.subject ?? ""}\n${r.body}`);
    if (issues.length) return; // UI shows placeholders; approval blocked until fixed
    await db.from("campaign_recipients").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", id).eq("status", "pending");
  } else if (op === "skip") {
    await db.from("campaign_recipients").update({ status: "skipped" }).eq("id", id).in("status", ["pending", "approved"]);
  } else if (op === "mark_sent") {
    // Manual channels (LinkedIn / phone) are performed by a person, then logged here.
    if (camp.channel === "email" || r.status !== "approved" || !["approved", "sending"].includes(camp.status)) return;
    await db.from("campaign_recipients").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", id);
    await db.from("prospects").update({ status: "contacted" }).eq("id", r.prospect_id).eq("status", "approved");
    await db.from("crm_activities").insert({ prospect_id: r.prospect_id, type: camp.channel === "phone" ? "call" : "note", body: `${camp.channel} outreach completed (campaign)`, created_by: user.id });
  } else if (op === "replied") {
    await db.from("campaign_recipients").update({ status: "replied" }).eq("id", id);
    await db.from("prospects").update({ status: "replied" }).eq("id", r.prospect_id);
  } else if (op === "reset") {
    await db.from("campaign_recipients").update({ status: "pending", approved_at: null }).eq("id", id).eq("status", "skipped");
  }
  revalidatePath(`/admin/campaigns/${r.campaign_id}`);
}

export async function approveAllPending(fd: FormData) {
  await assertStaff();
  const campaignId = uuid.parse(fd.get("campaign_id"));
  const db = createAdminClient();
  const { data: rows } = await db.from("campaign_recipients").select("id, subject, body").eq("campaign_id", campaignId).eq("status", "pending");
  const clean = (rows ?? []).filter((r) => !unresolvedPlaceholders(`${r.subject ?? ""}\n${r.body}`).length).map((r) => r.id);
  if (clean.length) await db.from("campaign_recipients").update({ status: "approved", approved_at: new Date().toISOString() }).in("id", clean);
  revalidatePath(`/admin/campaigns/${campaignId}`);
}

export async function campaignAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await assertStaff();
  const id = uuid.parse(fd.get("id"));
  const op = z.enum(["submit", "approve", "cancel", "complete"]).parse(fd.get("op"));
  const db = createAdminClient();
  const { data: c } = await db.from("outreach_campaigns").select("*").eq("id", id).single();
  if (!c) return { error: "Not found" };
  if (op === "submit") {
    const { count } = await db.from("campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "approved");
    if (!count) return { error: "Approve at least one recipient message first." };
    await db.from("outreach_campaigns").update({ status: "pending_approval" }).eq("id", id).eq("status", "draft");
  } else if (op === "approve") {
    await assertAdmin();
    if (c.status !== "pending_approval") return { error: "Submit the campaign for approval first." };
    await db.from("outreach_campaigns").update({ status: "approved", approved_by: user.id, approved_at: new Date().toISOString() }).eq("id", id);
  } else if (op === "cancel") {
    await db.from("outreach_campaigns").update({ status: "cancelled" }).eq("id", id);
  } else if (op === "complete") {
    await db.from("outreach_campaigns").update({ status: "completed" }).eq("id", id).in("status", ["approved", "sending"]);
  }
  await audit(user.id, `campaign.${op}`, "campaign", id);
  revalidatePath(`/admin/campaigns/${id}`);
  return { ok: true, message: `Campaign ${op === "submit" ? "submitted for approval" : op + "d"}.` };
}

/** Sends the next batch of APPROVED email recipients, respecting the campaign's daily limit. */
export async function sendCampaignBatch(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await assertAdmin();
  const id = uuid.parse(fd.get("id"));
  const db = createAdminClient();
  const { data: c } = await db.from("outreach_campaigns").select("*").eq("id", id).single();
  if (!c) return { error: "Not found" };
  if (c.channel !== "email") return { error: "Only email campaigns are sent by the platform. LinkedIn and phone outreach is done manually — log each one as completed." };
  if (!["approved", "sending"].includes(c.status) || !c.approved_at) return { error: "The campaign must be approved before sending." };
  if (!emailConfigured()) return { error: "Email provider isn't configured — nothing was sent." };
  const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
  const { count: sentToday } = await db.from("campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "sent").gte("sent_at", startOfDay.toISOString());
  const remaining = c.daily_limit - (sentToday ?? 0);
  if (remaining <= 0) return { error: `Daily limit of ${c.daily_limit} reached. Try again tomorrow.` };
  const { data: batch } = await db.from("campaign_recipients").select("*, prospects(*)").eq("campaign_id", id).eq("status", "approved").not("approved_at", "is", null).limit(remaining);
  if (!batch?.length) return { error: "No approved, unsent recipients." };
  await db.from("outreach_campaigns").update({ status: "sending" }).eq("id", id);
  let sent = 0, failed = 0, blocked = 0;
  for (const r of batch) {
    const p = r.prospects as Parameters<typeof outreachEligibility>[0] & { id: string; business_email: string };
    const suppressed = p.business_email ? await isSuppressed(p.business_email) : true;
    const elig = outreachEligibility(p, "email", suppressed);
    if (!elig.ok || unresolvedPlaceholders(`${r.subject ?? ""}\n${r.body}`).length) {
      await db.from("campaign_recipients").update({ status: "skipped", error: elig.reason ?? "Unresolved placeholders" }).eq("id", r.id);
      blocked++; continue;
    }
    const res = await sendEmail({ to: p.business_email, subject: r.subject ?? "Hello", text: r.body, context: "campaign", relatedId: r.id, marketing: true });
    if (res.status === "sent") {
      sent++;
      await db.from("campaign_recipients").update({ status: "sent", sent_at: new Date().toISOString(), error: null }).eq("id", r.id);
      await db.from("prospects").update({ status: "contacted" }).eq("id", p.id).eq("status", "approved");
      await db.from("crm_activities").insert({ prospect_id: p.id, type: "email", body: `Campaign email sent: ${r.subject}`, created_by: user.id });
    } else {
      failed++;
      await db.from("campaign_recipients").update({ status: res.status === "suppressed" ? "skipped" : "failed", error: res.error ?? res.status }).eq("id", r.id);
    }
  }
  await audit(user.id, "campaign.batch_sent", "campaign", id, { sent, failed, blocked });
  revalidatePath(`/admin/campaigns/${id}`);
  return { ok: true, message: `Sent ${sent}. Failed ${failed}. Blocked by compliance checks ${blocked}.` };
}

// ---------- Sequences ----------
export async function toggleSequence(fd: FormData) {
  const { user } = await assertStaff();
  const id = uuid.parse(fd.get("id"));
  const active = fd.get("active") === "true";
  await createAdminClient().from("email_sequences").update({ active }).eq("id", id);
  await audit(user.id, active ? "sequence.activated" : "sequence.deactivated", "sequence", id);
  revalidatePath("/admin/sequences");
}

export async function saveSequenceStep(_p: ActionState, fd: FormData): Promise<ActionState> {
  await assertStaff();
  const parsed = z.object({
    id: z.string().uuid().optional().or(z.literal("")), sequence_id: z.string().uuid(), step_order: z.coerce.number().int().min(1).max(20),
    delay_days: z.coerce.number().int().min(0).max(90), subject: z.string().trim().min(3).max(300), body: z.string().trim().min(20).max(10000),
  }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Please check the fields.", fieldErrors: fieldErrors(parsed.error) };
  const { id, ...v } = parsed.data;
  const db = createAdminClient();
  const res = id ? await db.from("email_sequence_steps").update(v).eq("id", id) : await db.from("email_sequence_steps").insert(v);
  if (res.error) return { error: res.error.code === "23505" ? "A step with that number already exists." : res.error.message };
  revalidatePath("/admin/sequences");
  return { ok: true, message: "Step saved." };
}

export async function createSequence(_p: ActionState, fd: FormData): Promise<ActionState> {
  await assertStaff();
  const parsed = z.object({ name: z.string().trim().min(3).max(160), description: z.string().max(1000).optional(), trigger_type: z.enum(["contact", "quote", "consultation", "chatbot", "proposal", ""]).optional() }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Enter a name." };
  await createAdminClient().from("email_sequences").insert({ name: parsed.data.name, description: parsed.data.description || null, trigger_type: parsed.data.trigger_type || null, active: false });
  revalidatePath("/admin/sequences");
  return { ok: true, message: "Sequence created (inactive)." };
}

export async function processSequencesNow(_p: ActionState): Promise<ActionState> {
  await assertStaff();
  const s = await processDueSequences();
  return { ok: true, message: `Processed ${s.processed}: sent ${s.sent}, stopped ${s.stopped}, waiting for email config ${s.notConfigured}, held for review ${s.held}, failed ${s.failed}.` };
}

export async function addSuppression(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await assertStaff();
  const value = String(fd.get("value") ?? "").trim().toLowerCase();
  const kind = value.startsWith("@") ? "domain" : value.includes("@") ? "email" : /^[+0-9\s()-]{7,}$/.test(value) ? "phone" : null;
  if (!kind) return { error: "Enter an email, @domain or phone number." };
  await createAdminClient().from("suppression_list").upsert({ value: kind === "phone" ? value.replace(/[\s()-]/g, "") : value, kind, reason: String(fd.get("reason") || "Manual") }, { onConflict: "value" });
  await audit(user.id, "suppression.added", "suppression", value);
  revalidatePath("/admin/prospects");
  return { ok: true, message: "Added to suppression list." };
}
