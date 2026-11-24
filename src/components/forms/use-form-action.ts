"use client";
import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import type { ActionState } from "@/lib/validation";

/**
 * Submits a form to a server action WITHOUT React 19's automatic form reset.
 * React resets uncontrolled fields after every `action={...}` submission — even when
 * the action returns a validation error — which wiped everything the user typed.
 * Here fields are kept on error, and only reset after success when `resetOnSuccess`.
 */
export function useFormAction(
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>,
  opts: { resetOnSuccess?: boolean } = {},
) {
  const [state, dispatch, pending] = useActionState<ActionState, FormData>(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && opts.resetOnSuccess) formRef.current?.reset();
  }, [state, opts.resetOnSuccess]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const fd = new FormData(e.currentTarget, submitter);
    startTransition(() => dispatch(fd));
  }

  return { state, pending, onSubmit, formRef };
}
