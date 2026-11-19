import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/env";

export type Role = "customer" | "staff" | "admin";
export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: Role;
  organization_id: string | null;
  marketing_consent: boolean;
};

/** Returns the authenticated user + profile, or null. Cached per request. */
export const getSession = cache(async () => {
  if (!hasSupabase()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,email,full_name,phone,role,organization_id,marketing_consent")
    .eq("id", user.id)
    .single<Profile>();
  if (!profile) return null;
  return { user, profile, supabase };
});

export async function requireUser(next = "/portal") {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(next)}`);
  return session;
}

export function isStaffRole(role: Role) {
  return role === "staff" || role === "admin";
}

export async function requireStaff() {
  const session = await requireUser("/admin");
  if (!isStaffRole(session.profile.role)) redirect("/portal");
  return session;
}

export async function requireAdmin() {
  const session = await requireUser("/admin");
  if (session.profile.role !== "admin") redirect("/admin");
  return session;
}

/** For server actions: throws instead of redirecting, so callers can return errors. */
export async function assertStaff() {
  const session = await getSession();
  if (!session || !isStaffRole(session.profile.role)) throw new Error("Not authorised");
  return session;
}
export async function assertAdmin() {
  const session = await getSession();
  if (!session || session.profile.role !== "admin") throw new Error("Not authorised");
  return session;
}
