"use client";
import { useEffect, useMemo, useState } from "react";
import { useFormAction } from "./use-form-action";
import Link from "next/link";
import { submitEnquiry } from "@/app/(marketing)/actions";
import { Field, Input, Textarea, Select, Checkbox, SubmitButton, FormMessage } from "@/components/ui/form";
import { INDUSTRY_OPTIONS } from "@/lib/content/industries";
import { CalendarCheck2, CheckCircle2 } from "lucide-react";
import { cn } from "@/components/ui/cn";

const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" });

export function BookingWidget() {
  const [slots, setSlots] = useState<string[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const { state, pending, onSubmit } = useFormAction(submitEnquiry);
  const fe = state?.fieldErrors ?? {};

  useEffect(() => {
    fetch("/api/consultations/slots")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Unavailable");
        setSlots(j.slots);
      })
      .catch((e) => setLoadError(e.message));
  }, [state?.error]);

  const byDay = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of slots ?? []) {
      const k = keyFmt.format(new Date(s));
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return m;
  }, [slots]);
  const days = Array.from(byDay.keys());
  const activeDay = day ?? days[0] ?? null;

  if (state?.ok) {
    return (
      <div className="surface-raised flex flex-col items-center p-10 text-center">
        <CheckCircle2 className="text-success" size={36} />
        <p className="mt-4 text-lg font-semibold text-fg">You're booked in</p>
        <p className="mt-2 text-sm text-muted">{slot && `${dayFmt.format(new Date(slot))} at ${timeFmt.format(new Date(slot))} (UK time). `}{state.message}</p>
      </div>
    );
  }

  return (
    <div className="surface-raised overflow-hidden">
      <div className="border-b border-line p-6">
        <div className="flex items-center gap-2 text-fg"><CalendarCheck2 size={18} className="text-signal-300" /><p className="font-semibold">Choose a time (UK time, 30 minutes)</p></div>
        {loadError && <p className="mt-4 text-sm text-warning">Online booking is unavailable right now ({loadError}). Please use the <Link className="underline" href="/contact">contact form</Link>.</p>}
        {!slots && !loadError && <p className="mt-4 text-sm text-muted">Loading availability…</p>}
        {slots && slots.length === 0 && <p className="mt-4 text-sm text-muted">No slots are open in the next two weeks. Please <Link className="underline" href="/contact">contact us</Link> and we'll find a time.</p>}
        {days.length > 0 && (
          <>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {days.map((d) => (
                <button key={d} type="button" onClick={() => { setDay(d); setSlot(null); }}
                  className={cn("shrink-0 rounded-lg border px-3 py-2 text-[13px] transition", d === activeDay ? "border-signal-500 bg-signal-500/10 text-fg" : "border-line text-muted hover:text-fg")}>
                  {dayFmt.format(new Date(byDay.get(d)![0]))}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {(activeDay ? byDay.get(activeDay) ?? [] : []).map((s) => (
                <button key={s} type="button" onClick={() => setSlot(s)}
                  className={cn("rounded-lg border py-2 text-[13px] tabular-nums transition", s === slot ? "border-signal-500 bg-signal-500 text-white" : "border-line text-fg/90 hover:border-signal-500/60")}>
                  {timeFmt.format(new Date(s))}
                </button>
              ))}
            </div>
          </>
        )}
        {fe.slot && <p className="mt-3 text-[12.5px] text-danger">{fe.slot}</p>}
      </div>

      <form onSubmit={onSubmit} className="space-y-5 p-6">
        <input type="hidden" name="type" value="consultation" />
        <input type="hidden" name="slot" value={slot ?? ""} />
        <div className="hidden" aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off" /></div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name" name="name" error={fe.name}><Input id="name" name="name" required autoComplete="name" /></Field>
          <Field label="Work email" name="email" error={fe.email}><Input id="email" name="email" type="email" required autoComplete="email" /></Field>
          <Field label="Phone" name="phone" hint="(optional)" error={fe.phone}><Input id="phone" name="phone" type="tel" /></Field>
          <Field label="Company" name="company"><Input id="company" name="company" /></Field>
          <Field label="Industry" name="industry">
            <Select id="industry" name="industry" defaultValue="">
              <option value="">Select…</option>
              {INDUSTRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="What would you like to discuss?" name="message" hint="(optional)"><Textarea id="message" name="message" className="min-h-[80px]" /></Field>
        <Checkbox name="privacyAccepted" required label={<>I agree to Kairo Systems using these details to arrange and hold this consultation, as described in the <Link href="/privacy" className="text-signal-300 underline">privacy policy</Link>.</>} />
        {fe.privacyAccepted && <p className="text-[12.5px] text-danger">{fe.privacyAccepted}</p>}
        <FormMessage state={state} />
        <SubmitButton size="lg" disabled={!slot} pendingText="Booking…" pending={pending}>{slot ? `Book ${dayFmt.format(new Date(slot))}, ${timeFmt.format(new Date(slot))}` : "Select a time above"}</SubmitButton>
      </form>
    </div>
  );
}
