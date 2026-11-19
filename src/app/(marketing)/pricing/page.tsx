import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { PageHero, Section, SectionHeading, CtaBand } from "@/components/marketing/section";
import { PricingCards, EnterpriseCard, PricingDisclaimer } from "@/components/marketing/pricing-cards";
import { getPlans } from "@/lib/content/plans";

export const metadata: Metadata = { title: "Pricing", description: "Transparent monthly pricing for AI automation: Starter, Growth, Premium and custom Enterprise packages." };
export const revalidate = 300;

const ROWS: [string, boolean | string, boolean | string, boolean | string][] = [
  ["Automation workflows", "1", "Up to 4", "Up to 10"],
  ["Website lead capture", true, true, true],
  ["AI website chatbot", "Basic", "Advanced + qualification", "Advanced + qualification"],
  ["Instant lead notifications", true, true, true],
  ["CRM integration", false, true, true],
  ["Appointment booking & reminders", false, true, true],
  ["Automated follow-up sequences", false, true, true],
  ["AI receptionist (voice)", false, "Add-on", "Included*"],
  ["Advanced CRM automation", false, false, true],
  ["Client dashboard & analytics", "Core", "Full", "Full + custom reports"],
  ["Optimisation reviews", "Monthly report", "Monthly", "Monthly + quarterly strategy"],
  ["Support", "Email", "Priority email", "Priority, 4-hour target"],
];

const FAQ = [
  { q: "Is there a minimum contract?", a: "Plans run month to month after an initial 3-month period, which covers the setup and optimisation phase. Cancel with 30 days' notice after that." },
  { q: "What does the setup fee cover?", a: "Discovery, workflow design, configuration, integration with your tools, end-to-end testing, your approval process and launch support." },
  { q: "What usage is included?", a: "Each proposal sets out allowances for AI conversations, SMS and call minutes based on your expected volumes. Usage above allowance is billed transparently, and you can see consumption in your dashboard." },
  { q: "Are prices inclusive of VAT?", a: "No — all prices exclude VAT, which is added where applicable." },
  { q: "*When is the AI receptionist available?", a: "It depends on your telephony. Most UK landlines, VoIP systems and mobiles can forward calls to it. We confirm compatibility during consultation before you commit." },
  { q: "Can I upgrade later?", a: "Yes. Most clients start with one automation and add more once they see results. Upgrades take effect from your next billing date." },
];

export default async function PricingPage() {
  const plans = await getPlans();
  return (
    <>
      <PageHero eyebrow="Pricing" title="Pay for outcomes, not hours." intro="Every package includes design, setup, testing, hosting, monitoring and support. Start focused, then add automations as they prove their value." />
      <Section>
        <PricingCards plans={plans} />
        <EnterpriseCard />
        <PricingDisclaimer />
      </Section>
      <Section className="pt-0 lg:pt-0">
        <SectionHeading eyebrow="Compare" title="What's included" />
        <div className="mt-8 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[640px] text-left text-[13.5px]">
            <thead>
              <tr className="bg-ink-850">
                <th className="p-4 font-medium text-muted">Feature</th>
                {["Starter", "Growth", "Premium"].map((h) => <th key={h} className="p-4 font-semibold text-fg">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([label, ...cells]) => (
                <tr key={label} className="border-t border-line">
                  <td className="p-4 text-fg/85">{label}</td>
                  {cells.map((c, i) => (
                    <td key={i} className="p-4 text-fg/85">
                      {c === true ? <Check size={16} className="text-success" /> : c === false ? <Minus size={16} className="text-subtle" /> : c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section className="pt-0 lg:pt-0">
        <SectionHeading eyebrow="FAQs" title="Pricing questions" />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {FAQ.map((f) => (
            <div key={f.q} className="surface-raised p-6">
              <p className="font-medium text-fg">{f.q}</p>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{f.a}</p>
            </div>
          ))}
        </div>
      </Section>
      <CtaBand title="Not sure which plan fits?" body="Book a consultation and we'll recommend the smallest package that solves your biggest problem." />
    </>
  );
}
