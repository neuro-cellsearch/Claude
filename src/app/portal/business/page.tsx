import { getPortalContext } from "../context";
import { PageHeader, Card, CardHeader } from "@/components/ui/primitives";
import { ActionForm } from "@/components/forms/action-form";
import { Field, Input, Textarea, Select, Checkbox } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";
import { updateBusinessInfo, updateProfile, requestDataDeletion } from "../actions";
import { INDUSTRY_OPTIONS } from "@/lib/content/industries";

export default async function BusinessPage() {
  const { org, profile } = await getPortalContext();
  if (!org) return null;
  return (
    <>
      <PageHeader title="Business details" description="Keep your information current — your automations use it." />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader title="Business information" />
          <ActionForm action={updateBusinessInfo} submitLabel="Save changes">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Business name" name="name"><Input id="name" name="name" defaultValue={org.name} required /></Field>
              <Field label="Industry" name="industry">
                <Select id="industry" name="industry" defaultValue={org.industry ?? ""}>
                  <option value="">Select…</option>
                  {INDUSTRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </Field>
              <Field label="Website" name="website"><Input id="website" name="website" defaultValue={org.website ?? ""} /></Field>
              <Field label="Phone" name="phone"><Input id="phone" name="phone" defaultValue={org.phone ?? ""} /></Field>
              <Field label="Company number" name="company_number"><Input id="company_number" name="company_number" defaultValue={org.company_number ?? ""} /></Field>
              <Field label="Team size" name="employee_count"><Input id="employee_count" name="employee_count" defaultValue={org.employee_count ?? ""} /></Field>
            </div>
            <Field label="Address" name="address"><Input id="address" name="address" defaultValue={org.address ?? ""} /></Field>
            <Field label="Opening hours" name="business_hours"><Textarea id="business_hours" name="business_hours" className="min-h-[70px]" defaultValue={org.business_hours ?? ""} /></Field>
            <Field label="Description" name="description"><Textarea id="description" name="description" defaultValue={org.description ?? ""} /></Field>
          </ActionForm>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Your profile" description={profile.email} />
            <ActionForm action={updateProfile} submitLabel="Update profile">
              <Field label="Full name" name="full_name"><Input id="full_name" name="full_name" defaultValue={profile.full_name ?? ""} /></Field>
              <Field label="Phone" name="phone"><Input id="phone" name="phone" defaultValue={profile.phone ?? ""} /></Field>
              <Checkbox name="marketing_consent" defaultChecked={profile.marketing_consent} label="Receive product updates and tips by email" />
            </ActionForm>
          </Card>
          <Card>
            <CardHeader title="Your data" description="Your rights under UK GDPR." />
            <a href="/portal/data-export" className={buttonClass("secondary", "md", "w-full")}>Download my data (JSON)</a>
            <div className="mt-4 border-t border-line pt-4">
              <p className="mb-3 text-[13px] text-muted">Request deletion of your account and data. Records we must keep by law (e.g. invoices) are retained for the legal period.</p>
              <ActionForm action={requestDataDeletion} submitLabel="Request data deletion" variant="danger" />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
