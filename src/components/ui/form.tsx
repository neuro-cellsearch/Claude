"use client";
import { useFormStatus } from "react-dom";
import { cn } from "./cn";
import { buttonClass } from "./button";
import type { ComponentProps, ReactNode } from "react";

const field =
  "w-full rounded-lg border border-line-strong bg-ink-900 px-3 py-2 text-sm text-fg placeholder:text-subtle transition focus:border-signal-500 focus:outline-none focus:ring-2 focus:ring-signal-500/25 disabled:opacity-60";

export function Label({ htmlFor, children, hint }: { htmlFor?: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-fg/90">
      {children}
      {hint && <span className="ml-1.5 font-normal text-subtle">{hint}</span>}
    </label>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(field, "h-10", className)} {...props} />;
}
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(field, "min-h-[110px] leading-relaxed", className)} {...props} />;
}
export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(field, "h-10 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 fill=%22none%22 stroke=%22%239aa4b4%22 stroke-width=%222%22><path d=%22M2 4l4 4 4-4%22/></svg>')] bg-[right_0.75rem_center] bg-no-repeat pr-9", className)} {...props}>
      {children}
    </select>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-[12.5px] text-danger">{message}</p>;
}

export function Field({
  label, name, error, hint, children,
}: { label: string; name: string; error?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <Label htmlFor={name} hint={hint}>{label}</Label>
      {children}
      <FieldError message={error} />
    </div>
  );
}

export function Checkbox({ name, label, defaultChecked, required, value }: { name: string; label: ReactNode; defaultChecked?: boolean; required?: boolean; value?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-muted">
      <input
        type="checkbox"
        name={name}
        value={value ?? "on"}
        defaultChecked={defaultChecked}
        required={required}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-line-strong bg-ink-900 accent-signal-500"
      />
      <span>{label}</span>
    </label>
  );
}

export function SubmitButton({
  children, pendingText = "Saving…", variant = "primary", size = "md", className, ...props
}: { children: ReactNode; pendingText?: string; variant?: "primary" | "secondary" | "danger" | "outline" | "ghost"; size?: "sm" | "md" | "lg" } & ComponentProps<"button">) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || props.disabled} className={buttonClass(variant, size, className)} {...props}>
      {pending ? pendingText : children}
    </button>
  );
}

export function FormMessage({ state }: { state: { ok?: boolean; error?: string; message?: string } | null }) {
  if (!state) return null;
  if (state.error) return <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">{state.error}</p>;
  if (state.ok && state.message) return <p role="status" className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-[13px] text-success">{state.message}</p>;
  return null;
}
