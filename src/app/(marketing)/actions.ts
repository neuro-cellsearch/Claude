"use server";
import { enquirySchema, fieldErrors, type ActionState } from "@/lib/validation";
import { createEnquiry, SlotUnavailableError } from "@/lib/sales/enquiries";
import { rateLimit, rateLimitByIp } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { hashIp } from "@/lib/crypto";
import { hasServiceRole, site } from "@/lib/env";
import { logger } from "@/lib/logger";

export async function submitEnquiry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = {
    type: formData.get("type"),
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    company: formData.get("company") ?? "",
    role: formData.get("role") ?? "",
    industry: formData.get("industry") ?? "",
    message: formData.get("message") ?? "",
    services: formData.getAll("services").map(String),
    budget: formData.get("budget") || undefined,
    monthlyEnquiries: formData.get("monthlyEnquiries") || undefined,
    marketingConsent: formData.get("marketingConsent") === "on",
    privacyAccepted: formData.get("privacyAccepted") === "on",
    website: formData.get("website") ?? "",
    slot: formData.get("slot") || undefined,
  };

  // Honeypot: silently accept bots without storing anything.
  if (typeof raw.website === "string" && raw.website.length > 0) return { ok: true, message: "Thank you — we'll be in touch." };

  const parsed = enquirySchema.safeParse(raw);
  if (!parsed.success) return { error: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };

  if (!hasServiceRole()) {
    return { error: `Online enquiries are not yet connected. Please email us at ${site.email}.` };
  }

  const ip = await clientIp();
  const ipHash = hashIp(ip);
  if (!(await rateLimitByIp("enquiry", ipHash, 5, 600)) || !(await rateLimit(`enquiry-email:${hashIp(parsed.data.email)}`, 5, 3600))) {
    return { error: "Too many submissions from your connection. Please try again in a few minutes." };
  }

  const d = parsed.data;
  try {
    const res = await createEnquiry({
      type: d.type, name: d.name, email: d.email, phone: d.phone, company: d.company, role: d.role, industry: d.industry,
      message: d.message, services: d.services, budget: d.budget === "unsure" ? undefined : d.budget,
      monthlyEnquiries: d.monthlyEnquiries === "unsure" ? undefined : d.monthlyEnquiries,
      marketingConsent: d.marketingConsent, ipHash, slot: d.slot,
    });
    return {
      ok: true,
      message: res.consultationAt
        ? "Your consultation is booked. We've emailed a confirmation."
        : d.type === "quote"
          ? "Thank you — your request is with our team. Expect a reply within one working day."
          : "Thank you — we'll reply within one working day.",
    };
  } catch (err) {
    if (err instanceof SlotUnavailableError) return { error: err.message, fieldErrors: { slot: err.message } };
    logger.error("enquiry_failed", { err });
    return { error: `Something went wrong saving your enquiry. Please email ${site.email}.` };
  }
}
