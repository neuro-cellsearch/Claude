import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Table, Th, Td, StatusBadge, EmptyState } from "@/components/ui/primitives";
import { gbp, date } from "@/lib/format";
import { INDUSTRY_LABEL } from "@/lib/content/industries";

export default async function CustomersPage(props: PageProps<"/admin/customers">) {
  const sp = await props.searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  let q = createAdminClient().from("organizations").select("id,name,industry,status,created_at, subscriptions(status,monthly_pence,plan_id), automations(status)").order("created_at", { ascending: false }).limit(500);
  if (status) q = q.eq("status", status);
  const { data } = await q;
  return (
    <>
      <PageHeader title="Customers" description="Every business account — prospects who registered, customers in onboarding, active and churned." />
      <div className="mb-4 flex flex-wrap gap-2 text-[13px]">
        {["", "prospect", "onboarding", "active", "paused", "churned"].map((s) => <Link key={s} href={s ? `?status=${s}` : "?"} className={`rounded-md px-3 py-1.5 ${status === s ? "bg-ink-700 text-fg" : "text-muted hover:text-fg"}`}>{s || "All"}</Link>)}
      </div>
      {!data?.length ? <EmptyState title="No customers" /> : (
        <Table>
          <thead><tr><Th>Business</Th><Th>Industry</Th><Th>Status</Th><Th>Plan</Th><Th>MRR</Th><Th>Automations</Th><Th>Since</Th></tr></thead>
          <tbody>{data.map((o) => {
            const subs = (o.subscriptions ?? []) as { status: string; monthly_pence: number; plan_id: string }[];
            const live = subs.find((s) => ["active", "trialing", "past_due"].includes(s.status));
            const autos = (o.automations ?? []) as { status: string }[];
            return (
              <tr key={o.id}>
                <Td><Link className="font-medium text-fg hover:text-signal-300" href={`/admin/customers/${o.id}`}>{o.name}</Link></Td>
                <Td>{INDUSTRY_LABEL[o.industry ?? ""] ?? "—"}</Td><Td><StatusBadge status={o.status} /></Td>
                <Td className="capitalize">{live ? <>{live.plan_id} {live.status !== "active" && <StatusBadge status={live.status} />}</> : "—"}</Td>
                <Td className="tabular-nums">{live ? gbp(live.monthly_pence) : "—"}</Td>
                <Td>{autos.filter((a) => a.status === "active").length} live / {autos.length}</Td>
                <Td className="text-muted">{date(o.created_at)}</Td>
              </tr>
            );
          })}</tbody>
        </Table>
      )}
    </>
  );
}
