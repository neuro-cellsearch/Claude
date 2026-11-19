import { PageHeader, Card } from "@/components/ui/primitives";
import { ActionForm } from "@/components/forms/action-form";
import { Field, Input, Textarea, Select } from "@/components/ui/form";
import { createTicket } from "../../actions";

export default function NewTicketPage() {
  return (
    <>
      <PageHeader title="New support request" />
      <Card className="max-w-2xl">
        <ActionForm action={createTicket} submitLabel="Submit request" pendingText="Submitting…">
          <Field label="Subject" name="subject"><Input id="subject" name="subject" required /></Field>
          <Field label="Priority" name="priority">
            <Select id="priority" name="priority" defaultValue="normal">
              <option value="low">Low — question or minor change</option>
              <option value="normal">Normal</option>
              <option value="high">High — affecting customers</option>
              <option value="urgent">Urgent — automation down</option>
            </Select>
          </Field>
          <Field label="Details" name="body"><Textarea id="body" name="body" className="min-h-[160px]" required /></Field>
        </ActionForm>
      </Card>
    </>
  );
}
