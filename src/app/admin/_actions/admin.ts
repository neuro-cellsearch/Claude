"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin, assertStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { expenseSchema, fieldErrors, type ActionState } from "@/lib/validation";
import { INTEGRATIONS } from "@/lib/integrations/registry";

const uuid = z.string().uuid();

// ---------- Expenses ----------
export async function saveExpense(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await assertAdmin();
  const parsed = expenseSchema.safeParse({ ...Object.fromEntries(fd), is_cost_of_delivery: fd.get("is_cost_of_delivery") === "on" });
  if (!parsed.success) return { error: "Please check the fields.", fieldErrors: fieldErrors(parsed.error) };
  const { amount, ...rest } = parsed.data;
  const row = { ...rest, amount_pence: Math.round(amount * 100), end_date: rest.end_date ?? null, notes: rest.notes ?? null };
  const id = String(fd.get("id") ?? "");
  const db = createAdminClient();
  const res = id ? await db.from("expenses").update(row).eq("id", uuid.parse(id)) : await db.from("expenses").insert(row);
  if (res.error) return { error: res.error.message };
  await audit(user.id, id ? "expense.updated" : "expense.created", "expense", id || undefined, { name: row.name, amount_pence: row.amount_pence });
  revalidatePath("/admin/finance");
  revalidatePath("/admin");
  return { ok: true, message: "Expense saved." };
}

export async function deleteExpense(fd: FormData) {
  const { user } = await assertAdmin();
  const id = uuid.parse(fd.get("id"));
  await createAdminClient().from("expenses").delete().eq("id", id);
  await audit(user.id, "expense.deleted", "expense", id);
  revalidatePath("/admin/finance");
}

export async function seedTypicalExpenses(fd: FormData) {
  void fd;
  const { user } = await assertAdmin();
  const db = createAdminClient();
  const { count } = await db.from("expenses").select("id", { count: "exact", head: true });
  if (count) return;
  const today = new Date().toISOString().slice(0, 10);
  const est = "ESTIMATE — replace with your actual cost";
  await db.from("expenses").insert([
    { name: "Hosting (Vercel Pro)", category: "software", amount_pence: 1600, frequency: "monthly", is_cost_of_delivery: false, start_date: today, notes: est },
    { name: "Supabase Pro", category: "software", amount_pence: 2000, frequency: "monthly", is_cost_of_delivery: false, start_date: today, notes: est },
    { name: "n8n VPS (self-hosted)", category: "software", amount_pence: 1500, frequency: "monthly", is_cost_of_delivery: true, start_date: today, notes: est },
    { name: "OpenAI API usage", category: "ai_api", amount_pence: 6000, frequency: "monthly", is_cost_of_delivery: true, start_date: today, notes: est },
    { name: "Twilio numbers, SMS & voice", category: "ai_api", amount_pence: 4000, frequency: "monthly", is_cost_of_delivery: true, start_date: today, notes: est },
    { name: "Email (Resend)", category: "software", amount_pence: 1600, frequency: "monthly", is_cost_of_delivery: false, start_date: today, notes: est },
    { name: "Google Workspace", category: "software", amount_pence: 1400, frequency: "monthly", is_cost_of_delivery: false, start_date: today, notes: est },
    { name: "Professional indemnity & cyber insurance", category: "other", amount_pence: 60000, frequency: "annual", is_cost_of_delivery: false, start_date: today, notes: est },
    { name: "Accountant", category: "other", amount_pence: 12000, frequency: "monthly", is_cost_of_delivery: false, start_date: today, notes: est },
    { name: "ICO data protection fee", category: "other", amount_pence: 5200, frequency: "annual", is_cost_of_delivery: false, start_date: today, notes: est },
    { name: "Marketing & lead generation", category: "marketing", amount_pence: 50000, frequency: "monthly", is_cost_of_delivery: false, start_date: today, notes: est },
  ]);
  await audit(user.id, "expense.seeded_estimates", "expense");
  revalidatePath("/admin/finance");
}

// ---------- Content (case studies & testimonials) ----------
export async function saveCaseStudy(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await assertStaff();
  const parsed = z.object({
    client_name: z.string().trim().min(2).max(160), industry: z.string().trim().min(2).max(60), headline: z.string().trim().min(5).max(200),
    challenge: z.string().trim().min(10).max(4000), solution: z.string().trim().min(10).max(4000), results: z.string().trim().min(10).max(4000),
  }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Please complete every field.", fieldErrors: fieldErrors(parsed.error) };
  const permission = fd.get("client_permission") === "on";
  const publish = fd.get("published") === "on";
  if (publish && !permission) return { error: "You can only publish with the client's written permission." };
  const slug = parsed.data.client_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60) + "-" + Date.now().toString(36);
  const { error } = await createAdminClient().from("case_studies").insert({ ...parsed.data, slug, client_permission: permission, published: publish });
  if (error) return { error: error.message };
  await audit(user.id, "case_study.created", "case_study", slug, { published: publish });
  revalidatePath("/admin/content"); revalidatePath("/case-studies");
  return { ok: true, message: "Case study saved." };
}

