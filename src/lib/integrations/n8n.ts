import "server-only";
import { serverEnv } from "@/lib/env";
import { httpJson } from "./http";
import { hmacHex } from "@/lib/crypto";

export function n8nConfigured() {
  return Boolean(serverEnv("N8N_BASE_URL") && serverEnv("N8N_API_KEY"));
}

function base() {
  return serverEnv("N8N_BASE_URL")!.replace(/\/$/, "");
}
function headers() {
  return { "X-N8N-API-KEY": serverEnv("N8N_API_KEY")!, "Content-Type": "application/json", Accept: "application/json" };
}

export async function listWorkflows() {
  return httpJson<{ data: { id: string; name: string; active: boolean }[] }>(`${base()}/api/v1/workflows?limit=100`, {
    headers: headers(),
  });
}

export async function setWorkflowActive(id: string, active: boolean) {
  return httpJson(`${base()}/api/v1/workflows/${encodeURIComponent(id)}/${active ? "activate" : "deactivate"}`, {
    method: "POST",
    headers: headers(),
  });
}

/** Creates a generic header-auth credential in n8n from a decrypted secret (never sent to browsers). */
export async function createHeaderCredential(name: string, headerName: string, value: string) {
  return httpJson<{ id: string }>(`${base()}/api/v1/credentials`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ name, type: "httpHeaderAuth", data: { name: headerName, value } }),
  });
}

/**
 * Sends a signed test payload to an automation's test webhook URL.
 * The workflow should detect `test: true` and avoid contacting real customers.
 */
export async function sendTestWebhook(url: string, payload: Record<string, unknown>) {
  const body = JSON.stringify({ ...payload, test: true, sent_at: new Date().toISOString() });
  const secret = serverEnv("AUTOMATION_WEBHOOK_SECRET");
  const ts = Math.floor(Date.now() / 1000).toString();
  const h: Record<string, string> = { "Content-Type": "application/json", "X-Kairo-Test": "true", "X-Kairo-Timestamp": ts };
  if (secret) h["X-Kairo-Signature"] = `sha256=${hmacHex(secret, `${ts}.${body}`)}`;
  return httpJson(url, { method: "POST", headers: h, body, timeoutMs: 20000 });
}
