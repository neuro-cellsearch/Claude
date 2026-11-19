import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { audit } from "@/lib/audit";

function csvCell(v: unknown) {
  let s = v === null || v === undefined ? "" : String(v);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { data, error } = await session.supabase
    .from("customer_leads")
    .select("created_at,name,email,phone,source,status,score,enquiry,notes")
    .order("created_at", { ascending: false })
    .limit(10000);
  if (error) return NextResponse.json({ error: "Export failed" }, { status: 500 });
  const header = ["created_at", "name", "email", "phone", "source", "status", "score", "enquiry", "notes"];
  const rows = (data ?? []).map((r) => header.map((h) => csvCell((r as Record<string, unknown>)[h])).join(","));
  await audit(session.user.id, "leads.exported", "organization", session.profile.organization_id ?? undefined, { rows: rows.length });
  return new NextResponse([header.join(","), ...rows].join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
