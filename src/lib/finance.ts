/**
 * Financial model for the agency. All amounts in pence (GBP), monthly unless noted.
 * These are planning estimates — NOT guarantees — and exclude VAT.
 */

export type ForecastInputs = {
  customers: number;
  avgMonthlyPence: number;          // average subscription value per customer
  avgSetupPence: number;            // average setup fee per NEW customer
  newCustomersPerMonth: number;     // drives setup revenue
  monthlyChurnRate: number;         // 0–1
  aiCostPerCustomerPence: number;   // OpenAI/voice/SMS usage per customer
  softwarePerCustomerPence: number; // n8n/Twilio numbers/etc. per customer
  fixedSoftwarePence: number;       // platform subscriptions (Supabase, hosting, CRM…)
  marketingPence: number;
  labourPence: number;              // salaries/drawings treated as cost
  contractorsPence: number;
  otherPence: number;
  paymentFeePercent: number;        // e.g. 1.5 for Stripe UK cards
  paymentFeeFixedPence: number;     // per transaction
};

export type ForecastResult = {
  recurringRevenue: number;
  setupRevenue: number;
  revenue: number;
  costOfDelivery: number;
  grossProfit: number;
  grossMargin: number;
  operatingExpenses: number;
  operatingProfit: number;
  corporationTaxMonthly: number;
  profitAfterTax: number;
  annualOperatingProfit: number;
  annualProfitAfterTax: number;
  ltvPence: number | null;
};

/**
 * UK corporation tax on annual taxable profit (pence), financial years from
 * 1 April 2023: 19% up to £50k, 25% above £250k, marginal relief between.
 * Assumes no associated companies and a 12-month accounting period.
 */
export function ukCorporationTax(annualProfitPence: number): number {
  const profit = annualProfitPence / 100;
  if (profit <= 0) return 0;
  if (profit <= 50_000) return Math.round(profit * 0.19 * 100);
  if (profit >= 250_000) return Math.round(profit * 0.25 * 100);
  const mainRate = profit * 0.25;
  const marginalRelief = ((250_000 - profit) * 3) / 200;
  return Math.round((mainRate - marginalRelief) * 100);
}

export function forecast(i: ForecastInputs): ForecastResult {
  const recurringRevenue = Math.round(i.customers * i.avgMonthlyPence);
  const setupRevenue = Math.round(i.newCustomersPerMonth * i.avgSetupPence);
  const revenue = recurringRevenue + setupRevenue;

  const transactions = i.customers + i.newCustomersPerMonth;
  const paymentFees = Math.round(revenue * (i.paymentFeePercent / 100) + transactions * i.paymentFeeFixedPence);
  const costOfDelivery =
    Math.round(i.customers * (i.aiCostPerCustomerPence + i.softwarePerCustomerPence)) + paymentFees + i.contractorsPence;

  const grossProfit = revenue - costOfDelivery;
  const operatingExpenses = i.fixedSoftwarePence + i.marketingPence + i.labourPence + i.otherPence;
  const operatingProfit = grossProfit - operatingExpenses;

  const annualOperatingProfit = operatingProfit * 12;
  const annualTax = ukCorporationTax(annualOperatingProfit);
  const corporationTaxMonthly = Math.round(annualTax / 12);
  const profitAfterTax = operatingProfit - corporationTaxMonthly;

  const marginPerCustomer =
    i.avgMonthlyPence - i.aiCostPerCustomerPence - i.softwarePerCustomerPence - i.avgMonthlyPence * (i.paymentFeePercent / 100);
  const ltvPence = i.monthlyChurnRate > 0 ? Math.round(marginPerCustomer / i.monthlyChurnRate) : null;

  return {
    recurringRevenue,
    setupRevenue,
    revenue,
    costOfDelivery,
    grossProfit,
    grossMargin: revenue > 0 ? grossProfit / revenue : 0,
    operatingExpenses,
    operatingProfit,
    corporationTaxMonthly,
    profitAfterTax,
    annualOperatingProfit,
    annualProfitAfterTax: annualOperatingProfit - annualTax,
    ltvPence,
  };
}

/** Smallest customer count whose monthly profit after tax meets the target. */
export function customersForTarget(base: ForecastInputs, targetPence: number, max = 500): number | null {
  for (let n = 1; n <= max; n++) {
    if (forecast({ ...base, customers: n }).profitAfterTax >= targetPence) return n;
  }
  return null;
}

export const DEFAULT_FORECAST: ForecastInputs = {
  customers: 15,
  avgMonthlyPence: 79900,
  avgSetupPence: 99900,
  newCustomersPerMonth: 2,
  monthlyChurnRate: 0.03,
  aiCostPerCustomerPence: 4000,
  softwarePerCustomerPence: 2500,
  fixedSoftwarePence: 25000,
  marketingPence: 100000,
  labourPence: 0,
  contractorsPence: 0,
  otherPence: 20000,
  paymentFeePercent: 1.5,
  paymentFeeFixedPence: 20,
};

export const SCENARIO_CUSTOMER_COUNTS = [5, 10, 15, 20, 30];

/** Monthly equivalent of an expense row. */
export function monthlyEquivalent(amountPence: number, frequency: "monthly" | "annual" | "one_off"): number {
  if (frequency === "annual") return Math.round(amountPence / 12);
  if (frequency === "one_off") return 0;
  return amountPence;
}

/** Customer lifetime value = ARPA × gross margin ÷ monthly churn. */
export function lifetimeValue(arpaPence: number, grossMargin: number, monthlyChurn: number): number | null {
  if (monthlyChurn <= 0) return null;
  return Math.round((arpaPence * grossMargin) / monthlyChurn);
}
