import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { hmacHex, safeEqual } from "@/lib/crypto";
import { serverEnv, hasServiceRole } from "@/lib/env";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({
  automation_id: z.string().uuid(),
  event_type: z.string().min(1).max(60).regex(/^[a-z0-9_.-]+$/),
  summary: z.string().min(1).max(500),
  occurred_at: z.string().datetime().optional(),
  external_event_id: z.string().max(200).optional(),
  test: z.boolean().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  lead: z.object({
    name: z.string().max(160).optional(), email: z.string().email().max(254).optional(), phone: z.string().max(40).optional(),
    source: z.string().max(80).optional(), enquiry: z.string().max(4000).optional(), score: z.number().int().min(0).max(100).optional(),
    estimated_value_pence: z.number().int().min(0).optional(),
  }).optional(),
  appointment: z.object({
    title: z.string().min(1).max(200), starts_at: z.string().datetime(), ends_at: z.string().datetime().optional(),
    status: z.enum(["booked", "confirmed", "rescheduled", "cancelled", "completed", "no_show"]).default("booked"),
    attendee_name: z.string().max(160).optional(), attendee_contact: z.string().max(254).optional(), external_id: z.string().max(200).optional(),
  }).optional(),
});

/**
 * Inbound activity from automation engines (n8n / Make / voice platforms).
 * Authenticated with HMAC-SHA256 over `${timestamp}.${rawBody}` using AUTOMATION_WEBHOOK_SECRET.
 * Only ACTIVE automations may record live activity; test events are accepted only while testing.
 */
export async function POST(req: Request) {
  const secret = serverEnv("AUTOMATION_WEBHOOK_SECRET");
  if (!secret || !hasServiceRole()) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const raw = await req.text();
  if (raw.length > 64_000) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  const ts = req.headers.get("x-kairo-timestamp") ?? "";
  const sig = (req.headers.get("x-kairo-signature") ?? "").replace(/^sha256=/, "");
  const age = Math.abs(Date.now() / 1000 - Number(ts));
  if (!ts || !Number.isFinite(age) || age > 300) return NextResponse.json({ error: "stale_or_missing_timestamp" }, { status: 401 });
  if (!sig || !safeEqual(sig, hmacHex(secret, `${ts}.${raw}`))) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });

  let json: unknown;
  try { json = JSON.parse(raw); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  const e = parsed.data;

  if (!(await rateLimit(`events:${e.automation_id}`, 600, 60))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const db = createAdminClient();
  const { data: automation } = await db.from("automations").select("id, organization_id, status").eq("id", e.automation_id).maybeSingle();
  if (!automation) return NextResponse.json({ error: "unknown_automation" }, { status: 404 });
  const allowed = e.test ? ["testing", "awaiting_approval", "active", "in_build"].includes(automation.status) : automation.status === "active";
  if (!allowed) return NextResponse.json({ error: `automation_not_active (status: ${automation.status})` }, { status: 409 });

  const orgId = automation.organization_id;
  let leadId: string | null = null;
  if (e.lead && !e.test) {
    const { data } = await db.from("customer_leads").insert({ organization_id: orgId, automation_id: automation.id, ...e.lead }).select("id").single();
    leadId = data?.id ?? null;
  }
  if (e.appointment && !e.test) {
    const a = e.appointment;
    if (a.external_id) {
      await db.from("appointments").upsert({ organization_id: orgId, lead_id: leadId, source: e.event_type, ...a }, { onConflict: "organization_id,external_id" });
    } else {
      await db.from("appointments").insert({ organization_id: orgId, lead_id: leadId, source: e.event_type, ...a });
    }
  }
  const { error } = await db.from("automation_events").insert({
    organization_id: orgId, automation_id: automation.id, event_type: e.test ? `test.${e.event_type}` : e.event_type,
    summary: e.test ? `[TEST] ${e.summary}` : e.summary, payload: e.payload ?? null,
    occurred_at: e.occurred_at ?? new Date().toISOString(), external_event_id: e.external_event_id ?? null,
  });
  if (error?.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
  if (error) {
    logger.error("automation_event_insert_failed", { error: error.message });
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, lead_id: leadId });
}
