import { z } from "zod";

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));
export const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);
export const ukPhone = z
  .string()
  .trim()
  .max(30)
  .regex(/^[+()0-9\s-]{7,30}$/, "Enter a valid phone number")
  .optional()
  .or(z.literal("").transform(() => undefined));

const httpUrl = z
  .string()
  .trim()
  .max(300)
  .regex(/^https?:\/\/[^\s]+$/i, "Enter a full URL starting with https://")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const BUDGETS = ["under_300", "300_750", "750_1500", "over_1500", "unsure"] as const;
export const VOLUMES = ["under_25", "25_100", "100_500", "500_plus", "unsure"] as const;

export const enquirySchema = z.object({
  type: z.enum(["contact", "quote", "consultation"]),
  name: trimmed(120).min(2, "Please enter your name"),
  email,
  phone: ukPhone,
  company: optionalText(160),
  role: optionalText(120),
  industry: optionalText(60),
  message: optionalText(4000),
  services: z.array(z.string().max(60)).max(10).default([]),
  budget: z.enum(BUDGETS).optional(),
  monthlyEnquiries: z.enum(VOLUMES).optional(),
  marketingConsent: z.boolean().default(false),
  privacyAccepted: z.literal(true, { message: "Please confirm you have read the privacy policy" }),
  // honeypot — must be empty
  website: z.string().max(0).optional().or(z.literal("")),
  slot: z.string().datetime().optional(),
});
export type EnquiryInput = z.infer<typeof enquirySchema>;

export const registerSchema = z.object({
  fullName: trimmed(120).min(2, "Please enter your name"),
  companyName: trimmed(160).min(2, "Please enter your company name"),
  industry: optionalText(60),
  email,
  password: z
    .string()
    .min(10, "Use at least 10 characters")
    .max(128)
    .regex(/[A-Za-z]/, "Include at least one letter")
    .regex(/[0-9]/, "Include at least one number"),
  marketingConsent: z.boolean().default(false),
  termsAccepted: z.literal(true, { message: "Please accept the terms and privacy policy" }),
});

export const loginSchema = z.object({ email, password: z.string().min(1, "Enter your password").max(128) });

export const businessInfoSchema = z.object({
  name: trimmed(200).min(1),
  industry: optionalText(60),
  website: z.string().trim().url("Enter a full URL including https://").max(300).optional().or(z.literal("").transform(() => undefined)),
  phone: ukPhone,
  address: optionalText(400),
  company_number: optionalText(20),
  employee_count: optionalText(30),
  description: optionalText(3000),
  business_hours: optionalText(1000),
});

export const knowledgeSchema = z.object({ faq_knowledge: trimmed(20000).min(20, "Please add at least a few FAQs") });

export const credentialSchema = z.object({
  provider: trimmed(60).min(2),
  label: trimmed(120).min(2),
  secret: z.string().min(4, "Enter the credential").max(5000),
});

export const ticketSchema = z.object({
  subject: trimmed(200).min(4, "Add a short subject"),
  body: trimmed(5000).min(10, "Describe the issue in a little more detail"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
});

export const automationRequestSchema = z.object({
  service_key: trimmed(60).min(2),
  description: trimmed(4000).min(15, "Tell us a little more about what you need"),
});

export const prospectSchema = z.object({
  company_name: trimmed(200).min(2),
  industry: optionalText(60),
  website: httpUrl,
  entity_type: z.enum(["limited_company", "llp", "plc", "scottish_partnership", "public_body", "sole_trader", "partnership", "unknown"]),
  company_number: optionalText(20),
  contact_name: optionalText(120),
  contact_role: optionalText(120),
  business_email: email.optional().or(z.literal("").transform(() => undefined)),
  business_phone: ukPhone,
  linkedin_url: httpUrl,
  source: trimmed(300).min(3, "Record where this business contact information came from"),
  lia_notes: optionalText(2000),
  notes: optionalText(2000),
});

export const expenseSchema = z.object({
  name: trimmed(160).min(2),
  category: z.enum(["software", "ai_api", "marketing", "labour", "contractors", "other"]),
  amount: z.coerce.number().min(0).max(1_000_000),
  frequency: z.enum(["monthly", "annual", "one_off"]),
  is_cost_of_delivery: z.boolean().default(false),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("").transform(() => undefined)),
  notes: optionalText(1000),
});

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export type ActionState = { ok?: boolean; error?: string; message?: string; fieldErrors?: Record<string, string> } | null;
