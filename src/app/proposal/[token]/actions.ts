"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyStaff } from "@/lib/integrations/notify";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { hashIp } from "@/lib/crypto";
import type { ActionState } from "@/lib/validation";

export async function acceptProposal(_p: ActionState, fd: FormData): Promise<ActionState> {
  const token = z.string().regex(/^[a-f0-9]{64}$/).safeParse(fd.get("token"));
  const name = z.string().trim().min(2, "Type your full name to accept").max(160).safeParse(fd.get("accepted_name"));
  if (!token.success) return { error: "Invalid proposal link." };
  if (!name.success) return { error: name.error.issues[0].message };
  if (fd.get("authority") !== "on") return { error: "Please confirm you're authorised to accept on behalf of the business." };
  const ipHash = hashIp(await clientIp());
  if (!(await rateLimit(`accept:${ipHash}`, 10, 3600))) return { error: "Too many attempts." };
  const db = createAdminClient();
  const { data: q } = await db.from("quotes").select("*").eq("public_token", token.data).single();
  if (!q) return { error: "Proposal not found." };
  if (q.status !== "sent") return { error: q.status === "accepted" ? "This proposal has already been accepted." : `This proposal is ${q.status} and can't be accepted.` };
  if (q.valid_until && q.valid_until < new Date().toISOString().slice(0, 10)) return { error: "This proposal has expired. Please contact us for an updated one." };
  await db.from("quotes").update({ status: "accepted", accepted_name: name.data, accepted_at: new Date().toISOString() }).eq("id", q.id).eq("status", "sent");
  if (q.enquiry_id) {
    await db.from("enquiries").update({ stage: "won" }).eq("id", q.enquiry_id);
    await db.from("crm_activities").insert({ enquiry_id: q.enquiry_id, type: "system", body: `Proposal ${q.number} accepted by ${name.data}` });
  }
  await audit(null, "quote.accepted", "quote", q.id, { name: name.data, ipHash });
  await notifyStaff(`Proposal accepted: ${q.company || q.recipient_name}`, `${name.data} accepted ${q.number} (${(q.monthly_total_pence / 100).toFixed(0)}/month).`, `/admin/quotes/${q.id}`);
  revalidatePath(`/proposal/${token.data}`);
  return { ok: true, message: "Accepted — thank you!" };
}
