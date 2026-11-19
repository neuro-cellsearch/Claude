"use client";
import { useEffect, useState } from "react";
import { Inbox, Sparkles, Database, CalendarCheck, BellRing, Play, RotateCcw, Check } from "lucide-react";
import { cn } from "@/components/ui/cn";

type Scenario = {
  label: string;
  channel: string;
  time: string;
  message: string;
  fields: [string, string][];
  score: number;
  booking: string;
  notify: string;
};

const SCENARIOS: Record<string, Scenario> = {
  roofing: {
    label: "Roofing",
    channel: "Missed call → SMS reply",
    time: "Sat 18:42",
    message: "Hi, we've got water coming through the ceiling after the storm. Can someone look at the roof this week? It's a 3-bed semi in Leeds.",
    fields: [["Service", "Storm damage / leak"], ["Location", "Leeds, LS6"], ["Urgency", "High — active leak"], ["Property", "3-bed semi"]],
    score: 86,
    booking: "Survey · Mon 08:30",
    notify: "SMS to on-call roofer + job sheet emailed",
  },
  estate: {
    label: "Estate agent",
    channel: "Rightmove enquiry",
    time: "Sun 21:15",
    message: "Interested in the 2-bed flat on Park Road. We're first-time buyers with a mortgage agreement in principle. Can we view this week?",
    fields: [["Property", "2-bed flat, Park Road"], ["Position", "First-time buyer"], ["Finance", "AIP in place"], ["Intent", "Viewing request"]],
    score: 91,
    booking: "Viewing · Tue 17:30",
    notify: "Negotiator notified; vendor update queued",
  },
  dental: {
    label: "Dental",
    channel: "Website chat",
    time: "Thu 22:03",
    message: "Do you do Invisalign? I'd like to know roughly what it costs and whether I can come in for a consultation.",
    fields: [["Treatment", "Invisalign"], ["Stage", "Researching options"], ["Request", "Consultation"], ["Clinical Q?", "No — admin only"]],
    score: 78,
    booking: "Consultation · Sat 10:00",
    notify: "Reception task + reminder scheduled",
  },
  gym: {
    label: "Gym",
    channel: "Instagram DM",
    time: "Mon 06:12",
    message: "Hey, do you have a free trial? Looking to start strength training, I work shifts so mornings suit best.",
    fields: [["Goal", "Strength training"], ["Availability", "Early mornings"], ["Offer", "Free trial pass"], ["Source", "Instagram"]],
    score: 72,
    booking: "Trial session · Wed 06:30",
    notify: "Coach notified; post-visit follow-up set",
  },
};

const STEPS = [
  { icon: Inbox, title: "Enquiry arrives", sub: "Any channel, any hour" },
  { icon: Sparkles, title: "AI understands & qualifies", sub: "Using only approved knowledge" },
  { icon: Database, title: "CRM record created", sub: "Scored and categorised" },
  { icon: CalendarCheck, title: "Appointment booked", sub: "From real availability" },
  { icon: BellRing, title: "Team notified, follow-up set", sub: "Nothing forgotten" },
];

export function WorkflowDemo() {
  const [key, setKey] = useState<keyof typeof SCENARIOS>("roofing");
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const s = SCENARIOS[key];

  useEffect(() => {
    if (!playing) return;
    const finished = step >= STEPS.length - 1;
    const t = setTimeout(() => {
      if (finished) setPlaying(false);
      else setStep((x) => x + 1);
    }, finished ? 0 : step < 0 ? 300 : 1100);
    return () => clearTimeout(t);
  }, [playing, step]);

  const run = () => {
    setStep(-1);
    setPlaying(true);
  };

  return (
    <div className="surface relative overflow-hidden p-1.5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-[1.1rem] border-b border-line bg-ink-900/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-signal-400 animate-pulse-dot" />
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Interactive demo · simulated data</span>
        </div>
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Choose an industry">
          {Object.entries(SCENARIOS).map(([k, v]) => (
            <button
              key={k}
              role="tab"
              aria-selected={k === key}
              onClick={() => { setKey(k as keyof typeof SCENARIOS); setStep(-1); setPlaying(false); }}
              className={cn(
                "rounded-md px-2.5 py-1 text-[12px] transition",
                k === key ? "bg-signal-500/15 text-signal-300 ring-1 ring-signal-500/40" : "text-muted hover:text-fg",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_1.15fr] lg:p-5">
        <ol className="space-y-1.5" aria-label="Workflow steps">
          {STEPS.map((st, i) => {
            const done = i < step || (i === step && !playing && step === STEPS.length - 1);
            const active = i === step;
            const Icon = st.icon;
            return (
              <li
                key={st.title}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-500",
                  active ? "border-signal-500/50 bg-signal-500/8 glow-ring" : done ? "border-line bg-ink-800" : "border-transparent opacity-55",
                )}
              >
                <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", active || done ? "bg-signal-500/15 text-signal-300" : "bg-ink-700 text-subtle")}>
                  {done && !active ? <Check size={15} /> : <Icon size={15} />}
                </span>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium text-fg">{st.title}</p>
                  <p className="text-[12px] text-subtle">{st.sub}</p>
                </div>
              </li>
            );
          })}
          <div className="pt-3">
            <button
              onClick={run}
              disabled={playing}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-signal-500 px-4 text-sm font-medium text-white transition hover:bg-signal-400 disabled:opacity-60"
            >
              {step >= STEPS.length - 1 ? <RotateCcw size={15} /> : <Play size={15} />}
              {step >= STEPS.length - 1 ? "Replay" : playing ? "Running…" : "Run workflow"}
            </button>
          </div>
        </ol>

        <div className="min-h-[340px] space-y-3 rounded-xl border border-line bg-ink-900 p-4 font-mono text-[12.5px]">
          <Panel visible={step >= 0} label={`${s.channel} · ${s.time}`}>
            <p className="font-sans text-[13.5px] leading-relaxed text-fg/90">“{s.message}”</p>
          </Panel>
          <Panel visible={step >= 1} label="AI extraction">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {s.fields.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-subtle">{k}</dt>
                  <dd className="text-signal-300">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel visible={step >= 2} label="CRM">
            <div className="flex items-center justify-between">
              <span className="text-fg/90">Lead created · stage: <span className="text-aura-400">qualified</span></span>
              <span className="rounded bg-success/15 px-1.5 py-0.5 text-success">score {s.score}</span>
            </div>
          </Panel>
          <Panel visible={step >= 3} label="Calendar">
            <span className="text-fg/90">{s.booking} — confirmation sent</span>
          </Panel>
          <Panel visible={step >= 4} label="Notifications">
            <span className="text-fg/90">{s.notify}</span>
          </Panel>
          {step < 0 && (
            <p className="pt-24 text-center font-sans text-[13px] text-subtle">Choose an industry and press “Run workflow”.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Panel({ visible, label, children }: { visible: boolean; label: string; children: React.ReactNode }) {
  if (!visible) return null;
  return (
    <div className="animate-fade-up rounded-lg border border-line bg-ink-850 p-3">
      <p className="mb-1.5 text-[10.5px] uppercase tracking-[0.14em] text-subtle">{label}</p>
      {children}
    </div>
  );
}
