import { describe, it, expect } from "vitest";
import { safeRedirectPath } from "@/lib/redirect";

describe("safeRedirectPath (open-redirect protection)", () => {
  it.each(["/portal", "/portal/billing?plan=growth", "/admin#x"])("allows %s", (p) => expect(safeRedirectPath(p, "/f")).toBe(p));
  it.each(["//evil.example", "/\\evil.example", "/\\\\evil.example", "https://evil.example", "javascript:alert(1)", "", "portal", "/\tevil", "/%0d%0aLocation:x".replace("%0d%0a", "\r\n")])(
    "rejects %j", (p) => expect(safeRedirectPath(p, "/f")).toBe("/f"));
  it("rejects non-strings", () => expect(safeRedirectPath(null, "/f")).toBe("/f"));
});
