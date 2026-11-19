import type { Metadata } from "next";
import { PageHero, Section, SectionHeading, CtaBand } from "@/components/marketing/section";
import { getPublishedCaseStudies } from "@/lib/content/proof";
import { Notice } from "@/components/ui/primitives";
import { INDUSTRY_LABEL } from "@/lib/content/industries";

export const metadata: Metadata = { title: "Case studies", description: "Client case studies and worked examples of AI automation for UK businesses." };
export const revalidate = 300;

/** Clearly-labelled hypothetical scenarios. These are NOT client results. */
const SCENARIOS = [
  {
    industry: "Roofing contractor",
    title: "Missed-call text-back and survey booking",
    assumptions: ["~120 inbound calls/month, ~30% unanswered during site work", "Average job value £2,500; typical close rate on surveys 35%"],
    model: "If an instant text-back recovers even 1 in 4 of the ~36 unanswered calls, that's ~9 extra conversations a month. At a 35% close rate, roughly 3 additional jobs — around £7,500 of work — against a Growth plan cost of £799/month.",
  },
  {
    industry: "Independent estate agent",
    title: "Out-of-hours enquiry qualification and viewing booking",
    assumptions: ["~200 portal enquiries/month, ~40% outside office hours", "Negotiator time ~10 minutes to qualify each enquiry"],
    model: "Automated qualification of ~200 enquiries could save roughly 30 hours of negotiator time a month, and out-of-hours applicants receive a reply in seconds rather than the next morning.",
  },
  {
    industry: "Private dental practice",
    title: "Treatment enquiry assistant and reminder automation",
    assumptions: ["~60 treatment enquiries/month", "No-show rate ~8% on consultations worth ~£100 of chair time"],
    model: "Reducing no-shows on 100 monthly appointments from 8% to 5% recovers ~3 appointments a month; converting 2 more implant or aligner enquiries to consultations has far greater value still.",
  },
];

export default async function CaseStudiesPage() {
  const studies = await getPublishedCaseStudies();
  return (
    <>
      <PageHero eyebrow="Case studies" title="Results we can stand behind." intro="We only publish client case studies with the client's written permission and verified figures. Where we don't yet have one for your sector, we show our working instead." />
      {studies.length > 0 && (
        <Section>
          <SectionHeading eyebrow="Client work" title="Published case studies" />
          <div className="mt-10 grid gap-5">
            {studies.map((c) => (
              <article key={c.id} className="surface-raised p-7">
                <p className="eyebrow">{INDUSTRY_LABEL[c.industry] ?? c.industry} · {c.client_name}</p>
                <h3 className="mt-3 text-2xl font-semibold text-fg">{c.headline}</h3>
                <div className="mt-6 grid gap-6 md:grid-cols-3">
                  {[["Challenge", c.challenge], ["Solution", c.solution], ["Results", c.results]].map(([h, b]) => (
                    <div key={h}><p className="text-[12px] font-medium uppercase tracking-wider text-subtle">{h}</p><p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-muted">{b}</p></div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </Section>
      )}
      <Section className={studies.length ? "pt-0 lg:pt-0" : ""}>
        <SectionHeading eyebrow="Worked examples" title="How the numbers can stack up" intro="These are illustrative scenarios built on stated assumptions — not client results. Use them to sanity-check the opportunity in your own business." />
        <div className="mt-8"><Notice tone="amber" title="Hypothetical scenarios">The figures below are modelled examples for illustration only. Actual results depend on your volumes, processes and market, and are not guaranteed.</Notice></div>
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {SCENARIOS.map((s) => (
            <article key={s.title} className="surface-raised flex flex-col p-6">
              <span className="w-fit rounded-md border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">Example scenario</span>
              <p className="mt-4 text-[13px] text-subtle">{s.industry}</p>
              <h3 className="mt-1 text-lg font-semibold text-fg">{s.title}</h3>
              <p className="mt-4 text-[12px] font-medium uppercase tracking-wider text-subtle">Assumptions</p>
              <ul className="mt-2 space-y-1.5 text-[13.5px] text-muted">{s.assumptions.map((a) => <li key={a}>· {a}</li>)}</ul>
              <p className="mt-4 text-[12px] font-medium uppercase tracking-wider text-subtle">Modelled outcome</p>
              <p className="mt-2 text-[13.5px] leading-relaxed text-fg/85">{s.model}</p>
            </article>
          ))}
        </div>
      </Section>
      <CtaBand title="Want this modelled on your numbers?" body="In a consultation we'll build the same calculation using your real volumes and values — and tell you honestly if it doesn't add up." />
    </>
  );
}
