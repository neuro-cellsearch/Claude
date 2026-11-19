import { NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/sales/enquiries";
import { hasServiceRole } from "@/lib/env";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasServiceRole()) return NextResponse.json({ error: "Booking database not configured" }, { status: 503 });
  try {
    return NextResponse.json({ slots: await getAvailableSlots(), timezone: "Europe/London" });
  } catch (err) {
    logger.error("slots_failed", { err });
    return NextResponse.json({ error: "Could not load availability" }, { status: 500 });
  }
}
