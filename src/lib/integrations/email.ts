import "server-only";
import { serverEnv, site } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { httpJson } from "./http";
import { logger } from "@/lib/logger";
import { unsubscribeToken } from "@/lib/crypto";

export function emailConfigured() {
  return Boolean(serverEnv("RESEND_API_KEY") && serverEnv("EMAIL_FROM"));
}

export function unsubscribeUrl(email: string) {
  return `${site.url}/unsubscribe?e=${encodeURIComponent(email)}&t=${unsubscribeToken(email)}`;
}

export async function isSuppressed(email: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  const domain = "@" + e.split("@")[1];
  const { data } = await createAdminClient().from("suppression_list").select("id").in("value", [e, domain]).limit(1);
  return Boolean(data?.length);
}

type SendArgs = {
  to: string;
  subject: string;
  text: string;
  context: "notification" | "sequence" | "campaign" | "transactional" | "proposal";
  relatedId?: string;
  /** Marketing/outreach emails get an unsubscribe footer and are suppression-checked. */
  marketing?: boolean;
  replyTo?: string;
};

export type SendResult = { status: "sent" | "failed" | "not_configured" | "suppressed"; id?: string; error?: string };

/**
 * Sends an email via Resend and records the attempt in `email_messages`.
 * If email isn't configured the message is logged with status `not_configured`
 * — it is never reported as sent.
 */
export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const db = createAdminClient();
  let body = args.text;
  if (args.marketing) {
    body += `\n\n—\nTo stop receiving these emails: ${unsubscribeUrl(args.to)}`;
  }

  const record = async (status: SendResult["status"], extra: { provider_message_id?: string; error?: string } = {}) => {
    await db.from("email_messages").insert({
      to_email: args.to.toLowerCase(),
      subject: args.subject,
      body,
      status,
      context: args.context,
      related_id: args.relatedId ?? null,
      sent_at: status === "sent" ? new Date().toISOString() : null,
      ...extra,
    });
  };

  if (args.marketing && (await isSuppressed(args.to))) {
    await record("suppressed");
    return { status: "suppressed" };
  }

  if (!emailConfigured()) {
    await record("not_configured", { error: "Email provider not configured (RESEND_API_KEY / EMAIL_FROM)" });
    return { status: "not_configured" };
  }

  const res = await httpJson<{ id?: string; message?: string }>("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${serverEnv("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: serverEnv("EMAIL_FROM"),
      to: [args.to],
      subject: args.subject,
      text: body,
      reply_to: args.replyTo,
      headers: args.marketing ? { "List-Unsubscribe": `<${unsubscribeUrl(args.to)}>` } : undefined,
    }),
  });

  if (res.ok && res.data?.id) {
    await record("sent", { provider_message_id: res.data.id });
    return { status: "sent", id: res.data.id };
  }
  const error = res.data?.message || `HTTP ${res.status}`;
  logger.error("email_send_failed", { status: res.status, context: args.context });
  await record("failed", { error });
  return { status: "failed", error };
}
