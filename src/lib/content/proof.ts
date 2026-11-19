import { hasSupabase } from "@/lib/env";
import { createClient } from "@supabase/supabase-js";

export type Testimonial = { id: string; author_name: string; author_role: string | null; company: string | null; quote: string };
export type CaseStudy = { id: string; slug: string; client_name: string; industry: string; headline: string; challenge: string; solution: string; results: string };

function anon() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
}

/** Only testimonials marked published (which the DB only allows with client permission). */
export async function getPublishedTestimonials(): Promise<Testimonial[]> {
  if (!hasSupabase()) return [];
  const { data } = await anon().from("testimonials").select("id,author_name,author_role,company,quote").eq("published", true).limit(6);
  return data ?? [];
}

export async function getPublishedCaseStudies(): Promise<CaseStudy[]> {
  if (!hasSupabase()) return [];
  const { data } = await anon().from("case_studies").select("id,slug,client_name,industry,headline,challenge,solution,results").eq("published", true).order("created_at", { ascending: false });
  return data ?? [];
}
