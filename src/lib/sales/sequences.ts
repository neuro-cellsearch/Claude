import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/integrations/email";
import { renderTemplate, unresolvedPlaceholders } from "@/lib/templating";
import { firstName } from "@/lib/format";
import { site } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Processes due sequence enrolments. A sequence stops automatically when the
 * enquiry leaves the early pipeline stages (someone has engaged personally).
 */
export async function processDueSequences(limit = 50) {
  const db = createAdminClient();
  const { data: due } = await db
    .from("sequence_enrollments")
    .select("id, sequence_id, enquiry_id, current_step, email_sequences(active), enquiries(name,email,company,stage)")
    .eq("status", "active")
    .lte("next_send_at", new Date().toISOString())
    .limit(limit);

  const summary = { processed: 0, sent: 0, stopped: 0, notConfigured: 0, failed: 0, held: 0 };
  for (const en of due ?? []) {
    summary.processed++;
    const enquiry = en.enquiries as unknown as { name: string; email: string; company: string | null; stage: string } | null;
    const seq = en.email_sequences as unknown as { active: boolean } | null;
    if (!enquiry || !seq?.active || !["new", "contacted"].includes(enquiry.stage)) {
      await db.from("sequence_enrollments").update({ status: "stopped" }).eq("id", en.id);
      summary.stopped++;
      continue;
    }
    const { data: step } = await db
      .from("email_sequence_steps")
      .select("subject, body, delay_days")
      .eq("sequence_id", en.sequence_id)
      .eq("step_order", en.current_step)
      .maybeSingle();
    if (!step) {
      await db.from("sequence_enrollments").update({ status: "completed", next_send_at: null }).eq("id", en.id);
      continue;
    }
    const vars = {
      first_name: firstName(enquiry.name), company_name: enquiry.company || "your business",
      sender_name: "The Kairo team", agency_name: "Kairo Systems", booking_url: `${site.url}/book`,
    };
    const subject = renderTemplate(step.subject, vars);
    const body = renderTemplate(step.body, vars);
    if (unresolvedPlaceholders(subject + body).length) {
      // Never send a message with visible {{placeholders}} — hold for manual review.
      await db.from("sequence_enrollments").update({ status: "paused" }).eq("id", en.id);
      summary.held++;
      continue;
    }
    const res = await sendEmail({ to: enquiry.email, subject, text: body, context: "sequence", relatedId: en.enquiry_id, marketing: true });
    if (res.status === "not_configured") {
      summary.notConfigured++;
      continue; // leave due; will send once email is configured
    }
    if (res.status === "suppressed") {
      await db.from("sequence_enrollments").update({ status: "stopped" }).eq("id", en.id);
      summary.stopped++;
      continue;
    }
    if (res.status === "failed") {
      summary.failed++;
      continue;
    }
    summary.sent++;
    await db.from("crm_activities").insert({ enquiry_id: en.enquiry_id, type: "email", body: `Sequence email sent: ${subject}` });
    const { data: next } = await db
      .from("email_sequence_steps")
      .select("delay_days")
      .eq("sequence_id", en.sequence_id)
      .eq("step_order", en.current_step + 1)
      .maybeSingle();
    await db.from("sequence_enrollments").update(
      next
        ? { current_step: en.current_step + 1, next_send_at: new Date(Date.now() + next.delay_days * 86400_000).toISOString() }
        : { status: "completed", next_send_at: null, current_step: en.current_step + 1 },
    ).eq("id", en.id);
  }
  logger.info("sequences_processed", summary);
  return summary;
}
