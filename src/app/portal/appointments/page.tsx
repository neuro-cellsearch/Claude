import { getPortalContext } from "../context";
import { PageHeader, Table, Th, Td, EmptyState, StatusBadge, CardHeader, Card } from "@/components/ui/primitives";
import { dateTime } from "@/lib/format";

export default async function AppointmentsPage() {
  const { supabase } = await getPortalContext();
  const now = new Date().toISOString();
  const [{ data: upcoming }, { data: past }] = await Promise.all([
    supabase.from("appointments").select("*").gte("starts_at", now).order("starts_at").limit(100),
    supabase.from("appointments").select("*").lt("starts_at", now).order("starts_at", { ascending: false }).limit(50),
  ]);
  const render = (rows: typeof upcoming) =>
    !rows?.length ? <EmptyState title="No appointments" /> : (
      <Table>
        <thead><tr><Th>When</Th><Th>Appointment</Th><Th>Attendee</Th><Th>Source</Th><Th>Status</Th></tr></thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <Td className="whitespace-nowrap">{dateTime(a.starts_at)}</Td>
              <Td>{a.title}</Td>
              <Td><p>{a.attendee_name ?? "—"}</p><p className="text-[12px] text-subtle">{a.attendee_contact}</p></Td>
              <Td>{a.source ?? "—"}</Td>
              <Td><StatusBadge status={a.status} /></Td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  return (
    <>
      <PageHeader title="Appointments" description="Bookings made, confirmed, rescheduled or cancelled by your automations." />
      <Card><CardHeader title="Upcoming" />{render(upcoming)}</Card>
      <Card className="mt-6"><CardHeader title="Recent" />{render(past)}</Card>
    </>
  );
}
