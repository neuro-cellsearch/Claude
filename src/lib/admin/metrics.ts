import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { lastNMonths, monthKey } from "@/lib/series";
import { monthlyEquivalent, ukCorporationTax, lifetimeValue } from "@/lib/finance";

type Sub = { organization_id: string; status: string; monthly_pence: number; started_at: string | null; canceled_at: string | null; created_at: string };
type Payment = { amount_pence: number; type: string; status: string; paid_at: string | null };
type Expense = { amount_pence: number; frequency: "monthly" | "annual" | "one_off"; category: string; is_cost_of_delivery: boolean; start_date: string; end_date: string | null };

function activeIn(e: Expense, start: Date, end: Date) {
  const s = new Date(e.start_date);
  const en = e.end_date ? new Date(e.end_date) : null;
  return s < end && (!en || en >= start);
}

/** Expense cost recognised in a month: monthly/annual-equivalent if active, plus one-offs dated in the month. */
export function expenseForMonth(expenses: Expense[], start: Date, end: Date) {
  let delivery = 0, operating = 0;
  for (const e of expenses) {
    let amt = 0;
    if (e.frequency === "one_off") {
      const d = new Date(e.start_date);
      if (d >= start && d < end) amt = e.amount_pence;
    } else if (activeIn(e, start, end)) amt = monthlyEquivalent(e.amount_pence, e.frequency);
    if (e.is_cost_of_delivery) delivery += amt; else operating += amt;
  }
  return { delivery, operating, total: delivery + operating };
}

export async function getBusinessMetrics(months = 12) {
  const db = createAdminClient();
  const [{ data: subs }, { data: payments }, { data: expenses }] = await Promise.all([
    db.from("subscriptions").select("organization_id,status,monthly_pence,started_at,canceled_at,created_at"),
    db.from("payments").select("amount_pence,type,status,paid_at").eq("status", "paid"),
    db.from("expenses").select("amount_pence,frequency,category,is_cost_of_delivery,start_date,end_date"),
  ]);
  const S = (subs ?? []) as Sub[];
  const P = (payments ?? []) as Payment[];
  const X = (expenses ?? []) as Expense[];

  const live = S.filter((s) => ["active", "trialing", "past_due"].includes(s.status));
  const mrr = live.reduce((t, s) => t + s.monthly_pence, 0);
  const activeCustomers = new Set(live.map((s) => s.organization_id)).size;
  const arpa = activeCustomers ? Math.round(mrr / activeCustomers) : 0;

  const buckets = lastNMonths(months);
  const series = buckets.map((b) => {
    const inMonth = (ts: string | null) => ts && new Date(ts) >= b.start && new Date(ts) < b.end;
    const paidRows = P.filter((p) => inMonth(p.paid_at));
    const recurring = paidRows.filter((p) => p.type === "subscription").reduce((t, p) => t + p.amount_pence, 0);
    const setup = paidRows.filter((p) => p.type === "setup").reduce((t, p) => t + p.amount_pence, 0);
    const other = paidRows.filter((p) => !["subscription", "setup"].includes(p.type)).reduce((t, p) => t + p.amount_pence, 0);
    // MRR at month end: subs started before end and not cancelled before end.
    const mrrAtEnd = S.filter((s) => {
      const started = s.started_at ? new Date(s.started_at) : null;
      const cancelled = s.canceled_at ? new Date(s.canceled_at) : null;
      return started && started < b.end && (!cancelled || cancelled >= b.end) && s.status !== "pending";
    }).reduce((t, s) => t + s.monthly_pence, 0);
    const startOfMonthCustomers = new Set(S.filter((s) => {
      const st = s.started_at ? new Date(s.started_at) : null;
      const c = s.canceled_at ? new Date(s.canceled_at) : null;
      return st && st < b.start && (!c || c >= b.start);
    }).map((s) => s.organization_id)).size;
    const newCustomers = new Set(S.filter((s) => inMonth(s.started_at)).map((s) => s.organization_id)).size;
    const churned = new Set(S.filter((s) => inMonth(s.canceled_at)).map((s) => s.organization_id)).size;
    const costs = expenseForMonth(X, b.start, b.end);
    const revenue = recurring + setup + other;
    const grossProfit = revenue - costs.delivery;
    const operatingProfit = grossProfit - costs.operating;
    return {
      key: b.key, label: b.label, revenue, recurring, setup, other, mrr: mrrAtEnd, newCustomers, churned,
      churnRate: startOfMonthCustomers ? churned / startOfMonthCustomers : 0,
      costDelivery: costs.delivery, costOperating: costs.operating, grossProfit, operatingProfit,
    };
  });

  const current = series[series.length - 1];
  const last3 = series.slice(-3);
  const avgChurn = last3.reduce((t, m) => t + m.churnRate, 0) / Math.max(1, last3.length);
  const runRateCosts = expenseForMonth(X.filter((e) => e.frequency !== "one_off"), new Date(), new Date(Date.now() + 1));
  const projectedGross = mrr - runRateCosts.delivery;
  const projectedOperating = projectedGross - runRateCosts.operating;
  const annualTax = ukCorporationTax(projectedOperating * 12);
  const projectedAfterTax = projectedOperating - Math.round(annualTax / 12);
  const grossMargin = mrr > 0 ? projectedGross / mrr : 0;

  return {
    mrr, arr: mrr * 12, activeCustomers, arpa, series, current, avgChurn,
    runRate: {
      revenue: mrr, costDelivery: runRateCosts.delivery, costOperating: runRateCosts.operating,
      grossProfit: projectedGross, operatingProfit: projectedOperating, corporationTax: Math.round(annualTax / 12), profitAfterTax: projectedAfterTax, grossMargin,
    },
    ltv: lifetimeValue(arpa, grossMargin, avgChurn),
    hasRevenueData: P.length > 0 || S.length > 0,
  };
}

export { monthKey };
