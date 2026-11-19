#!/usr/bin/env node
// Applies SQL migrations in supabase/migrations in filename order, exactly once each.
// Works against local Docker Postgres or hosted Supabase (use the direct connection string).
// Usage: DATABASE_URL=postgres://... node scripts/migrate.mjs
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required (e.g. postgres://postgres:password@localhost:54322/postgres)");
  process.exit(1);
}
const psql = (args, input) =>
  execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-q", "-At", ...args], { input, encoding: "utf8" });

psql(["-c", "create table if not exists public.schema_migrations (version text primary key, applied_at timestamptz not null default now()); alter table public.schema_migrations enable row level security;"]);
const applied = new Set(psql(["-c", "select version from public.schema_migrations"]).split("\n").filter(Boolean));
const dir = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

let count = 0;
for (const file of files) {
  if (applied.has(file)) continue;
  process.stdout.write(`Applying ${file} ... `);
  // Run each migration in a single transaction together with its bookkeeping row.
  psql(["-1", "-f", join(dir, file), "-c", `insert into public.schema_migrations (version) values ('${file.replace(/'/g, "''")}')`]);
  console.log("done");
  count++;
}
// Ask PostgREST to reload its schema cache.
psql(["-c", "notify pgrst, 'reload schema'"]);
console.log(count ? `Applied ${count} migration(s).` : "Database is up to date.");
