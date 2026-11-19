import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Card, CardHeader, Table, Th, Td, StatusBadge, EmptyState } from "@/components/ui/primitives";
import { Input, Select, Label } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { createCampaign } from "../_actions/outreach";
import { date } from "@/lib/format";

export default async function CampaignsPage() {
  const db = createAdminClient();
  const [{ data: campaigns }, { data: templates }] = await Promise.all([
    db.from("outreach_campaigns").select("*, campaign_recipients(status)").order("created_at", { ascending: false }),
    db.from("outreach_templates").select("id,name,channel").order("name"),
  ]);
  return (
    <>
      <PageHeader title="Outreach campaigns" description="Draft → review every message → approve recipients → submit → admin approval → send (email) or work through manually (LinkedIn / phone)." />
      <Card className="mb-6">
        <CardHeader title="New campaign" />
        <form action={createCampaign} className="grid gap-3 sm:grid-cols-[1fr_1fr_120px_auto] sm:items-end">
          <div><Label>Name</Label><Input name="name" placeholder="Leeds roofers — November" required /></div>
          <div><Label>Template</Label><Select name="template_id">{(templates ?? []).map((t) => <option key={t.id} value={t.id}>{t.name} ({t.channel})</option>)}</Select></div>
          <div><Label>Daily limit</Label><Input name="daily_limit" type="number" min={1} max={200} defaultValue={25} /></div>
          <Button>Create</Button>
        </form>
      </Card>
      {!campaigns?.length ? <EmptyState title="No campaigns yet" /> : (
        <Table><thead><tr><Th>Campaign</Th><Th>Channel</Th><Th>Status</Th><Th>Recipients</Th><Th>Sent</Th><Th>Replied</Th><Th>Created</Th></tr></thead>
          <tbody>{campaigns.map((c) => { const r = (c.campaign_recipients ?? []) as { status: string }[]; return (
            <tr key={c.id}><Td><Link className="text-fg hover:text-signal-300" href={`/admin/campaigns/${c.id}`}>{c.name}</Link></Td><Td>{c.channel}</Td><Td><StatusBadge status={c.status} /></Td><Td>{r.length}</Td><Td>{r.filter((x) => x.status === "sent" || x.status === "replied").length}</Td><Td>{r.filter((x) => x.status === "replied").length}</Td><Td>{date(c.created_at)}</Td></tr>
          ); })}</tbody>
        </Table>
      )}
    </>
  );
}
