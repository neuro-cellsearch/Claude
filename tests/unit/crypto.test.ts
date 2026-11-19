import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.IP_HASH_SALT = "test";
});

describe("crypto", async () => {
  const c = await import("@/lib/crypto");
  it("round-trips secrets with AES-256-GCM and never stores plaintext", () => {
    const ct = c.encryptSecret("sk_live_supersecret");
    expect(ct.startsWith("v1.")).toBe(true);
    expect(ct).not.toContain("supersecret");
    expect(c.decryptSecret(ct)).toBe("sk_live_supersecret");
  });
  it("produces different ciphertexts for the same input (random IV)", () => {
    expect(c.encryptSecret("x")).not.toBe(c.encryptSecret("x"));
  });
  it("detects tampering", () => {
    const parts = c.encryptSecret("hello").split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => c.decryptSecret(parts.join("."))).toThrow();
  });
  it("hashes IPs one-way and consistently", () => {
    expect(c.hashIp("1.2.3.4")).toBe(c.hashIp("1.2.3.4"));
    expect(c.hashIp("1.2.3.4")).not.toContain("1.2.3.4");
    expect(c.hashIp(null)).toBeNull();
  });
  it("unsubscribe tokens are email-specific and case-insensitive", () => {
    expect(c.unsubscribeToken("A@b.com")).toBe(c.unsubscribeToken("a@b.com"));
    expect(c.unsubscribeToken("a@b.com")).not.toBe(c.unsubscribeToken("c@b.com"));
  });
});

describe("logger redaction", async () => {
  const { redact } = await import("@/lib/logger");
  it("redacts secret-looking keys recursively", () => {
    expect(redact({ password: "x", nested: { api_key: "y", ok: 1 } })).toEqual({ password: "[redacted]", nested: { api_key: "[redacted]", ok: 1 } });
  });
});
