import "server-only";
import { requireUser } from "@/lib/auth";

export type Organization = {
  id: string; name: string; industry: string | null; website: string | null; phone: string | null; address: string | null;
  company_number: string | null; employee_count: string | null; description: string | null; business_hours: string | null;
  faq_knowledge: string | null; status: string; stripe_customer_id: string | null; onboarding_submitted_at: string | null; created_at: string;
};

export async function getPortalContext() {
  const session = await requireUser("/portal");
  const { supabase, profile } = session;
  let org: Organization | null = null;
  if (profile.organization_id) {
    const { data } = await supabase.from("organizations").select("*").eq("id", profile.organization_id).single<Organization>();
    org = data;
  }
  return { ...session, org };
}
