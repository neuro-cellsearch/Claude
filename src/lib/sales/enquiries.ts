import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { scoreEnquiry, estimateMonthlyValue } from "@/lib/scoring";
import { notifyStaff } from "@/lib/integrations/notify";
import { sendEmail } from "@/lib/integrations/email";
import { generateSlots, type AvailabilityRule } from "@/lib/slots";
import { logger } from "@/lib/logger";
import { site } from "@/lib/env";
import { firstName, dateTime } from "@/lib/format";
import { INDUSTRY_LABEL } from "@/lib/content/industries";

export type NewEnquiry = {
  type: "contact" | "quote" | "consultation" | "chatbot" | "proposal";
  name: string;
  email: string;
  phone?: string;
  company?: string;
  role?: string;
  industry?: string;
  message?: string;
  services?: string[];
  budget?: string;
  monthlyEnquiries?: string;
  marketingConsent?: boolean;
  ipHash?: string | null;
  utm?: Record<string, string> | null;
  slot?: string;
};

export async function getAvailableSlots(now = new Date()): Promise<string[]> {
  const db = createAdminClient();
  const [{ data: rules }, { data: booked }] = await Promise.all([
    db.from("availability_rules").select("weekday,start_minute,end_minute,slot_minutes,active").eq("active", true),
    db.from("consultations").select("scheduled_for").neq("status", "cancelled").gte("scheduled_for", now.toISOString()),
  ]);
  return generateSlots((rules ?? []) as AvailabilityRule[], (booked ?? []).map((b) => b.scheduled_for), now);
}

export class SlotUnavailableError extends Error {}

/** Records an inbound enquiry, scores it, books any consultation slot, enrols sequences and notifies staff. */
export async function createEnquiry(input: NewEnquiry): Promise<{ id: string; consultationAt?: string }> {
  const db = createAdminClient();
  const { score, reasons } = scoreEnquiry({
    type: input.type, industry: input.industry, budget: input.budget, monthlyEnquiries: input.monthlyEnquiries,
    services: input.services, phone: input.phone, company: input.company, message: input.message,
  });

  if (input.type === "consultation") {
    if (!input.slot) throw new SlotUnavailableError("Please choose a time");
    const slots = await getAvailableSlots();
    if (!slots.includes(new Date(input.slot).toISOString())) throw new SlotUnavailableError("That time is no longer available");
  }

  // Merge repeat enquiries from the same email that are still open, rather than duplicating.
  const { data: existing } = await db
    .from("enquiries")
    .select("id, score, services")
    .eq("email", input.email.toLowerCase())
    .in("stage", ["new", "contacted", "qualified"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let id: string;
  if (existing) {
    id = existing.id;
    await db.from("enquiries").update({
      score: Math.max(existing.score, score),
      services: Array.from(new Set([...(existing.services ?? []), ...(input.services ?? [])])),
      phone: input.phone ?? undefined,
      company: input.company ?? undefined,
      budget: input.budget ?? undefined,
      marketing_consent: input.marketingConsent || undefined,
    }).eq("id", id);
    await db.from("crm_activities").insert({
      enquiry_id: id, type: "system",
      body: `Repeat ${input.type} enquiry received${input.message ? `:\n\n${input.message}` : ""}`,
    });
  } else {
    const { data, error } = await db
      .from("enquiries")
      .insert({
        type: input.type, name: input.name, email: input.email.toLowerCase(), phone: input.phone, company: input.company,
        role: input.role, industry: input.industry, message: input.message, services: input.services ?? [],
        budget: input.budget, monthly_enquiries: input.monthlyEnquiries, score,
        estimated_monthly_pence: estimateMonthlyValue(input.budget), marketing_consent: input.marketingConsent ?? false,
        ip_hash: input.ipHash, utm: input.utm ?? null,
        next_follow_up_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`Could not save enquiry: ${error?.message}`);
    id = data.id;
    await db.from("crm_activities").insert({ enquiry_id: id, type: "system", body: `Lead score ${score}: ${reasons.join(", ")}` });
  }

  let consultationAt: string | undefined;
  if (input.type === "consultation" && input.slot) {
    const { error } = await db.from("consultations").insert({ enquiry_id: id, scheduled_for: new Date(input.slot).toISOString() });
    if (error) {
      if (error.code === "23505") throw new SlotUnavailableError("Someone just booked that time — please pick another");
      throw new Error(error.message);
    }
    consultationAt = input.slot;
    await db.from("crm_activities").insert({ enquiry_id: id, type: "meeting", body: `Consultation booked for ${dateTime(input.slot)}` });
  }

  await enrolInAutoSequences(id, input.type).catch((err) => logger.error("sequence_enrol_failed", { err }));

  const label = { contact: "Contact form", quote: "Quote request", consultation: "Consultation booked", chatbot: "Chat assistant lead", proposal: "Proposal" }[input.type];
  await notifyStaff(
    `${label}: ${input.company || input.name} (score ${score})`,
    [
      `Name: ${input.name}`, `Email: ${input.email}`, input.phone && `Phone: ${input.phone}`,
      input.company && `Company: ${input.company}`, input.industry && `Industry: ${INDUSTRY_LABEL[input.industry] ?? input.industry}`,
      consultationAt && `Consultation: ${dateTime(consultationAt)}`, input.message && `\n${input.message}`,
    ].filter(Boolean).join("\n"),
    `/admin/enquiries/${id}`,
  );

  // Transactional acknowledgement (they asked us to contact them).
  if (input.type !== "chatbot") {
    await sendEmail({
      to: input.email,
      subject: consultationAt ? `Your consultation with Kairo Systems — ${dateTime(consultationAt)}` : "We've received your enquiry",
      text: consultationAt
        ? `Hi ${firstName(input.name)},\n\nYour consultation is booked for ${dateTime(consultationAt)} (UK time). We'll send a video call link before the meeting. If you need to change the time, simply reply to this email.\n\nKairo Systems\n${site.url}`
        : `Hi ${firstName(input.name)},\n\nThanks for getting in touch with Kairo Systems. A member of our team will reply within one working day.\n\nKairo Systems\n${site.url}`,
      context: "transactional",
      relatedId: id,
    }).catch((err) => logger.error("ack_email_failed", { err }));
  }

  return { id, consultationAt };
}

export async function enrolInAutoSequences(enquiryId: string, type: string) {
  const db = createAdminClient();
  const { data: seqs } = await db.from("email_sequences").select("id").eq("active", true).eq("trigger_type", type);
  for (const seq of seqs ?? []) {
    await db.from("sequence_enrollments").upsert(
      { sequence_id: seq.id, enquiry_id: enquiryId, current_step: 1, status: "active", next_send_at: new Date().toISOString() },
      { onConflict: "sequence_id,enquiry_id", ignoreDuplicates: true },
    );
  }
}
