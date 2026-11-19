import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBusinessMetrics } from "@/lib/admin/metrics";
import { PageHeader, Card, CardHeader, Table, Th, Td, Badge, EmptyState, StatCard, Notice } from "@/components/ui/primitives";
import { ActionForm } from "@/components/forms/action-form";
import { Field, Input, Select, Checkbox } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { ForecastCalculator } from "@/components/dashboard/forecast-calculator";
import { TrendChart } from "@/components/dashboard/charts";
import { saveExpense, deleteExpense, seedTypicalExpenses } from "../_actions/admin";
import { DEFAULT_FORECAST, monthlyEquivalent, type ForecastInputs } from "@/lib/finance";
import { gbp, pct, date } from "@/lib/format";
import { penceToPounds } from "@/lib/series";

export default async function FinancePage() {
  await requireAdmin();
  const db = createAdminClient();
  const [m, { data: expenses }, { data: settings }] = await Promise.all([
    getBusinessMetrics(12),
    db.from("expenses").select("*").order("category").order("name"),
    db.from("app_settings").select("value").eq("key", "finance").maybeSingle(),
  ]);
  const target = (settings?.value as { net_profit_target_pence?: number })?.net_profit_target_pence ?? 1_000_000;
  const X = expenses ?? [];
  const sumCat = (pred: (e: (typeof X)[number]) => boolean) => X.filter((e) => pred(e) && (!e.end_date || new Date(e.end_date) >= new Date())).reduce((t, e) => t + monthlyEquivalent(e.amount_pence, e.frequency), 0);

  // Seed the calculator from real data where it exists.
  const initial: ForecastInputs = {
    ...DEFAULT_FORECAST,
    ...(m.activeCustomers ? { customers: m.activeCustomers, avgMonthlyPence: m.arpa } : {}),
    ...(m.avgChurn > 0 ? { monthlyChurnRate: +m.avgChurn.toFixed(3) } : {}),
    ...(X.length ? {
      aiCostPerCustomerPence: m.activeCustomers ? Math.round(sumCat((e) => e.category === "ai_api") / m.activeCustomers) : DEFAULT_FORECAST.aiCostPerCustomerPence,
      fixedSoftwarePence: sumCat((e) => e.category === "software"),
      softwarePerCustomerPence: m.activeCustomers ? 0 : DEFAULT_FORECAST.softwarePerCustomerPence,
      marketingPence: sumCat((e) => e.category === "marketing"),
      labourPence: sumCat((e) => e.category === "labour"),
      contractorsPence: sumCat((e) => e.category === "contractors"),
      otherPence: sumCat((e) => e.category === "other"),
    } : {}),
  };

  return (
    <>
      <PageHeader title="Finance & forecast" description="Actual profitability from recorded revenue and expenses, plus a forecasting model for your £10k/month net profit target." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Revenue run-rate (MRR)" value={gbp(m.runRate.revenue)} />
        <StatCard label="Cost of delivery" value={gbp(m.runRate.costDelivery)} hint="Monthly" />
        <StatCard label="Gross profit" value={gbp(m.runRate.grossProfit)} hint={pct(m.runRate.grossMargin)} />
        <StatCard label="Operating profit" value={gbp(m.runRate.operatingProfit)} tone={m.runRate.operatingProfit >= 0 ? "up" : "down"} />
        <StatCard label="After est. corp. tax" value={gbp(m.runRate.profitAfterTax)} hint={`Target ${gbp(target)}`} tone={m.runRate.profitAfterTax >= target ? "up" : "neutral"} />
      </div>

      <Card className="mt-6"><CardHeader title="Actual monthly results (12 months)" description="Revenue from paid invoices; costs from the expenses below." />
        <TrendChart data={penceToPounds(m.series, ["revenue", "grossProfit", "operatingProfit"])} series={[{ key: "revenue", label: "Revenue" }, { key: "grossProfit", label: "Gross profit" }, { key: "operatingProfit", label: "Operating profit" }]} format="gbp" height={260} />
      </Card>

      <Card className="mt-6">
        <CardHeader title="Business expenses" description="Mark costs that scale with delivery (AI usage, n8n, contractors) as cost of delivery — they reduce gross margin." action={!X.length ? <form action={seedTypicalExpenses}><Button size="sm" variant="secondary">Add typical cost estimates</Button></form> : undefined} />
        {X.some((e) => e.notes?.startsWith("ESTIMATE")) && <div className="mb-4"><Notice tone="amber">Some expenses are estimates. Replace them with your real costs for accurate profit figures.</Notice></div>}
        {!X.length ? <EmptyState title="No expenses recorded" description="Add your real costs so profit figures are meaningful." /> : (
          <Table><thead><tr><Th>Expense</Th><Th>Category</Th><Th>Amount</Th><Th>Monthly equiv.</Th><Th>Type</Th><Th>Period</Th><Th></Th></tr></thead>
            <tbody>{X.map((e) => (
              <tr key={e.id}>
                <Td><p className="text-fg">{e.name}</p>{e.notes && <p className="text-[11.5px] text-subtle">{e.notes}</p>}</Td>
                <Td><Badge>{e.category.replace("_", " ")}</Badge></Td>
                <Td className="tabular-nums">{gbp(e.amount_pence, { decimals: true })} <span className="text-subtle">/{e.frequency === "one_off" ? "once" : e.frequency === "annual" ? "yr" : "mo"}</span></Td>
                <Td className="tabular-nums">{gbp(monthlyEquivalent(e.amount_pence, e.frequency), { decimals: true })}</Td>
                <Td>{e.is_cost_of_delivery ? <Badge tone="violet">delivery</Badge> : <Badge>operating</Badge>}</Td>
                <Td className="text-[12px] text-muted">{date(e.start_date)}{e.end_date && ` → ${date(e.end_date)}`}</Td>
                <Td><details><summary className="cursor-pointer text-[12px] text-signal-300">Edit</summary>
                  <ActionForm action={saveExpense} submitLabel="Save" size="sm" className="mt-2 w-72 space-y-2">
                    <input type="hidden" name="id" value={e.id} />
                    <Input name="name" defaultValue={e.name} />
                    <div className="grid grid-cols-2 gap-2">
                      <Select name="category" defaultValue={e.category}>{["software", "ai_api", "marketing", "labour", "contractors", "other"].map((c) => <option key={c}>{c}</option>)}</Select>
                      <Select name="frequency" defaultValue={e.frequency}><option value="monthly">monthly</option><option value="annual">annual</option><option value="one_off">one-off</option></Select>
                    </div>
                    <Input name="amount" type="number" step="0.01" defaultValue={(e.amount_pence / 100).toFixed(2)} />
                    <div className="grid grid-cols-2 gap-2"><Input name="start_date" type="date" defaultValue={e.start_date} /><Input name="end_date" type="date" defaultValue={e.end_date ?? ""} /></div>
                    <Input name="notes" defaultValue={e.notes ?? ""} placeholder="Notes" />
                    <Checkbox name="is_cost_of_delivery" defaultChecked={e.is_cost_of_delivery} label="Cost of delivery" />
                  </ActionForm>
                  <form action={deleteExpense} className="mt-1"><input type="hidden" name="id" value={e.id} /><button className="text-[12px] text-danger">Delete</button></form>
                </details></Td>
              </tr>
            ))}</tbody>
          </Table>
        )}
        <details className="mt-4 rounded-lg border border-dashed border-line-strong p-4">
          <summary className="cursor-pointer text-[13.5px] text-signal-300">+ Add expense</summary>
          <ActionForm action={saveExpense} submitLabel="Add expense" className="mt-4 max-w-2xl" resetOnSuccess>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" name="name"><Input name="name" required /></Field>
              <Field label="Amount (£, ex. VAT if reclaimable)" name="amount"><Input name="amount" type="number" step="0.01" required /></Field>
              <Field label="Category" name="category"><Select name="category" defaultValue="software">{["software", "ai_api", "marketing", "labour", "contractors", "other"].map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}</Select></Field>
              <Field label="Frequency" name="frequency"><Select name="frequency" defaultValue="monthly"><option value="monthly">Monthly</option><option value="annual">Annual</option><option value="one_off">One-off</option></Select></Field>
              <Field label="Start date" name="start_date"><Input name="start_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
              <Field label="End date" name="end_date" hint="(optional)"><Input name="end_date" type="date" /></Field>
            </div>
            <Field label="Notes" name="notes"><Input name="notes" /></Field>
            <Checkbox name="is_cost_of_delivery" label="Cost of delivery (scales with customers)" />
          </ActionForm>
        </details>
      </Card>

      <div className="mt-10">
        <h2 className="mb-1 text-xl font-semibold text-fg">Forecasting calculator</h2>
        <p className="mb-5 text-sm text-muted">Pre-filled from your live data where available. Adjust any assumption — nothing here is saved or guaranteed.</p>
        <ForecastCalculator initial={initial} targetPence={target} />
      </div>
    </>
  );
}
