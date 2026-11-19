import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Table, Th, Td, StatusBadge, EmptyState, Card } from "@/components/ui/primitives";
import { Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { createQuote } from "../_actions/crm";
import { gbp, date } from "@/lib/format";

export default async function QuotesPage() {
  const { data } = await createAdminClient().from("quotes").select("*").order("created_at", { ascending: false }).limit(300);
  const rows = data ?? [];
  const accepted = rows.filter((q) => q.status === "accepted");
  const sent = rows.filter((q) => ["sent", "accepted", "declined", "expired"].includes(q.status));
  return (
    <>
      <PageHeader title="Quotes & proposals" description={`Win rate: ${sent.length ? Math.round((accepted.length / sent.length) * 100) : 0}% of ${sent.length} sent · Accepted MRR ${gbp(accepted.reduce((t, q) => t + q.monthly_total_pence, 0))}`}
        actions={<form action={createQuote} className="flex gap-2"><Select name="plan_id" defaultValue="growth" className="w-36"><option value="starter">Starter</option><option value="growth">Growth</option><option value="premium">Premium</option><option value="enterprise">Custom</option></Select><Button>New proposal</Button></form>} />
      {!rows.length ? <EmptyState title="No proposals yet" description="Create one from an enquiry to pre-fill the client's details." /> : (
        <Card className="p-0">
          <Table className="border-0">
            <thead><tr><Th>Number</Th><Th>Client</Th><Th>Title</Th><Th>Setup</Th><Th>Monthly</Th><Th>Valid until</Th><Th>Status</Th></tr></thead>
            <tbody>{rows.map((q) => (
              <tr key={q.id}><Td><Link className="font-mono text-signal-300" href={`/admin/quotes/${q.id}`}>{q.number}</Link></Td><Td>{q.company || q.recipient_name}<p className="text-[12px] text-subtle">{q.recipient_email}</p></Td><Td>{q.title}</Td><Td>{gbp(q.setup_total_pence)}</Td><Td>{gbp(q.monthly_total_pence)}</Td><Td>{date(q.valid_until)}</Td><Td><StatusBadge status={q.status} /></Td></tr>
            ))}</tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
