"use client";
import { useActionState } from "react";
import Link from "next/link";
import { login, register, requestPasswordReset, updatePassword } from "./actions";
import { Field, Input, Select, Checkbox, SubmitButton, FormMessage } from "@/components/ui/form";
import { INDUSTRY_OPTIONS } from "@/lib/content/industries";
import type { ActionState } from "@/lib/validation";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(login, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email" name="email" error={state?.fieldErrors?.email}><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
      <Field label="Password" name="password" error={state?.fieldErrors?.password}><Input id="password" name="password" type="password" autoComplete="current-password" required /></Field>
      <div className="flex justify-end"><Link href="/forgot-password" className="text-[13px] text-signal-300 hover:underline">Forgot password?</Link></div>
      <FormMessage state={state} />
      <SubmitButton className="w-full" size="lg" pendingText="Signing in…">Sign in</SubmitButton>
    </form>
  );
}

export function RegisterForm({ plan }: { plan?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(register, null);
  const fe = state?.fieldErrors ?? {};
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="plan" value={plan ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" name="fullName" error={fe.fullName}><Input id="fullName" name="fullName" autoComplete="name" required /></Field>
        <Field label="Company" name="companyName" error={fe.companyName}><Input id="companyName" name="companyName" autoComplete="organization" required /></Field>
      </div>
      <Field label="Industry" name="industry">
        <Select id="industry" name="industry" defaultValue="">
          <option value="">Select…</option>
          {INDUSTRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </Field>
      <Field label="Work email" name="email" error={fe.email}><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
      <Field label="Password" name="password" hint="(10+ characters, letters and numbers)" error={fe.password}><Input id="password" name="password" type="password" autoComplete="new-password" required /></Field>
      <Checkbox name="termsAccepted" required label={<>I accept the <Link href="/terms" className="text-signal-300 underline">terms</Link> and have read the <Link href="/privacy" className="text-signal-300 underline">privacy policy</Link>.</>} />
      {fe.termsAccepted && <p className="text-[12.5px] text-danger">{fe.termsAccepted}</p>}
      <Checkbox name="marketingConsent" label="Send me occasional product updates and automation tips (optional)." />
      <FormMessage state={state} />
      <SubmitButton className="w-full" size="lg" pendingText="Creating account…">Create account</SubmitButton>
    </form>
  );
}

export function ForgotForm() {
  const [state, action] = useActionState<ActionState, FormData>(requestPasswordReset, null);
  return (
    <form action={action} className="space-y-4">
      <Field label="Email" name="email"><Input id="email" name="email" type="email" required /></Field>
      <FormMessage state={state} />
      <SubmitButton className="w-full" size="lg" pendingText="Sending…">Send reset link</SubmitButton>
    </form>
  );
}

export function ResetForm() {
  const [state, action] = useActionState<ActionState, FormData>(updatePassword, null);
  if (state?.ok) return <div className="space-y-4"><FormMessage state={state} /><Link href="/portal" className="text-signal-300 underline">Go to portal →</Link></div>;
  return (
    <form action={action} className="space-y-4">
      <Field label="New password" name="password" error={state?.fieldErrors?.password}><Input id="password" name="password" type="password" autoComplete="new-password" required /></Field>
      <Field label="Confirm password" name="confirm" error={state?.fieldErrors?.confirm}><Input id="confirm" name="confirm" type="password" autoComplete="new-password" required /></Field>
      <FormMessage state={state} />
      <SubmitButton className="w-full" size="lg">Update password</SubmitButton>
    </form>
  );
}
