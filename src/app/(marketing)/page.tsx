import Link from "next/link";
import { ArrowRight, ShieldCheck, FlaskConical, Activity, KeyRound, Clock3, PhoneMissed, Repeat, Inbox } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Section, SectionHeading, CtaBand } from "@/components/marketing/section";
import { WorkflowDemo } from "@/components/marketing/workflow-demo";
import { PricingCards, EnterpriseCard, PricingDisclaimer } from "@/components/marketing/pricing-cards";
import { SERVICES } from "@/lib/content/services";
import { INDUSTRIES } from "@/lib/content/industries";
import { getPlans } from "@/lib/content/plans";
import { getPublishedTestimonials } from "@/lib/content/proof";
import { SERVICE_ICONS } from "@/components/ui/icons";
import { BookingWidget } from "@/components/forms/booking-widget";

export const revalidate = 300;

export default async function HomePage() {
  const [plans, testimonials] = await Promise.all([getPlans(), getPublishedTestimonials()]);
  return (
    <>
      {/* HERO */}
      <div className="relative overflow-hidden">
        <div className="hero-aura pointer-events-none absolute inset-0" />
        <div className="grid-backdrop pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-7xl px-5 pb-20 pt-20 lg:px-8 lg:pb-28 lg:pt-28">
          <div className="mx-auto max-w-4xl text-center">
            <p className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-line-strong bg-ink-850/80 px-3 py-1 text-[12px] text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-dot" /> AI automation for UK businesses
            </p>
            <h1 className="mt-6 animate-fade-up text-[2.6rem] font-semibold leading-[1.04] tracking-tight text-fg sm:text-6xl lg:text-7xl">
              Every enquiry answered.<br /><span className="text-gradient">Every opportunity captured.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl animate-fade-up text-[17px] leading-relaxed text-muted sm:text-lg">
              Kairo Systems builds AI receptionists, chatbots and automated follow-up that respond to customers in seconds, book appointments and keep your CRM current — designed around your business, tested before launch and monitored every day.
            </p>
            <div className="mt-9 flex animate-fade-up flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink href="/book" size="lg">Book a free consultation <ArrowRight size={16} /></ButtonLink>
              <ButtonLink href="#demo" size="lg" variant="outline">See a workflow run</ButtonLink>
            </div>
            <p className="mt-5 text-[12.5px] text-subtle">30 minutes · No obligation · Honest advice on whether automation will pay for itself</p>
          </div>
        </div>
      </div>

      {/* PROBLEM */}
      <Section className="pt-6 lg:pt-10">
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { icon: PhoneMissed, t: "Missed calls", b: "Callers who reach voicemail rarely leave a message — they ring the next business." },
            { icon: Clock3, t: "Slow replies", b: "Enquiries that wait until morning are often already booked elsewhere." },
            { icon: Repeat, t: "Repetitive admin", b: "Skilled people re-keying data, chasing documents and answering the same questions." },
            { icon: Inbox, t: "Forgotten follow-ups", b: "Quotes and leads go cold because following up relies on memory." },
          ].map(({ icon: Icon, t, b }) => (
            <div key={t} className="surface-raised p-5">
              <Icon size={18} className="text-signal-300" />
              <p className="mt-4 font-medium text-fg">{t}</p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{b}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* WHAT WE AUTOMATE */}
      <Section className="pt-0 lg:pt-0">
        <SectionHeading
          eyebrow="What we automate"
          title="Six systems that work together from first contact to booked customer."
          intro="Start with the one that fixes your biggest leak, then connect the rest as you grow. Every system uses proven platforms — not experimental code."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => {
            const Icon = SERVICE_ICONS[s.icon];
            return (
              <Link key={s.slug} href={`/services/${s.slug}`} className="group surface-raised p-6 transition hover:border-signal-500/50">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-signal-500/12 text-signal-300 ring-1 ring-signal-500/25"><Icon size={18} /></span>
                <p className="mt-5 text-[16px] font-semibold text-fg">{s.name}</p>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{s.short}</p>
                <p className="mt-5 inline-flex items-center gap-1 text-[13px] text-signal-300 transition group-hover:gap-2">Learn more <ArrowRight size={14} /></p>
              </Link>
            );
          })}
        </div>
      </Section>

      {/* DEMO */}
      <Section id="demo" className="pt-0 lg:pt-0">
        <SectionHeading
          eyebrow="See it work"
          title="From a 9pm enquiry to a booked appointment — in seconds."
          intro="Pick an industry and run the workflow. This demonstration uses simulated data to show the steps a real Kairo system performs."
        />
        <div className="mt-10"><WorkflowDemo /></div>
      </Section>

      {/* INDUSTRIES */}
      <Section className="pt-0 lg:pt-0">
        <SectionHeading eyebrow="Industry solutions" title="Built around how your sector actually works." />
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {INDUSTRIES.map((i) => (
            <Link key={i.slug} href={`/industries/${i.slug}`} className="group rounded-xl border border-line bg-ink-850 p-5 transition hover:border-signal-500/40 hover:bg-ink-800">
              <p className="font-medium text-fg">{i.name}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{i.short}</p>
            </Link>
          ))}
        </div>
      </Section>

      {/* HOW WE WORK / TRUST */}
      <Section className="pt-0 lg:pt-0">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <SectionHeading
            eyebrow="How we deliver"
            title="Nothing goes live until it's tested and you've approved it."
            intro="Automation that says the wrong thing is worse than none at all. Our process is built to make sure every workflow does exactly what you agreed — and keeps doing it."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: FlaskConical, t: "Tested end-to-end", b: "Every workflow is run against real scenarios and the results are recorded before launch." },
              { icon: ShieldCheck, t: "Approved knowledge only", b: "AI assistants answer from information you sign off — nothing improvised." },
              { icon: Activity, t: "Monitored daily", b: "Every run is logged. Failures alert our team immediately." },
              { icon: KeyRound, t: "Secure by design", b: "Credentials encrypted, UK GDPR-conscious data handling, least-privilege access." },
            ].map(({ icon: Icon, t, b }) => (
              <div key={t} className="surface-raised p-5">
                <Icon size={18} className="text-aura-400" />
                <p className="mt-3 font-medium text-fg">{t}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* TESTIMONIALS — rendered only when genuine, client-approved testimonials exist */}
      {testimonials.length > 0 && (
        <Section className="pt-0 lg:pt-0">
          <SectionHeading eyebrow="Client feedback" title="In our clients' words." />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {testimonials.map((t) => (
              <figure key={t.id} className="surface-raised p-6">
                <blockquote className="text-[14.5px] leading-relaxed text-fg/90">“{t.quote}”</blockquote>
                <figcaption className="mt-4 text-[13px] text-muted">{t.author_name}{t.author_role && `, ${t.author_role}`}{t.company && ` · ${t.company}`}</figcaption>
              </figure>
            ))}
          </div>
        </Section>
      )}

      {/* PRICING */}
      <Section className="pt-0 lg:pt-0">
        <SectionHeading eyebrow="Packages" title="Clear monthly pricing. No long lock-ins." intro="Every package includes setup, testing, hosting, monitoring and support. Prices exclude VAT." center />
        <div className="mt-12"><PricingCards plans={plans} /></div>
        <EnterpriseCard />
        <PricingDisclaimer />
      </Section>

      {/* BOOKING */}
      <Section id="book" className="pt-0 lg:pt-0">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <SectionHeading
            eyebrow="Book a consultation"
            title="30 minutes to find your biggest opportunity."
            intro={<>We'll look at how enquiries reach you, where they're lost and which automation would pay back fastest. You'll leave with a clear recommendation — whether or not you work with us.</>}
          />
          <BookingWidget />
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
