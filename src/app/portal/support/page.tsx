import Link from "next/link";
import { getPortalContext } from "../context";
import { PageHeader, Table, Th, Td, EmptyState, StatusBadge } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { dateTime } from "@/lib/format";

export default async function SupportPage() {
  const { supabase } = await getPortalContext();
  const { data } = await supabase.from("support_tickets").select("*").order("updated_at", { ascending: false });
  return (
    <>
      <PageHeader title="Support" description="Raise an issue or ask a question. Urgent issues are prioritised." actions={<ButtonLink href="/portal/support/new">New request</ButtonLink>} />
      {!data?.length ? <EmptyState title="No support requests" action={<ButtonLink href="/portal/support/new" variant="secondary">Create one</ButtonLink>} /> : (
        <Table>
          <thead><tr><Th>Subject</Th><Th>Priority</Th><Th>Status</Th><Th>Updated</Th></tr></thead>
          <tbody>{data.map((t) => (
            <tr key={t.id}><Td><Link className="text-fg hover:text-signal-300" href={`/portal/support/${t.id}`}>{t.subject}</Link></Td><Td><StatusBadge status={t.priority} /></Td><Td><StatusBadge status={t.status} /></Td><Td className="text-muted">{dateTime(t.updated_at)}</Td></tr>
          ))}</tbody>
        </Table>
      )}
    </>
  );
}
