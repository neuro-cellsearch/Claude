"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertStaff, assertAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { n8nConfigured, sendTestWebhook, setWorkflowActive, createHeaderCredential } from "@/lib/integrations/n8n";
import { decryptSecret } from "@/lib/crypto";
import { notifyOrganization } from "@/lib/integrations/notify";
import type { ActionState } from "@/lib/validation";
import { logger } from "@/lib/logger";

const uuid = z.string().uuid();

function refresh(orgId?: string) {
  revalidatePath("/admin/automations");
  revalidatePath("/admin/onboarding");
  if (orgId) revalidatePath(`/admin/customers/${orgId}`);
}

export async function updateOrgStatus(fd: FormData) {
  const { user } = await assertStaff();
  const id = uuid.parse(fd.get("id"));
  const status = z.enum(["prospect", "onboarding", "active", "paused", "churned"]).parse(fd.get("status"));
  await createAdminClient().from("organizations").update({ status, churned_at: status === "churned" ? new Date().toISOString() : null }).eq("id", id);
  await audit(user.id, "organization.status", "organization", id, { status });
  refresh(id);
}

export async function createAutomation(fd: FormData) {
  const { user } = await assertStaff();
  const orgId = uuid.parse(fd.get("organization_id"));
  const v = z.object({ service_key: z.string().min(2).max(60), name: z.string().trim().min(2).max(160) }).parse({ service_key: fd.get("service_key"), name: fd.get("name") });
  await createAdminClient().from("automations").insert({ organization_id: orgId, ...v, status: "requested" });
  await audit(user.id, "automation.created", "organization", orgId, v);
  refresh(orgId);
}

export async function updateAutomationConfig(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await assertStaff();
  const id = uuid.parse(fd.get("id"));
  const parsed = z.object({
    provider: z.enum(["n8n", "make", "vapi", "retell", "custom"]),
    external_workflow_id: z.string().trim().max(200).optional(),
    test_webhook_url: z.string().trim().url().startsWith("https://", "Test webhook must use HTTPS").optional().or(z.literal("")),
    notes: z.string().max(4000).optional(),
  }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const db = createAdminClient();
  const { data: a } = await db.from("automations").select("organization_id, config").eq("id", id).single();
  if (!a) return { error: "Not found" };
  const config = { ...(a.config ?? {}), test_webhook_url: parsed.data.test_webhook_url || null, notes: parsed.data.notes || null };
  // Changing config invalidates previous tests & approval (DB trigger).
  await db.from("automations").update({ provider: parsed.data.provider, external_workflow_id: parsed.data.external_workflow_id || null, config }).eq("id", id);
  await audit(user.id, "automation.config_updated", "automation", id);
  refresh(a.organization_id);
  return { ok: true, message: "Configuration saved. Any previous test result and approval have been reset." };
}

const TRANSITIONS: Record<string, string[]> = {
  requested: ["in_build", "retired"],
  in_build: ["testing", "retired"],
  testing: ["in_build", "awaiting_approval", "failed"],
  awaiting_approval: ["testing", "in_build", "active"],
  active: ["paused"],
  paused: ["active", "in_build", "retired"],
  failed: ["in_build", "testing", "retired"],
  retired: [],
};

export async function moveAutomation(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, profile } = await assertStaff();
  const id = uuid.parse(fd.get("id"));
  const to = z.enum(["in_build", "testing", "awaiting_approval", "active", "paused", "failed", "retired"]).parse(fd.get("to"));
  const db = createAdminClient();
  const { data: a } = await db.from("automations").select("*").eq("id", id).single();
  if (!a) return { error: "Automation not found." };
  if (!TRANSITIONS[a.status]?.includes(to)) return { error: `Can't move from ${a.status} to ${to}.` };
  if (to === "awaiting_approval" && !a.test_passed) return { error: "Record a passing test before requesting approval." };
  if (to === "active") {
    if (profile.role !== "admin") return { error: "Only an administrator can activate automations." };
    if (!a.test_passed || !a.approved_at) return { error: "This automation needs a passing test and approval before it can be activated." };
  }

  // Keep the external engine in sync when we can control it.
  if ((to === "active" || to === "paused") && a.provider === "n8n" && a.external_workflow_id) {
    if (n8nConfigured()) {
      const res = await setWorkflowActive(a.external_workflow_id, to === "active");
      if (!res.ok) return { error: `n8n refused to ${to === "active" ? "activate" : "pause"} workflow ${a.external_workflow_id}: HTTP ${res.status}. Nothing changed.` };
    } else if (fd.get("confirm_manual") !== "on") {
      return { error: `n8n API isn't configured. ${to === "active" ? "Activate" : "Deactivate"} workflow ${a.external_workflow_id} in n8n yourself, then tick the confirmation box.` };
    }
  } else if (to === "active" && fd.get("confirm_manual") !== "on" && !(a.provider === "n8n" && a.external_workflow_id && n8nConfigured())) {
    return { error: `Confirm you have switched the workflow on in ${a.provider} (tick the box).` };
  }

  const patch: Record<string, unknown> = { status: to };
  if (to === "active") patch.activated_at = new Date().toISOString();
  const { error } = await db.from("automations").update(patch).eq("id", id);
  if (error) return { error: `Database rejected the change: ${error.message}` };
  await audit(user.id, `automation.${to}`, "automation", id, { from: a.status });
  if (to === "active") await notifyOrganization(a.organization_id, `${a.name} is live`, "Your automation has passed testing, been approved and is now active.", "/portal/services");
  if (to === "awaiting_approval") await db.from("onboarding_tasks").update({ status: "done", completed_at: new Date().toISOString() }).eq("organization_id", a.organization_id).eq("key", "test");
  if (to === "active") await db.from("onboarding_tasks").update({ status: "done", completed_at: new Date().toISOString() }).eq("organization_id", a.organization_id).in("key", ["approval", "go_live", "build"]);
  refresh(a.organization_id);
  return { ok: true, message: `Moved to ${to.replace("_", " ")}.` };
}

