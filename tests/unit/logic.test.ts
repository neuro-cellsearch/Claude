import { describe, it, expect } from "vitest";
import { scoreEnquiry } from "@/lib/scoring";
import { renderTemplate, unresolvedPlaceholders } from "@/lib/templating";
import { generateSlots, londonToUtc, londonOffsetMinutes } from "@/lib/slots";
import { outreachEligibility } from "@/lib/sales/compliance";
import { draftProposalCopy } from "@/lib/sales/proposals";

describe("scoreEnquiry", () => {
  it("scores a strong consultation lead highly and explains why", () => {
    const r = scoreEnquiry({ type: "consultation", industry: "roofing", budget: "750_1500", monthlyEnquiries: "100_500", services: ["a", "b", "c"], phone: "0113", company: "X Ltd", message: "x".repeat(100) });
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.reasons.some((x) => x.includes("consultation"))).toBe(true);
  });
  it("caps at 100 and floors at 0", () => {
    const r = scoreEnquiry({ type: "proposal", industry: "dental", budget: "over_1500", monthlyEnquiries: "500_plus", services: ["a", "b", "c"], phone: "1", company: "c", message: "x".repeat(200) });
    expect(r.score).toBe(100);
    expect(scoreEnquiry({ type: "chatbot" }).score).toBe(5);
  });
});

describe("templating", () => {
  it("fills known placeholders and leaves unknown ones visible", () => {
    const out = renderTemplate("Hi {{first_name}} at {{company_name}} in {{area}}", { first_name: "Sam", company_name: "Acme", area: "" });
    expect(out).toBe("Hi Sam at Acme in {{area}}");
    expect(unresolvedPlaceholders(out)).toEqual(["area"]);
  });
});

describe("slots (Europe/London)", () => {
  it("knows GMT and BST offsets", () => {
    expect(londonOffsetMinutes(new Date("2026-01-15T12:00:00Z"))).toBe(0);
    expect(londonOffsetMinutes(new Date("2026-07-15T12:00:00Z"))).toBe(60);
  });
  it("converts London wall-clock time to UTC in winter and summer", () => {
    expect(londonToUtc(2026, 0, 15, 9 * 60 + 30).toISOString()).toBe("2026-01-15T09:30:00.000Z");
    expect(londonToUtc(2026, 6, 15, 9 * 60 + 30).toISOString()).toBe("2026-07-15T08:30:00.000Z");
  });
  it("generates weekday slots, excludes booked ones and respects notice period", () => {
    const now = new Date("2026-11-16T08:00:00Z"); // Monday
    const rules = [1, 2, 3, 4, 5].map((d) => ({ weekday: d, start_minute: 570, end_minute: 660, slot_minutes: 30 }));
    const slots = generateSlots(rules, ["2026-11-17T09:30:00.000Z"], now, 7, 12);
    expect(slots).not.toContain("2026-11-16T09:30:00.000Z"); // within 12h notice
    expect(slots).not.toContain("2026-11-17T09:30:00.000Z"); // booked
    expect(slots).toContain("2026-11-17T10:00:00.000Z");
    expect(slots.some((s) => new Date(s).getUTCDay() === 6 || new Date(s).getUTCDay() === 0)).toBe(false);
  });
  it("handles the October clock change correctly", () => {
    // Clocks go back 25 Oct 2026. Mon 26 Oct 09:30 London = 09:30 UTC; Fri 23 Oct 09:30 London = 08:30 UTC.
    const rules = [{ weekday: 1, start_minute: 570, end_minute: 600, slot_minutes: 30 }, { weekday: 5, start_minute: 570, end_minute: 600, slot_minutes: 30 }];
    const slots = generateSlots(rules, [], new Date("2026-10-21T00:00:00Z"), 7, 0);
    expect(slots).toEqual(["2026-10-23T08:30:00.000Z", "2026-10-26T09:30:00.000Z"]);
  });
});

describe("outreach compliance (PECR)", () => {
  const base = { entity_type: "limited_company", business_email: "info@acme.co.uk", business_phone: "01131234567", linkedin_url: null, status: "approved", tps_checked_at: new Date().toISOString(), tps_registered: false, approved_at: new Date().toISOString() };
  it("allows email to approved corporate subscribers", () => expect(outreachEligibility(base, "email", false).ok).toBe(true));
  it("blocks email to sole traders and unknown entities", () => {
    expect(outreachEligibility({ ...base, entity_type: "sole_trader" }, "email", false).ok).toBe(false);
    expect(outreachEligibility({ ...base, entity_type: "unknown" }, "email", false).ok).toBe(false);
  });
  it("blocks unapproved, suppressed and do-not-contact prospects", () => {
    expect(outreachEligibility({ ...base, approved_at: null }, "email", false).ok).toBe(false);
    expect(outreachEligibility(base, "email", true).ok).toBe(false);
    expect(outreachEligibility({ ...base, status: "do_not_contact" }, "email", false).ok).toBe(false);
  });
  it("requires fresh TPS screening for calls", () => {
    expect(outreachEligibility(base, "phone", false).ok).toBe(true);
    expect(outreachEligibility({ ...base, tps_checked_at: null }, "phone", false).ok).toBe(false);
    expect(outreachEligibility({ ...base, tps_checked_at: new Date(Date.now() - 40 * 86400_000).toISOString() }, "phone", false).ok).toBe(false);
    expect(outreachEligibility({ ...base, tps_registered: true }, "phone", false).ok).toBe(false);
  });
  it("requires a LinkedIn URL for LinkedIn outreach", () => {
    expect(outreachEligibility(base, "linkedin", false).ok).toBe(false);
    expect(outreachEligibility({ ...base, linkedin_url: "https://linkedin.com/in/x" }, "linkedin", false).ok).toBe(true);
  });
});

describe("proposal drafting", () => {
  it("produces industry-aware copy without inventing statistics", () => {
    const c = draftProposalCopy({ company: "Acme Roofing", industry: "roofing", planName: "Growth", message: null, services: [] });
    expect(c.introduction).toContain("Acme Roofing");
    expect(c.scope).toContain("end-to-end testing");
    expect(c.scope + c.introduction).not.toMatch(/\d+%/);
  });
});
