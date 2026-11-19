"use client";
import { useActionState } from "react";
import Link from "next/link";
import { submitEnquiry } from "@/app/(marketing)/actions";
import { Field, Input, Textarea, Select, Checkbox, SubmitButton, FormMessage, Label } from "@/components/ui/form";
import { SERVICE_OPTIONS } from "@/lib/content/services";
import { INDUSTRY_OPTIONS } from "@/lib/content/industries";
import type { ActionState } from "@/lib/validation";
import { CheckCircle2 } from "lucide-react";

export function EnquiryForm({ type, defaultService }: { type: "contact" | "quote"; defaultService?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(submitEnquiry, null);
  const fe = state?.fieldErrors ?? {};

  if (state?.ok) {
    return (
      <div className="surface-raised flex flex-col items-center p-10 text-center">
        <CheckCircle2 className="text-success" size={36} />
        <p className="mt-4 text-lg font-semibold text-fg">Received</p>
        <p className="mt-2 max-w-sm text-sm text-muted">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className="surface-raised space-y-5 p-6 sm:p-8" noValidate>
      <input type="hidden" name="type" value={type} />
      <div className="hidden" aria-hidden="true">
        <label>Website <input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" name="name" error={fe.name}><Input id="name" name="name" autoComplete="name" required /></Field>
        <Field label="Work email" name="email" error={fe.email}><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
        <Field label="Phone" name="phone" hint="(optional)" error={fe.phone}><Input id="phone" name="phone" type="tel" autoComplete="tel" /></Field>
        <Field label="Company" name="company" error={fe.company}><Input id="company" name="company" autoComplete="organization" /></Field>
        <Field label="Industry" name="industry" error={fe.industry}>
          <Select id="industry" name="industry" defaultValue="">
            <option value="">Select…</option>
            {INDUSTRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
        {type === "quote" ? (
          <Field label="Your role" name="role" hint="(optional)"><Input id="role" name="role" /></Field>
        ) : <div className="hidden sm:block" />}
      </div>

      {type === "quote" && (
        <>
          <div>
            <Label>Which automations interest you?</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {SERVICE_OPTIONS.map((s) => (
                <Checkbox key={s.value} name="services" value={s.value} label={s.label} defaultChecked={s.value === defaultService} />
              ))}
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Enquiries you receive per month" name="monthlyEnquiries">
              <Select id="monthlyEnquiries" name="monthlyEnquiries" defaultValue="unsure">
                <option value="unsure">Not sure</option>
                <option value="under_25">Under 25</option>
                <option value="25_100">25–100</option>
                <option value="100_500">100–500</option>
                <option value="500_plus">500+</option>
              </Select>
            </Field>
            <Field label="Monthly budget (ex. VAT)" name="budget">
              <Select id="budget" name="budget" defaultValue="unsure">
                <option value="unsure">Not sure yet</option>
                <option value="under_300">Under £300</option>
                <option value="300_750">£300–£750</option>
                <option value="750_1500">£750–£1,500</option>
                <option value="over_1500">£1,500+</option>
              </Select>
            </Field>
          </div>
        </>
      )}

      <Field label={type === "quote" ? "What would you like to automate?" : "How can we help?"} name="message" error={fe.message}>
        <Textarea id="message" name="message" placeholder={type === "quote" ? "e.g. We miss calls while on site and want enquiries answered and surveys booked automatically. We use Google Calendar and HubSpot." : ""} />
      </Field>

      <div className="space-y-2.5">
        <Checkbox name="privacyAccepted" required label={<>I've read the <Link href="/privacy" className="text-signal-300 underline">privacy policy</Link> and agree to Kairo Systems using these details to respond to my enquiry.</>} />
        {fe.privacyAccepted && <p className="text-[12.5px] text-danger">{fe.privacyAccepted}</p>}
        <Checkbox name="marketingConsent" label="Optional: send me occasional insights on automation. Unsubscribe at any time." />
      </div>

      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full sm:w-auto" pendingText="Sending…">
        {type === "quote" ? "Request my tailored quote" : "Send message"}
      </SubmitButton>
    </form>
  );
}