export async function saveTestimonial(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await assertStaff();
  const parsed = z.object({ author_name: z.string().trim().min(2).max(160), author_role: z.string().max(160).optional(), company: z.string().max(160).optional(), quote: z.string().trim().min(10).max(1500) }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Please check the fields.", fieldErrors: fieldErrors(parsed.error) };
  const permission = fd.get("client_permission") === "on";
  const publish = fd.get("published") === "on";
  if (publish && !permission) return { error: "Only publish testimonials the client has given permission to use, word for word." };
  const { error } = await createAdminClient().from("testimonials").insert({ ...parsed.data, client_permission: permission, published: publish });
  if (error) return { error: error.message };
  await audit(user.id, "testimonial.created", "testimonial", undefined, { published: publish });
  revalidatePath("/admin/content"); revalidatePath("/");
  return { ok: true, message: "Testimonial saved." };
}

export async function toggleContent(fd: FormData) {
  const { user } = await assertStaff();
  const table = z.enum(["case_studies", "testimonials"]).parse(fd.get("table"));
  const id = uuid.parse(fd.get("id"));
  const op = z.enum(["publish", "unpublish", "delete"]).parse(fd.get("op"));
  const db = createAdminClient();
  if (op === "delete") await db.from(table).delete().eq("id", id);
  else await db.from(table).update({ published: op === "publish" }).eq("id", id).eq("client_permission", true);
  await audit(user.id, `${table}.${op}`, table, id);
  revalidatePath("/admin/content"); revalidatePath("/"); revalidatePath("/case-studies");
}

// ---------- Settings ----------
export async function setUserRole(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await assertAdmin();
  const email = z.string().trim().toLowerCase().email().safeParse(fd.get("email"));
  const role = z.enum(["customer", "staff", "admin"]).safeParse(fd.get("role"));
  if (!email.success || !role.success) return { error: "Enter a valid email and role." };
  const db = createAdminClient();
  const { data: target } = await db.from("profiles").select("id, role").ilike("email", email.data).maybeSingle();
  if (!target) return { error: "No account with that email. They must register first." };
  if (target.id === user.id && role.data !== "admin") {
    const { count } = await db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) <= 1) return { error: "You're the only admin — promote someone else first." };
  }
  await db.from("profiles").update({ role: role.data }).eq("id", target.id);
  await audit(user.id, "profile.role_changed", "profile", target.id, { from: target.role, to: role.data });
  revalidatePath("/admin/settings");
  return { ok: true, message: `${email.data} is now ${role.data}.` };
}

export async function updateDataRequest(fd: FormData) {
  const { user } = await assertAdmin();
  const id = uuid.parse(fd.get("id"));
  const status = z.enum(["received", "in_progress", "completed", "rejected"]).parse(fd.get("status"));
  const notes = String(fd.get("notes") ?? "").slice(0, 2000) || null;
  await createAdminClient().from("data_requests").update({ status, notes, completed_at: ["completed", "rejected"].includes(status) ? new Date().toISOString() : null }).eq("id", id);
  await audit(user.id, "data_request.updated", "data_request", id, { status });
  revalidatePath("/admin/settings");
}

export async function markNotificationsRead() {
  await assertStaff();
  await createAdminClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("audience", "staff").is("read_at", null);
  revalidatePath("/admin");
}

export async function updatePlanPricing(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await assertAdmin();
  const parsed = z.object({ id: z.enum(["starter", "growth", "premium"]), setup: z.coerce.number().min(0).max(100000), monthly: z.coerce.number().min(0).max(100000) }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Invalid pricing." };
  await createAdminClient().from("plans").update({ setup_fee_pence: Math.round(parsed.data.setup * 100), monthly_pence: Math.round(parsed.data.monthly * 100) }).eq("id", parsed.data.id);
  await audit(user.id, "plan.pricing_changed", "plan", parsed.data.id, parsed.data);
  revalidatePath("/admin/settings"); revalidatePath("/pricing"); revalidatePath("/");
  return { ok: true, message: "Pricing updated. New checkouts use the new price; existing subscriptions are unchanged." };
}

// ---------- Integrations ----------
export async function testIntegration(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await assertAdmin();
  const id = String(fd.get("id"));
  const integration = INTEGRATIONS.find((i) => i.id === id);
  if (!integration) return { error: "Unknown integration." };
  try {
    const r = await integration.test();
    await audit(user.id, "integration.tested", "integration", id, { ok: r.ok });
    return r.ok ? { ok: true, message: `✓ ${r.detail}` } : { error: r.detail };
  } catch (err) {
    return { error: `Test failed: ${(err as Error).message}` };
  }
}
