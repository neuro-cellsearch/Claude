import { getPortalContext } from "../context";
import { PageHeader, Card, CardHeader, Table, Th, Td, StatusBadge, EmptyState } from "@/components/ui/primitives";
import { ActionForm } from "@/components/forms/action-form";
import { Field, Textarea, Select } from "@/components/ui/form";
import { requestAutomation } from "../actions";
import { SERVICE_OPTIONS, SERVICE_BY_KEY } from "@/lib/content/services";
import { date } from "@/lib/format";

export default async function RequestsPage() {
  const { supabase } = await getPortalContext();
  const { data } = await supabase.from("automation_requests").select("*").order("created_at", { ascending: false });
  return (
    <>
      <PageHeader title="Request an automation" description="Tell us what else you'd like automated. We'll scope it and confirm any cost before starting." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="New request" />
          <ActionForm action={requestAutomation} submitLabel="Submit request" resetOnSuccess>
            <Field label="Type" name="service_key">
              <Select id="service_key" name="service_key" defaultValue="workflow_automation">
                {SERVICE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </Field>
            <Field label="Describe what you need" name="description"><Textarea id="description" name="description" className="min-h-[140px]" placeholder="e.g. When a job is marked complete in Tradify, send the customer a review request by SMS two days later." required /></Field>
          </ActionForm>
        </Card>
        <Card>
          <CardHeader title="Previous requests" />
          {!data?.length ? <EmptyState title="No requests yet" /> : (
            <Table>
              <thead><tr><Th>Date</Th><Th>Type</Th><Th>Status</Th></tr></thead>
              <tbody>{data.map((r) => (
                <tr key={r.id}><Td>{date(r.created_at)}</Td><Td><p>{SERVICE_BY_KEY[r.service_key]?.name ?? r.service_key}</p><p className="line-clamp-2 text-[12px] text-subtle">{r.description}</p>{r.admin_notes && <p className="mt-1 text-[12px] text-signal-300">{r.admin_notes}</p>}</Td><Td><StatusBadge status={r.status} /></Td></tr>
              ))}</tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
