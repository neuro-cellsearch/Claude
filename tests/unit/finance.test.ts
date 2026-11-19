import { describe, it, expect } from "vitest";
import { ukCorporationTax, forecast, customersForTarget, DEFAULT_FORECAST, monthlyEquivalent, lifetimeValue } from "@/lib/finance";

describe("ukCorporationTax", () => {
  it("is zero for losses", () => expect(ukCorporationTax(-500_000)).toBe(0));
  it("applies 19% small profits rate up to £50k", () => expect(ukCorporationTax(50_000_00)).toBe(9_500_00));
  it("applies 25% main rate from £250k", () => expect(ukCorporationTax(250_000_00)).toBe(62_500_00));
  it("applies marginal relief between thresholds (HMRC worked example: £100k → £22,750)", () => {
    // 25% × 100,000 = 25,000; relief = (250,000 − 100,000) × 3/200 = 2,250
    expect(ukCorporationTax(100_000_00)).toBe(22_750_00);
  });
  it("is continuous at the £50k boundary", () => {
    expect(Math.abs(ukCorporationTax(50_001_00) - ukCorporationTax(50_000_00))).toBeLessThan(100);
  });
});

describe("forecast", () => {
  const base = { ...DEFAULT_FORECAST, customers: 10, avgMonthlyPence: 80000, newCustomersPerMonth: 0, aiCostPerCustomerPence: 0, softwarePerCustomerPence: 0,
    fixedSoftwarePence: 0, marketingPence: 0, labourPence: 0, contractorsPence: 0, otherPence: 0, paymentFeePercent: 0, paymentFeeFixedPence: 0 };

  it("computes revenue, gross and operating profit", () => {
    const r = forecast({ ...base, aiCostPerCustomerPence: 5000, marketingPence: 100000 });
    expect(r.recurringRevenue).toBe(800000);
    expect(r.costOfDelivery).toBe(50000);
    expect(r.grossProfit).toBe(750000);
    expect(r.operatingProfit).toBe(650000);
    expect(r.grossMargin).toBeCloseTo(0.9375);
  });

  it("deducts corporation tax on annualised profit", () => {
    const r = forecast(base); // £8k/mo → £96k/yr
    expect(r.annualOperatingProfit).toBe(96_000_00);
    expect(r.annualProfitAfterTax).toBe(96_000_00 - ukCorporationTax(96_000_00));
    expect(r.profitAfterTax).toBeLessThan(r.operatingProfit);
  });

  it("includes payment processing fees in cost of delivery", () => {
    const r = forecast({ ...base, paymentFeePercent: 1.5, paymentFeeFixedPence: 20 });
    expect(r.costOfDelivery).toBe(Math.round(800000 * 0.015 + 10 * 20));
  });

  it("adds setup revenue from new customers", () => {
    expect(forecast({ ...base, newCustomersPerMonth: 2, avgSetupPence: 99900 }).setupRevenue).toBe(199800);
  });

  it("returns null LTV with zero churn and a value otherwise", () => {
    expect(forecast({ ...base, monthlyChurnRate: 0 }).ltvPence).toBeNull();
    expect(forecast({ ...base, monthlyChurnRate: 0.05 }).ltvPence).toBe(1_600_000);
  });

  it("finds the customer count needed for the £10k target", () => {
    const n = customersForTarget(DEFAULT_FORECAST, 1_000_000)!;
    expect(n).toBeGreaterThan(0);
    expect(forecast({ ...DEFAULT_FORECAST, customers: n }).profitAfterTax).toBeGreaterThanOrEqual(1_000_000);
    expect(forecast({ ...DEFAULT_FORECAST, customers: n - 1 }).profitAfterTax).toBeLessThan(1_000_000);
  });
});

describe("helpers", () => {
  it("monthlyEquivalent", () => {
    expect(monthlyEquivalent(12000, "annual")).toBe(1000);
    expect(monthlyEquivalent(5000, "monthly")).toBe(5000);
    expect(monthlyEquivalent(5000, "one_off")).toBe(0);
  });
  it("lifetimeValue", () => {
    expect(lifetimeValue(80000, 0.8, 0.04)).toBe(1_600_000);
    expect(lifetimeValue(80000, 0.8, 0)).toBeNull();
  });
});
