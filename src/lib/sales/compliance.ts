/** UK outreach eligibility rules (PECR + UK GDPR). Pure functions so they can be unit tested. */
export const CORPORATE_ENTITIES = ["limited_company", "llp", "plc", "scottish_partnership", "public_body"] as const;
export const TPS_VALIDITY_DAYS = 28;

export type ProspectForCheck = {
  entity_type: string;
  business_email: string | null;
  business_phone: string | null;
  linkedin_url: string | null;
  status: string;
  tps_checked_at: string | null;
  tps_registered: boolean | null;
  approved_at: string | null;
};

export function outreachEligibility(p: ProspectForCheck, channel: "email" | "linkedin" | "phone", suppressed: boolean, now = new Date()): { ok: boolean; reason?: string } {
  if (suppressed) return { ok: false, reason: "On suppression list" };
  if (p.status === "do_not_contact" || p.status === "not_interested") return { ok: false, reason: `Status is ${p.status.replace(/_/g, " ")}` };
  if (!p.approved_at) return { ok: false, reason: "Prospect not approved" };
  if (channel === "email") {
    if (!p.business_email) return { ok: false, reason: "No business email" };
    if (!(CORPORATE_ENTITIES as readonly string[]).includes(p.entity_type)) {
      return { ok: false, reason: "PECR: unsolicited email needs prior consent for sole traders, non-Scottish partnerships or unknown entity types" };
    }
  }
  if (channel === "phone") {
    if (!p.business_phone) return { ok: false, reason: "No business phone" };
    if (!p.tps_checked_at) return { ok: false, reason: "Number not screened against TPS/CTPS" };
    const age = (now.getTime() - new Date(p.tps_checked_at).getTime()) / 86400_000;
    if (age > TPS_VALIDITY_DAYS) return { ok: false, reason: `TPS/CTPS screening older than ${TPS_VALIDITY_DAYS} days` };
    if (p.tps_registered) return { ok: false, reason: "Registered with TPS/CTPS" };
  }
  if (channel === "linkedin" && !p.linkedin_url) return { ok: false, reason: "No LinkedIn profile URL" };
  return { ok: true };
}
