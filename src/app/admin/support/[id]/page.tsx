import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Card, StatusBadge, Badge } from "@/components/ui/primitives";
import { ActionForm } from "@/components/forms/action-form";
import { Textarea, Checkbox, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { staffReply, setTicketStatus } from "../../_actions/customers";
import { dateTime } from "@/lib/format";
import { cn } from "@/components/ui/cn";

export default async function TicketAdmin(props: PageProps<"/admin/support/[id]">) {
  const { id } = await props.params;
  const db = createAdminClient();
  const { data: t } = await db.from("support_tickets").select("*, organizations(id,name)").eq("id", id).maybeSingle();
  if (!t) notFound();
  const { data: msgs } = await db.from("ticket_messages").select("*, profiles(full_name,email,role)").eq("ticket_id", id).order("created_at");
  const org = t.organizations as { id: string; name: string };
  return (
    <>
      <PageHeader title={t.subject} description={<span className="flex items-center gap-2"><Link className="text-signal-300" href={`/admin/customers/${org.id}`}>{org.name}</Link><StatusBadge status={t.status} /><StatusBadge status={t.priority} /></span>}
        actions={<form action={setTicketStatus} className="flex gap-2"><input type="hidden" name="id" value={id} />
          <Select name="status" defaultValue={t.status} className="w-44">{["open", "in_progress", "waiting_on_customer", "resolved", "closed"].map((s) => <option key={s}>{s}</option>)}</Select>
          <Select name="priority" defaultValue={t.priority} className="w-28">{["low", "normal", "high", "urgent"].map((s) => <option key={s}>{s}</option>)}</Select>
          <Button variant="secondary">Update</Button></form>} />
      <div className="max-w-3xl space-y-3">
        {(msgs ?? []).map((m) => {
          const p = m.profiles as { full_name: string | null; email: string; role: string } | null;
          const staff = p && p.role !== "customer";
          return (
            <div key={m.id} className={cn("rounded-xl border p-4", m.is_internal ? "border-warning/30 bg-warning/5" : staff ? "border-signal-500/30 bg-signal-500/5" : "border-line bg-ink-800")}>
              <p className="mb-1.5 text-[12px] text-subtle">{p?.full_name ?? p?.email} · {dateTime(m.created_at)} {m.is_internal && <Badge tone="amber">internal</Badge>}</p>
              <p className="whitespace-pre-wrap text-[14px] text-fg/90">{m.body}</p>
            </div>
          );
        })}
        <Card>
          <ActionForm action={staffReply} submitLabel="Send" resetOnSuccess>
            <input type="hidden" name="ticket_id" value={id} />
            <Textarea name="body" placeholder="Reply to the customer…" />
            <Checkbox name="internal" label="Internal note (not visible to the customer)" />
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
