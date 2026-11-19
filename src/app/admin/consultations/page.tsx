import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Card, CardHeader, Table, Th, Td, EmptyState } from "@/components/ui/primitives";
import { Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { updateConsultation, addAvailability, deleteAvailability } from "../_actions/crm";
import { dateTime } from "@/lib/format";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export default async function ConsultationsPage() {
  const db = createAdminClient();
  const [{ data: upcoming }, { data: past }, { data: rules }] = await Promise.all([
    db.from("consultations").select("*, enquiries(id,name,company,email,phone)").gte("scheduled_for", new Date(Date.now() - 3600_000).toISOString()).order("scheduled_for").limit(100),
    db.from("consultations").select("*, enquiries(id,name,company)").lt("scheduled_for", new Date(Date.now() - 3600_000).toISOString()).order("scheduled_for", { ascending: false }).limit(30),
    db.from("availability_rules").select("*").order("weekday").order("start_minute"),
  ]);
  const row = (c: NonNullable<typeof upcoming>[number]) => {
    const e = c.enquiries as { id: string; name: string; company: string | null; email?: string; phone?: string } | null;
    return (
      <tr key={c.id}>
        <Td className="whitespace-nowrap">{dateTime(c.scheduled_for)}</Td>
        <Td>{e ? <Link className="text-fg hover:text-signal-300" href={`/admin/enquiries/${e.id}`}>{e.company || e.name}</Link> : "—"}<p className="text-[12px] text-subtle">{e?.email} {e?.phone}</p></Td>
        <Td>
          <form action={updateConsultation} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={c.id} />
            <select name="status" defaultValue={c.status} className="rounded-md border border-line-strong bg-ink-900 px-2 py-1 text-[12.5px]">{["scheduled", "completed", "cancelled", "no_show"].map((s) => <option key={s}>{s}</option>)}</select>
            <input name="meeting_url" defaultValue={c.meeting_url ?? ""} placeholder="https://meet…" className="w-44 rounded-md border border-line-strong bg-ink-900 px-2 py-1 text-[12.5px]" />
            <input name="notes" defaultValue={c.notes ?? ""} placeholder="Notes" className="w-44 rounded-md border border-line-strong bg-ink-900 px-2 py-1 text-[12.5px]" />
            <button className="text-[12px] text-signal-300">Save</button>
          </form>
        </Td>
      </tr>
    );
  };
  return (
    <>
      <PageHeader title="Consultations" description="Bookings from the website calendar. Cancelling a consultation releases the slot." />
      <Card><CardHeader title="Upcoming" />{upcoming?.length ? <Table><thead><tr><Th>When (UK)</Th><Th>Who</Th><Th>Manage</Th></tr></thead><tbody>{upcoming.map(row)}</tbody></Table> : <EmptyState title="No upcoming consultations" />}</Card>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Weekly availability" description="Times are UK local time. Slots within 12 hours are not offered." />
          <ul className="mb-4 divide-y divide-line rounded-lg border border-line">
            {(rules ?? []).map((r) => (
              <li key={r.id} className="flex items-center justify-between px-3 py-2 text-[13px]"><span>{DAYS[r.weekday]} {hhmm(r.start_minute)}–{hhmm(r.end_minute)} · {r.slot_minutes} min</span>
                <form action={deleteAvailability}><input type="hidden" name="id" value={r.id} /><button className="text-[12px] text-danger">Remove</button></form></li>
            ))}
            {!rules?.length && <li className="px-3 py-2 text-[13px] text-muted">No availability — the booking page will show no slots.</li>}
          </ul>
          <form action={addAvailability} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Select name="weekday" defaultValue="1">{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</Select>
            <Input type="time" name="start" defaultValue="09:30" /><Input type="time" name="end" defaultValue="17:00" />
            <Select name="slot_minutes" defaultValue="30"><option value="30">30 min</option><option value="45">45 min</option><option value="60">60 min</option></Select>
            <Button variant="secondary">Add</Button>
          </form>
        </Card>
        <Card><CardHeader title="Recent" />{past?.length ? <Table><thead><tr><Th>When</Th><Th>Who</Th><Th>Manage</Th></tr></thead><tbody>{past.map(row)}</tbody></Table> : <EmptyState title="No past consultations" />}</Card>
      </div>
    </>
  );
}
