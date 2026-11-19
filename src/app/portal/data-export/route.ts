import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

/** GDPR data portability: everything this user can see, via their own RLS-scoped session. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!(await rateLimit(`export:${session.user.id}`, 5, 3600))) return NextResponse.json({ error: "Too many exports" }, { status: 429 });
  const sb = session.supabase;
  const tables = ["profiles", "organizations", "subscriptions", "payments", "automations", "automation_events", "customer_leads", "appointments", "onboarding_tasks", "automation_requests", "support_tickets", "ticket_messages", "data_requests"];
  const out: Record<string, unknown> = { exported_at: new Date().toISOString() };
  for (const t of tables) {
    const { data } = await sb.from(t).select("*").limit(50000);
    out[t] = data ?? [];
  }
  await audit(session.user.id, "gdpr.data_exported", "profile", session.user.id);
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="kairo-data-export.json"` },
  });
}
