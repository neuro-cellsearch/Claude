#!/usr/bin/env node
// Promotes an existing user (who has registered through the site) to admin.
// Usage: DATABASE_URL=... node scripts/grant-admin.mjs you@yourcompany.co.uk
import { execFileSync } from "node:child_process";
const [email] = process.argv.slice(2);
if (!process.env.DATABASE_URL || !email || !/^[^@\s'"]+@[^@\s'"]+$/.test(email)) {
  console.error("Usage: DATABASE_URL=... node scripts/grant-admin.mjs <email>");
  process.exit(1);
}
// Variables are interpolated safely by psql (:'email' is quoted as a literal) when read from stdin.
const res = execFileSync("psql", [process.env.DATABASE_URL, "-v", "ON_ERROR_STOP=1", "-At", "-v", `email=${email}`], {
  input: "update public.profiles set role = 'admin' where lower(email) = lower(:'email') returning email;",
  encoding: "utf8",
});
if (!res.trim()) {
  console.error(`No profile found for ${email}. Register on the site first.`);
  process.exit(1);
}
console.log(`Granted admin to ${res.trim()}`);