export async function approveAutomation(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await assertAdmin();
  const id = uuid.parse(fd.get("id"));
  const db = createAdminClient();
  const { data: a } = await db.from("automations").select("organization_id, status, test_passed").eq("id", id).single();
  if (!a) return { error: "Not found" };
  if (a.status !== "awaiting_approval" || !a.test_passed) return { error: "Only tested automations awaiting approval can be approved." };
  await db.from("automations").update({ approved_at: new Date().toISOString(), approved_by: user.id }).eq("id", id);
  await audit(user.id, "automation.approved", "automation", id);
  refresh(a.organization_id);
  return { ok: true, message: "Approved. You can now activate it." };
}

export async function runLiveTest(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await assertStaff();
  const id = uuid.parse(fd.get("id"));
  const db = createAdminClient();
  const { data: a } = await db.from("automations").select("*").eq("id", id).single();
  if (!a) return { error: "Not found" };
  const url = (a.config as { test_webhook_url?: string })?.test_webhook_url;
  if (!url) return { error: "Set a test webhook URL in the configuration first, or record a manual test." };
  if (!["testing", "in_build", "failed"].includes(a.status)) return { error: "Move the automation to Testing first." };
  const started = Date.now();
  let passed = false; let result: Record<string, unknown>;
  try {
    const res = await sendTestWebhook(url, { automation_id: a.id, organization_id: a.organization_id, scenario: "standard_enquiry" });
    passed = res.ok;
    result = { http_status: res.status, response: res.text.slice(0, 1000), ms: Date.now() - started };
  } catch (err) {
    result = { error: (err as Error).message, ms: Date.now() - started };
  }
  await db.from("automation_tests").insert({ automation_id: id, ran_by: user.id, method: "live_webhook", passed, result, notes: `POST ${url}` });
  await db.from("automations").update({ test_passed: passed, last_tested_at: new Date().toISOString(), status: passed ? "testing" : "failed" }).eq("id", id);
  await audit(user.id, "automation.tested", "automation", id, { passed });
  refresh(a.organization_id);
  return passed ? { ok: true, message: `Test passed (HTTP ${result.http_status}, ${result.ms} ms). Verify the side-effects, then request approval.` } : { error: `Test failed: ${result.error ?? `HTTP ${result.http_status}`}` };
}

export async function recordManualTest(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await assertStaff();
  const id = uuid.parse(fd.get("id"));
  const notes = z.string().trim().min(20, "Describe what you tested and what happened (at least 20 characters).").max(4000).safeParse(fd.get("notes"));
  if (!notes.success) return { error: notes.error.issues[0].message };
  const passed = fd.get("passed") === "on";
  const db = createAdminClient();
  const { data: a } = await db.from("automations").select("organization_id, status").eq("id", id).single();
  if (!a) return { error: "Not found" };
  if (!["testing", "in_build", "failed"].includes(a.status)) return { error: "Move the automation to Testing first." };
  await db.from("automation_tests").insert({ automation_id: id, ran_by: user.id, method: "manual", passed, notes: notes.data });
  await db.from("automations").update({ test_passed: passed, last_tested_at: new Date().toISOString(), status: passed ? "testing" : "failed" }).eq("id", id);
  await audit(user.id, "automation.tested_manual", "automation", id, { passed });
  refresh(a.organization_id);
  return { ok: true, message: passed ? "Passing test recorded." : "Failed test recorded." };
}

