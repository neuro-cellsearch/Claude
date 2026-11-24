import { describe, it, expect } from "vitest";
import { checkEnv } from "@/lib/env-check";
import { randomBytes } from "node:crypto";

const good = {
  NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "a", SUPABASE_SERVICE_ROLE_KEY: "s",
  ENCRYPTION_KEY: randomBytes(32).toString("base64"), AUTOMATION_WEBHOOK_SECRET: "x".repeat(32), CRON_SECRET: "y".repeat(32),
  IP_HASH_SALT: "salt", NEXT_PUBLIC_SITE_URL: "https://kairo.example", NEXT_PUBLIC_COMPANY_ADDRESS: "1 St", NEXT_PUBLIC_COMPANY_NUMBER: "123",
};

describe("checkEnv", () => {
  it("passes a complete production configuration", () => expect(checkEnv(good, true)).toEqual([]));
  it("flags missing required variables", () => {
    const vars = checkEnv({}, true).filter((i) => i.level === "error").map((i) => i.variable);
    expect(vars).toEqual(expect.arrayContaining(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ENCRYPTION_KEY", "CRON_SECRET", "NEXT_PUBLIC_SITE_URL"]));
  });
  it("rejects a wrong-length encryption key and short secrets", () => {
    const r = checkEnv({ ...good, ENCRYPTION_KEY: "dG9vc2hvcnQ=", CRON_SECRET: "short" }, true);
    expect(r.map((i) => i.variable)).toEqual(expect.arrayContaining(["ENCRYPTION_KEY", "CRON_SECRET"]));
  });
  it("requires https in production", () => {
    expect(checkEnv({ ...good, NEXT_PUBLIC_SITE_URL: "http://kairo.example" }, true).some((i) => i.variable === "NEXT_PUBLIC_SITE_URL")).toBe(true);
    expect(checkEnv({ ...good, NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }, false)).toEqual([]);
  });
  it("catches a Stripe key without its webhook secret (payments taken but not recorded)", () => {
    const r = checkEnv({ ...good, STRIPE_SECRET_KEY: "sk_live_abc" }, true);
    expect(r.find((i) => i.variable === "STRIPE_WEBHOOK_SECRET")?.level).toBe("error");
  });
  it("warns about test-mode Stripe keys in production", () => {
    expect(checkEnv({ ...good, STRIPE_SECRET_KEY: "sk_test_abc", STRIPE_WEBHOOK_SECRET: "whsec_x" }, true).some((i) => i.level === "warn" && i.variable === "STRIPE_SECRET_KEY")).toBe(true);
  });
});
