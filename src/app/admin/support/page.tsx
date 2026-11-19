import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Table, Th, Td, StatusBadge, EmptyState } from "@/components/ui/primitives";
import { dateTime } from "@/lib/format";

const ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export default async function SupportAdmin(props: PageProps<"/admin/support">) {
  const sp = await props.searchParams;
  const showAll = sp.all === "1";
  let q = createAdminClient().from("support_tickets").select("*, organizations(name)").order("updated_at", { ascending: false }).limit(300);
  if (!showAll) q = q.in("status", ["open", "in_progress", "waiting_on_customer"]);
  const { data } = await q;
  const rows = (data ?? []).sort((a, b) => ORDER[a.priority] - ORDER[b.priority]);
  return (
    <>
      <PageHeader title="Support requests" description={showAll ? "All tickets" : "Open tickets, most urgent first"} actions={<Link className="text-sm text-signal-300" href={showAll ? "?" : "?all=1"}>{showAll ? "Show open only" : "Show all"}</Link>} />
      {!rows.length ? <EmptyState title="No tickets" /> : (
        <Table><thead><tr><Th>Subject</Th><Th>Customer</Th><Th>Priority</Th><Th>Status</Th><Th>Updated</Th></tr></thead>
          <tbody>{rows.map((t) => (
            <tr key={t.id}><Td><Link className="text-fg hover:text-signal-300" href={`/admin/support/${t.id}`}>{t.subject}</Link></Td><Td>{(t.organizations as { name: string })?.name}</Td><Td><StatusBadge status={t.priority} /></Td><Td><StatusBadge status={t.status} /></Td><Td className="text-muted">{dateTime(t.updated_at)}</Td></tr>
          ))}</tbody>
        </Table>
      )}
    </>
  );
}
