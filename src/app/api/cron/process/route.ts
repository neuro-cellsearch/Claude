import { NextResponse } from "next/server";
import { serverEnv, hasServiceRole } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { processDueSequences } from "@/lib/sales/sequences";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** Scheduled job: sends due follow-up emails, expires old quotes and purges rate-limit rows. */
async function handle(req: Request) {
  const secret = serverEnv("CRON_SECRET");
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  if (!hasServiceRole()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const db = createAdminClient();
  const sequences = await processDueSequences();
  const today = new Date().toISOString().slice(0, 10);
  const { data: expired } = await db.from("quotes").update({ status: "expired" }).eq("status", "sent").lt("valid_until", today).select("id");
  await db.rpc("purge_rate_limits");
  logger.info("cron_processed", { sequences, expiredQuotes: expired?.length ?? 0 });
  return NextResponse.json({ ok: true, sequences, expiredQuotes: expired?.length ?? 0 });
}

export const GET = handle;
export const POST = handle;