export async function setTaskStatus(fd: FormData) {
  await assertStaff();
  const id = uuid.parse(fd.get("id"));
  const status = z.enum(["todo", "in_progress", "done", "blocked"]).parse(fd.get("status"));
  const db = createAdminClient();
  const { data } = await db.from("onboarding_tasks").update({ status, completed_at: status === "done" ? new Date().toISOString() : null }).eq("id", id).select("organization_id").single();
  refresh(data?.organization_id);
}

export async function seedTasks(fd: FormData) {
  await assertStaff();
  const orgId = uuid.parse(fd.get("organization_id"));
  await createAdminClient().rpc("seed_onboarding_tasks", { p_org: orgId });
  refresh(orgId);
}

export async function pushCredentialToN8n(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await assertAdmin();
  if (!n8nConfigured()) return { error: "n8n API isn't configured." };
  const id = uuid.parse(fd.get("id"));
  const header = z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9-]+$/).safeParse(fd.get("header_name") || "Authorization");
  const prefix = String(fd.get("prefix") ?? "Bearer ").slice(0, 20);
  if (!header.success) return { error: "Invalid header name." };
  const db = createAdminClient();
  const { data: c } = await db.from("integration_credentials").select("*, organizations(name)").eq("id", id).single();
  if (!c) return { error: "Not found" };
  try {
    // Decrypted only in server memory, sent directly to n8n over HTTPS, never returned.
    const secret = decryptSecret(c.secret_ciphertext);
    const res = await createHeaderCredential(`${(c.organizations as { name: string }).name} – ${c.label}`, header.data, `${prefix}${secret}`);
    if (!res.ok) return { error: `n8n rejected the credential: HTTP ${res.status}` };
    await audit(user.id, "credential.pushed_to_n8n", "integration_credential", id, { n8n_id: res.data?.id });
    return { ok: true, message: `Created n8n credential ${res.data?.id}. Select it in the workflow's HTTP node.` };
  } catch (err) {
    logger.error("credential_push_failed", { err });
    return { error: "Could not decrypt or push the credential." };
  }
}

export async function updateRequest(fd: FormData) {
  const { user } = await assertStaff();
  const id = uuid.parse(fd.get("id"));
  const status = z.enum(["submitted", "reviewing", "quoted", "approved", "declined", "built"]).parse(fd.get("status"));
  const admin_notes = String(fd.get("admin_notes") ?? "").slice(0, 2000) || null;
  await createAdminClient().from("automation_requests").update({ status, admin_notes }).eq("id", id);
  await audit(user.id, "automation_request.updated", "automation_request", id, { status });
  revalidatePath("/admin/automations");
}

// ---------- Support ----------
export async function staffReply(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await assertStaff();
  const id = uuid.parse(fd.get("ticket_id"));
  const body = z.string().trim().min(1).max(8000).safeParse(fd.get("body"));
  if (!body.success) return { error: "Write a message." };
  const internal = fd.get("internal") === "on";
  const db = createAdminClient();
  await db.from("ticket_messages").insert({ ticket_id: id, author_id: user.id, body: body.data, is_internal: internal });
  const { data: t } = await db.from("support_tickets").update({ status: internal ? undefined : "waiting_on_customer" }).eq("id", id).select("organization_id, subject").single();
  if (!internal && t) await notifyOrganization(t.organization_id, `Reply: ${t.subject}`, body.data.slice(0, 200), `/portal/support/${id}`);
  revalidatePath(`/admin/support/${id}`);
  return { ok: true, message: internal ? "Internal note added." : "Reply sent." };
}

export async function setTicketStatus(fd: FormData) {
  await assertStaff();
  const id = uuid.parse(fd.get("id"));
  const status = z.enum(["open", "in_progress", "waiting_on_customer", "resolved", "closed"]).parse(fd.get("status"));
  const priority = z.enum(["low", "normal", "high", "urgent"]).optional().parse(fd.get("priority") || undefined);
  await createAdminClient().from("support_tickets").update({ status, ...(priority ? { priority } : {}) }).eq("id", id);
  revalidatePath(`/admin/support/${id}`);
  revalidatePath("/admin/support");
}
