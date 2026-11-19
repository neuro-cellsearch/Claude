"use client";
import { useActionState, type ReactNode } from "react";
import { SubmitButton, FormMessage } from "@/components/ui/form";
import type { ActionState } from "@/lib/validation";
import { cn } from "@/components/ui/cn";

/**
 * Wraps a server action returning ActionState. Fields are passed as children so
 * pages stay server-rendered; validation errors are listed beneath the form.
 */
export function ActionForm({
  action, children, submitLabel, pendingText, className, variant = "primary", size = "md", resetOnSuccess = false, hideSubmit = false,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children?: ReactNode; submitLabel: string; pendingText?: string; className?: string;
  variant?: "primary" | "secondary" | "danger" | "outline" | "ghost"; size?: "sm" | "md" | "lg"; resetOnSuccess?: boolean; hideSubmit?: boolean;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, null);
  const errs = state?.fieldErrors ? Object.entries(state.fieldErrors) : [];
  return (
    <form action={formAction} className={cn("space-y-4", className)} key={resetOnSuccess && state?.ok ? String(Date.now()) : undefined}>
      {children}
      {errs.length > 0 && (
        <ul className="space-y-0.5 text-[12.5px] text-danger">
          {errs.map(([k, v]) => <li key={k}>{k.replace(/_/g, " ")}: {v}</li>)}
        </ul>
      )}
      <FormMessage state={state} />
      {!hideSubmit && <SubmitButton variant={variant} size={size} pendingText={pendingText}>{submitLabel}</SubmitButton>}
    </form>
  );
}
