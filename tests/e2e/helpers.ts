import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";

export function sql(query: string): string {
  return execFileSync("psql", [process.env.DATABASE_URL!, "-At", "-v", "ON_ERROR_STOP=1", "-c", query], { encoding: "utf8" }).trim();
}

export function signedHeaders(body: string, secret = process.env.AUTOMATION_WEBHOOK_SECRET!) {
  const ts = Math.floor(Date.now() / 1000).toString();
  return {
    "Content-Type": "application/json",
    "X-Kairo-Timestamp": ts,
    "X-Kairo-Signature": `sha256=${createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex")}`,
  };
}

export function unsubscribeToken(email: string) {
  return createHmac("sha256", `unsub:${process.env.ENCRYPTION_KEY}`).update(email.toLowerCase()).digest("hex").slice(0, 40);
}

export const RUN = Date.now().toString(36);
