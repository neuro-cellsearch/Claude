import { NextResponse } from "next/server";
import { hasServiceRole } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Liveness + database readiness probe for uptime monitoring. Reveals no configuration detail. */
export async function GET() {
  let database = "not_configured";
  if (hasServiceRole()) {
    const { error } = await createAdminClient().from("plans").select("id").limit(1);
    database = error ? "error" : "ok";
  }
  return NextResponse.json({ status: database === "error" ? "degraded" : "ok", database, time: new Date().toISOString() }, { status: database === "error" ? 503 : 200 });
}
