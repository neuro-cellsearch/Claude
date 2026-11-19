import { notFound } from "next/navigation";
import { getPortalContext } from "../../context";
import { PageHeader, Card, StatusBadge } from "@/components/ui/primitives";
import { ActionForm } from "@/components/forms/action-form";
import { Textarea } from "@/components/ui/form";
import { replyTicket } from "../../actions";
import { dateTime } from "@/lib/format";
import { cn } from "@/components/ui/cn";

export default async function TicketPage(props: PageProps<"/portal/support/[id]">) {
  const { id } = await props.params;
  const { supabase, user } = await getPortalContext();
  const { data: ticket } = await supabase.from("support_tickets").select("*").eq("id", id).maybeSingle();
  if (!ticket) notFound();
  const { data: messages } = await supabase.from("ticket_messages").select("id,body,author_id,created_at").eq("ticket_id", id).order("created_at");
  return (
    <>
      <PageHeader title={ticket.subject} description={<span className="flex gap-2"><StatusBadge status={ticket.status} /><StatusBadge status={ticket.priority} /></span>} />
      <div className="max-w-3xl space-y-3">
        {(messages ?? []).map((m) => (
          <div key={m.id} className={cn("rounded-xl border p-4", m.author_id === user.id ? "border-line bg-ink-800" : "border-signal-500/30 bg-signal-500/5")}>
            <p className="mb-1.5 text-[12px] text-subtle">{m.author_id === user.id ? "You" : "Kairo support"} · {dateTime(m.created_at)}</p>
            <p className="whitespace-pre-wrap text-[14px] text-fg/90">{m.body}</p>
          </div>
        ))}
        {ticket.status !== "closed" && (
          <Card>
            <ActionForm action={replyTicket} submitLabel="Send reply" resetOnSuccess>
              <input type="hidden" name="ticket_id" value={id} />
              <Textarea name="body" placeholder="Write a reply…" required />
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
