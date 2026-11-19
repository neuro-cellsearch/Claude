import { getPortalContext } from "../context";
import { PageHeader, Table, Th, Td, EmptyState, StatusBadge } from "@/components/ui/primitives";
import { buttonClass } from "@/components/ui/button";
import { updateLeadStatus } from "../actions";
import { dateTime } from "@/lib/format";

const STATUSES = ["new", "contacted", "qualified", "won", "lost"];

export default async function LeadsPage(props: PageProps<"/portal/leads">) {
  const sp = await props.searchParams;
  const status = typeof sp.status === "string" && STATUSES.includes(sp.status) ? sp.status : null;
  const { supabase } = await getPortalContext();
  let q = supabase.from("customer_leads").select("*").order("created_at", { ascending: false }).limit(200);
  if (status) q = q.eq("status", status);
  const { data } = await q;
  return (
    <>
      <PageHeader
        title="Leads"
        description="Every enquiry captured by your automations. Update the status as your team progresses each one."
        actions={<a href="/portal/leads/export" className={buttonClass("secondary", "md")}>Export CSV</a>}
      />
      <div className="mb-4 flex flex-wrap gap-2 text-[13px]">
        <a href="/portal/leads" className={`rounded-md px-3 py-1.5 ${!status ? "bg-ink-700 text-fg" : "text-muted hover:text-fg"}`}>All</a>
        {STATUSES.map((s) => <a key={s} href={`?status=${s}`} className={`rounded-md px-3 py-1.5 capitalize ${status === s ? "bg-ink-700 text-fg" : "text-muted hover:text-fg"}`}>{s}</a>)}
      </div>
      {!data?.length ? <EmptyState title="No leads to show" /> : (
        <Table>
          <thead><tr><Th>Received</Th><Th>Contact</Th><Th>Source</Th><Th>Enquiry</Th><Th>Score</Th><Th>Status</Th></tr></thead>
          <tbody>
            {data.map((l) => (
              <tr key={l.id}>
                <Td className="whitespace-nowrap text-muted">{dateTime(l.created_at)}</Td>
                <Td><p className="text-fg">{l.name ?? "Unknown"}</p><p className="text-[12px] text-subtle">{[l.email, l.phone].filter(Boolean).join(" · ")}</p></Td>
                <Td>{l.source ?? "—"}</Td>
                <Td className="max-w-xs"><p className="line-clamp-2 text-muted">{l.enquiry ?? "—"}</p></Td>
                <Td className="tabular-nums">{l.score ?? "—"}</Td>
                <Td>
                  <form action={updateLeadStatus} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={l.id} />
                    <select name="status" defaultValue={l.status} className="rounded-md border border-line-strong bg-ink-900 px-2 py-1 text-[12.5px] text-fg">
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button className="text-[12px] text-signal-300 hover:underline">Save</button>
                  </form>
                  <div className="mt-1"><StatusBadge status={l.status} /></div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
