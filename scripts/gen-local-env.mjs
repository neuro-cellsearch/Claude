#!/usr/bin/env node
// Generates .env.local for the LOCAL docker stack: signs anon/service_role JWTs with the
// local JWT secret and creates a random encryption key. Never use these values in production.
import { createHmac, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const secret = process.env.LOCAL_JWT_SECRET || "local-dev-jwt-secret-change-me-at-least-32-chars";
const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
const sign = (payload) => {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64(payload);
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
};
const iat = Math.floor(Date.now() / 1000);
const exp = iat + 60 * 60 * 24 * 365 * 5;
const anon = sign({ iss: "supabase-local", role: "anon", iat, exp });
const service = sign({ iss: "supabase-local", role: "service_role", iat, exp });

if (existsSync(".env.local") && !process.argv.includes("--force")) {
  console.error(".env.local already exists. Re-run with --force to overwrite.");
  process.exit(1);
}
let template = readFileSync(".env.example", "utf8");
const set = (k, v) => {
  const re = new RegExp(`^${k}=.*$`, "m");
  template = re.test(template) ? template.replace(re, `${k}=${v}`) : template + `\n${k}=${v}`;
};
set("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
set("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
set("NEXT_PUBLIC_SUPABASE_ANON_KEY", anon);
set("SUPABASE_SERVICE_ROLE_KEY", service);
set("DATABASE_URL", "postgres://postgres:local-dev-password@localhost:54322/postgres");
set("ENCRYPTION_KEY", randomBytes(32).toString("base64"));
set("AUTOMATION_WEBHOOK_SECRET", randomBytes(24).toString("hex"));
set("CRON_SECRET", randomBytes(24).toString("hex"));
set("IP_HASH_SALT", randomBytes(16).toString("hex"));
writeFileSync(".env.local", template);
console.log("Wrote .env.local for the local stack.");
