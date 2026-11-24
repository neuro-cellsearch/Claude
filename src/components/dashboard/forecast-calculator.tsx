"use client";
import { useMemo, useState } from "react";
import { forecast, customersForTarget, SCENARIO_CUSTOMER_COUNTS, type ForecastInputs } from "@/lib/finance";
import { BarsChart } from "./charts";

const gbp = (p: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(p / 100);

type FieldDef = { key: keyof ForecastInputs; label: string; kind: "gbp" | "int" | "pct"; hint?: string };
const FIELDS: FieldDef[] = [
  { key: "customers", label: "Active customers", kind: "int" },
  { key: "avgMonthlyPence", label: "Average subscription / month", kind: "gbp" },
  { key: "newCustomersPerMonth", label: "New customers per month", kind: "int", hint: "Drives setup revenue" },
  { key: "avgSetupPence", label: "Average setup fee", kind: "gbp" },
  { key: "monthlyChurnRate", label: "Monthly churn", kind: "pct" },
  { key: "aiCostPerCustomerPence", label: "AI / telephony usage per customer", kind: "gbp", hint: "OpenAI, voice minutes, SMS" },
  { key: "softwarePerCustomerPence", label: "Software per customer", kind: "gbp", hint: "Numbers, per-seat tools" },
  { key: "fixedSoftwarePence", label: "Fixed software & hosting", kind: "gbp" },
  { key: "marketingPence", label: "Marketing", kind: "gbp" },
  { key: "labourPence", label: "Labour / salaries", kind: "gbp", hint: "Include your own salary if you take one" },
  { key: "contractorsPence", label: "Contractors (delivery)", kind: "gbp" },
  { key: "otherPence", label: "Other operating costs", kind: "gbp", hint: "Insurance, accountant, office" },
  { key: "paymentFeePercent", label: "Card fees %", kind: "int" },
];

export function ForecastCalculator({ initial, targetPence }: { initial: ForecastInputs; targetPence: number }) {
  const [v, setV] = useState<ForecastInputs>(initial);
  const r = useMemo(() => forecast(v), [v]);
  const scenarios = useMemo(() => SCENARIO_CUSTOMER_COUNTS.map((n) => ({ n, r: forecast({ ...v, customers: n }) })), [v]);
  const needed = useMemo(() => customersForTarget(v, targetPence), [v, targetPence]);

  const display = (f: FieldDef) => f.kind === "gbp" ? v[f.key] / 100 : f.kind === "pct" ? +(v[f.key] * 100).toFixed(2) : v[f.key];
  const set = (f: FieldDef, raw: string) => {
    const n = Math.max(0, Number(raw) || 0);
    setV((s) => ({ ...s, [f.key]: f.kind === "gbp" ? Math.round(n * 100) : f.kind === "pct" ? n / 100 : n }));
  };

  const rows: [string, number, string?][] = [
    ["Recurring revenue", r.recurringRevenue], ["Setup revenue", r.setupRevenue], ["Total revenue", r.revenue, "font-semibold"],
    ["Cost of delivery", -r.costOfDelivery], ["Gross profit", r.grossProfit, "font-semibold"], ["Operating expenses", -r.operatingExpenses],
    ["Operating profit (before tax)", r.operatingProfit, "font-semibold"], ["Corporation tax (est.)", -r.corporationTaxMonthly], ["Profit after tax", r.profitAfterTax, "font-semibold text-signal-300"],
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <div className="surface-raised min-w-0 space-y-3 p-5">
        <p className="text-[15px] font-semibold text-fg">Assumptions</p>
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="flex justify-between text-[12.5px] text-muted"><span>{f.label}</span><span className="text-subtle">{f.kind === "gbp" ? "£" : f.kind === "pct" ? "%" : ""}</span></span>
            <input type="number" min={0} step={f.kind === "pct" ? 0.1 : 1} value={display(f)} onChange={(e) => set(f, e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-line-strong bg-ink-900 px-3 text-sm tabular-nums text-fg focus:border-signal-500 focus:outline-none" />
            {f.hint && <span className="text-[11px] text-subtle">{f.hint}</span>}
          </label>
        ))}
      </div>
      <div className="min-w-0 space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="surface-raised p-4"><p className="text-[12px] uppercase tracking-wider text-subtle">Monthly profit after tax</p><p className={`mt-2 text-2xl font-semibold tabular-nums ${r.profitAfterTax >= targetPence ? "text-success" : "text-fg"}`}>{gbp(r.profitAfterTax)}</p></div>
          <div className="surface-raised p-4"><p className="text-[12px] uppercase tracking-wider text-subtle">Annual profit after tax</p><p className="mt-2 text-2xl font-semibold tabular-nums text-fg">{gbp(r.annualProfitAfterTax)}</p></div>
          <div className="surface-raised p-4"><p className="text-[12px] uppercase tracking-wider text-subtle">Customers for {gbp(targetPence)}/mo net</p><p className="mt-2 text-2xl font-semibold tabular-nums text-fg">{needed ?? "Not reachable"}</p><p className="text-[11.5px] text-subtle">with these assumptions</p></div>
        </div>
        <div className="surface-raised p-5">
          <p className="mb-3 text-[15px] font-semibold text-fg">Monthly P&amp;L at {v.customers} customers</p>
          <table className="w-full text-[13.5px]"><tbody>
            {rows.map(([l, val, cls]) => <tr key={l} className="border-b border-line/60"><td className={`py-2 text-fg/85 ${cls ?? ""}`}>{l}</td><td className={`py-2 text-right tabular-nums ${cls ?? ""} ${val < 0 ? "text-muted" : ""}`}>{gbp(val)}</td></tr>)}
            <tr><td className="py-2 text-muted">Gross margin</td><td className="py-2 text-right tabular-nums">{(r.grossMargin * 100).toFixed(1)}%</td></tr>
            <tr><td className="py-2 text-muted">Customer lifetime value (gross margin ÷ churn)</td><td className="py-2 text-right tabular-nums">{r.ltvPence ? gbp(r.ltvPence) : "—"}</td></tr>
          </tbody></table>
        </div>
        <div className="surface-raised p-5">
          <p className="mb-3 text-[15px] font-semibold text-fg">Scenarios</p>
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-[13px]">
            <thead><tr className="text-left text-[11.5px] uppercase tracking-wider text-subtle"><th className="py-2">Customers</th><th className="py-2 text-right">Revenue</th><th className="py-2 text-right">Gross profit</th><th className="py-2 text-right">Operating profit</th><th className="py-2 text-right">After tax / mo</th><th className="py-2 text-right">After tax / yr</th></tr></thead>
            <tbody>{scenarios.map(({ n, r: s }) => (
              <tr key={n} className="border-t border-line/60"><td className="py-2 font-medium text-fg">{n}</td><td className="py-2 text-right tabular-nums">{gbp(s.revenue)}</td><td className="py-2 text-right tabular-nums">{gbp(s.grossProfit)}</td><td className="py-2 text-right tabular-nums">{gbp(s.operatingProfit)}</td><td className={`py-2 text-right tabular-nums ${s.profitAfterTax >= targetPence ? "text-success" : ""}`}>{gbp(s.profitAfterTax)}</td><td className="py-2 text-right tabular-nums">{gbp(s.annualProfitAfterTax)}</td></tr>
            ))}</tbody>
          </table></div>
          <div className="mt-4"><BarsChart data={scenarios.map(({ n, r: s }) => ({ label: `${n}`, revenue: s.revenue / 100, profit: s.profitAfterTax / 100 }))} series={[{ key: "revenue", label: "Revenue" }, { key: "profit", label: "Profit after tax" }]} format="gbp" height={220} /></div>
        </div>
        <p className="text-[12px] leading-relaxed text-subtle">
          Hypothetical planning model — not a guarantee of results. Excludes VAT (you must register once taxable turnover exceeds the VAT threshold, currently £90,000). Corporation tax uses UK rates for a single company with no associated companies (19% to £50k, marginal relief to £250k, 25% above). Profit after tax is company-level; dividends and personal tax are not included. Setup revenue assumes the stated new customers every month. Confirm with your accountant.
        </p>
      </div>
    </div>
  );
}
