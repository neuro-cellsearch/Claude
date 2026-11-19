import { hasSupabase } from "@/lib/env";

export type Plan = {
  id: "starter" | "growth" | "premium" | "enterprise";
  name: string;
  setup_fee_pence: number;
  monthly_pence: number;
  description: string;
  features: string[];
};

/** Static mirror of the seeded `plans` table — used as a fallback before the DB is configured. */
export const STATIC_PLANS: Plan[] = [
  {
    id: "starter", name: "Starter", setup_fee_pence: 49900, monthly_pence: 29900,
    description: "One focused automation to stop enquiries slipping through the cracks.",
    features: ["One core automation workflow", "Website lead capture", "Basic AI chatbot trained on your approved FAQs", "Instant new-lead notifications", "Monthly performance report", "Email support"],
  },
  {
    id: "growth", name: "Growth", setup_fee_pence: 99900, monthly_pence: 79900,
    description: "A connected lead-to-booking system for businesses ready to scale.",
    features: ["Up to 4 automation workflows", "Advanced AI chatbot with lead qualification", "CRM integration (HubSpot or existing CRM)", "Appointment booking with reminders", "Automated follow-up sequences", "Monthly optimisation review", "Priority email support"],
  },
  {
    id: "premium", name: "Premium", setup_fee_pence: 199900, monthly_pence: 149900,
    description: "Full front-office automation including AI voice reception where supported.",
    features: ["Up to 10 automation workflows", "AI receptionist (where telephony supported)", "Multiple workflow and app integrations", "Advanced CRM automation and pipeline reporting", "Performance analytics dashboard", "Quarterly strategy session", "Priority support with 4-hour response target"],
  },
  {
    id: "enterprise", name: "Enterprise", setup_fee_pence: 0, monthly_pence: 0,
    description: "Custom scope, volumes, SLAs and integrations — quoted individually.",
    features: ["Custom workflow scope", "Multi-site and multi-team setups", "Custom SLAs", "Dedicated implementation lead"],
  },
];

/** Reads live plan pricing from the database, falling back to static values. */
export async function getPlans(): Promise<Plan[]> {
  if (!hasSupabase()) return STATIC_PLANS;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { data, error } = await sb
      .from("plans")
      .select("id,name,setup_fee_pence,monthly_pence,description,features")
      .eq("is_public", true)
      .order("sort_order");
    if (error || !data?.length) return STATIC_PLANS;
    return data as Plan[];
  } catch {
    return STATIC_PLANS;
  }
}
