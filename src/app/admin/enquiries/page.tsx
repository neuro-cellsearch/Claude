import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Badge, StatusBadge, Table, Th, Td, EmptyState } from "@/components/ui/primitives";
import { dateTime, gbp } from "@/lib/format";
import { INDUSTRY_LABEL } from "@/lib/content/industries";
import { cn } from "@/components/ui/cn";

const STAGES = ["new", "contacted", "qualified", "proposal_sent", "won", "lost"] as const;

export default async function EnquiriesPage(props: PageProps<"/admin/enquiries">) {
  const sp = await props.searchParams;
  const view = sp.view === "table" ? "table" : "board";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  let query = createAdminClient().from("enquiries").select("*").order("created_at", { ascending: false }).limit(500);
  if (q) query = query.or(`name.ilike.%${q.replace(/[%,()]/g, "")}%,email.ilike.%${q.replace(/[%,()]/g, "")}%,company.ilike.%${q.replace(/[%,()]/g, "")}%`);
  const { data } = await query;
  const rows = data ?? [];
  const overdue = (e: (typeof rows)[number]) => e.next_follow_up_at && new Date(e.next_follow_up_at) < new Date() && ["new", "contacted", "qualified"].includes(e.stage);

  return (
    <>
      <PageHeader title="Enquiries & pipeline" description="Every inbound lead from forms, bookings, chat and proposals — scored and tracked to close." />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <form className="flex gap-2"><input name="q" defaultValue={q} placeholder="Search name, email, company" className="h-9 w-64 rounded-lg border border-line-strong bg-ink-900 px-3 text-sm text-fg" /><input type="hidden" name="view" value={view} /></form>
        <div className="flex gap-1 rounded-lg border border-line p-1 text-[13px]">
          <Link href={`?view=board${q ? `&q=${q}` : ""}`} className={cn("rounded px-3 py-1", view === "board" ? "bg-ink-700 text-fg" : "text-muted")}>Board</Link>
          <Link href={`?view=table${q ? `&q=${q}` : ""}`} className={cn("rounded px-3 py-1", view === "table" ? "bg-ink-700 text-fg" : "text-muted")}>Table</Link>
        </div>
      </div>
      {!rows.length ? <EmptyState title="No enquiries yet" description="Enquiries from the website appear here instantly." /> : view === "board" ? (
        <div className="grid gap-3 overflow-x-auto pb-2 lg:grid-cols-6">
          {STAGES.map((s) => {
            const col = rows.filter((e) => e.stage === s);
            return (
              <div key={s} className="min-w-[220px] rounded-xl border border-line bg-ink-900 p-2.5">
                <div className="mb-2 flex items-center justify-between px-1"><p className="text-[12px] font-medium uppercase tracking-wider text-muted">{s.replace("_", " ")}</p><span className="text-[12px] text-subtle">{col.length}</span></div>
                <div className="space-y-2">
                  {col.slice(0, 40).map((e) => (
                    <Link key={e.id} href={`/admin/enquiries/${e.id}`} className="block rounded-lg border border-line bg-ink-800 p-3 transition hover:border-signal-500/40">
                      <div className="flex items-start justify-between gap-2"><p className="text-[13px] font-medium text-fg">{e.company || e.name}</p><Badge tone={e.score >= 60 ? "green" : e.score >= 35 ? "blue" : "neutral"}>{e.score}</Badge></div>
                      <p className="mt-0.5 text-[12px] text-subtle">{e.type} · {INDUSTRY_LABEL[e.industry ?? ""] ?? "—"}</p>
                      {overdue(e) && <p className="mt-1 text-[11.5px] text-warning">Follow-up overdue</p>}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Table>
          <thead><tr><Th>Received</Th><Th>Contact</Th><Th>Type</Th><Th>Industry</Th><Th>Score</Th><Th>Value</Th><Th>Stage</Th><Th>Follow-up</Th></tr></thead>
          <tbody>{rows.map((e) => (
            <tr key={e.id}>
              <Td className="whitespace-nowrap text-muted">{dateTime(e.created_at)}</Td>
              <Td><Link className="text-fg hover:text-signal-300" href={`/admin/enquiries/${e.id}`}>{e.name}</Link><p className="text-[12px] text-subtle">{e.company} · {e.email}</p></Td>
              <Td>{e.type}</Td><Td>{INDUSTRY_LABEL[e.industry ?? ""] ?? "—"}</Td><Td className="tabular-nums">{e.score}</Td>
              <Td>{e.estimated_monthly_pence ? `${gbp(e.estimated_monthly_pence)}/mo` : "—"}</Td><Td><StatusBadge status={e.stage} /></Td>
              <Td className={overdue(e) ? "text-warning" : "text-muted"}>{dateTime(e.next_follow_up_at)}</Td>
            </tr>
          ))}</tbody>
        </Table>
      )}
    </>
  );
}
