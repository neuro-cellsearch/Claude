import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Table, Th, Td, Progress, StatusBadge, EmptyState } from "@/components/ui/primitives";
import { date } from "@/lib/format";

export default async function OnboardingAdmin() {
  const { data } = await createAdminClient().from("organizations")
    .select("id,name,status,onboarding_submitted_at,created_at, onboarding_tasks(key,title,status,owner), automations(status)")
    .in("status", ["onboarding", "prospect", "active"]).order("created_at", { ascending: false }).limit(200);
  const rows = (data ?? []).map((o) => {
    const tasks = (o.onboarding_tasks ?? []) as { key: string; title: string; status: string; owner: string }[];
    const done = tasks.filter((t) => t.status === "done").length;
    const nextTask = tasks.find((t) => t.status !== "done");
    return { ...o, tasks, done, nextTask, pct: tasks.length ? (done / tasks.length) * 100 : 0 };
  }).filter((o) => o.status === "onboarding" || (o.pct < 100 && o.onboarding_submitted_at));
  return (
    <>
      <PageHeader title="Customer onboarding" description="Customers who have paid or submitted onboarding, and what's blocking go-live." />
      {!rows.length ? <EmptyState title="Nobody in onboarding" /> : (
        <Table>
          <thead><tr><Th>Customer</Th><Th>Status</Th><Th>Progress</Th><Th>Next step</Th><Th>Submitted</Th><Th>Automations</Th></tr></thead>
          <tbody>{rows.map((o) => (
            <tr key={o.id}>
              <Td><Link className="font-medium text-fg hover:text-signal-300" href={`/admin/customers/${o.id}`}>{o.name}</Link></Td>
              <Td><StatusBadge status={o.status} /></Td>
              <Td className="w-48"><Progress value={o.pct} /><p className="mt-1 text-[11.5px] text-subtle">{o.done}/{o.tasks.length}</p></Td>
              <Td>{o.nextTask ? <>{o.nextTask.title} <span className="text-[11.5px] text-subtle">({o.nextTask.owner === "agency" ? "us" : "customer"})</span></> : "—"}</Td>
              <Td>{date(o.onboarding_submitted_at)}</Td>
              <Td>{((o.automations ?? []) as { status: string }[]).map((a, i) => <span key={i} className="mr-1"><StatusBadge status={a.status} /></span>)}</Td>
            </tr>
          ))}</tbody>
        </Table>
      )}
    </>
  );
}
