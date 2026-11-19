import Link from "next/link";
import { getPortalContext } from "../context";
import { PageHeader, Table, Th, Td, EmptyState, Badge } from "@/components/ui/primitives";
import { dateTime } from "@/lib/format";

const PAGE = 50;

export default async function ActivityPage(props: PageProps<"/portal/activity">) {
  const sp = await props.searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { supabase } = await getPortalContext();
  const { data, count } = await supabase
    .from("automation_events")
    .select("id,event_type,summary,occurred_at,automations(name)", { count: "exact" })
    .order("occurred_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  const pages = Math.ceil((count ?? 0) / PAGE);
  return (
    <>
      <PageHeader title="Automation activity" description="A complete log of actions your live automations have performed." />
      {!data?.length ? <EmptyState title="No activity yet" description="Activity is reported by live automations after they've been tested and approved." /> : (
        <>
          <Table>
            <thead><tr><Th>When</Th><Th>Automation</Th><Th>Event</Th><Th>Summary</Th></tr></thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id}>
                  <Td className="whitespace-nowrap text-muted">{dateTime(e.occurred_at)}</Td>
                  <Td>{(e.automations as unknown as { name: string } | null)?.name ?? "—"}</Td>
                  <Td><Badge tone="blue">{e.event_type}</Badge></Td>
                  <Td>{e.summary}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {pages > 1 && (
            <div className="mt-4 flex gap-3 text-[13px]">
              {page > 1 && <Link className="text-signal-300" href={`?page=${page - 1}`}>← Newer</Link>}
              <span className="text-subtle">Page {page} of {pages}</span>
              {page < pages && <Link className="text-signal-300" href={`?page=${page + 1}`}>Older →</Link>}
            </div>
          )}
        </>
      )}
    </>
  );
}
