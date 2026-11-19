import type { Metadata } from "next";
import { PageHero, Section, SectionHeading, CtaBand } from "@/components/marketing/section";

export const metadata: Metadata = { title: "About us", description: "Kairo Systems designs, tests and runs AI automation for UK businesses — practical, accountable and secure." };

const PRINCIPLES = [
  { t: "Outcomes over technology", b: "We start with where your business loses time and revenue. If automation won't pay for itself, we'll tell you." },
  { t: "Tested before trusted", b: "No workflow goes live without recorded tests and your explicit approval. Ever." },
  { t: "Honest by default", b: "AI assistants identify themselves, only say what you've approved, and hand over to humans when it matters." },
  { t: "Proven platforms", b: "We build on established infrastructure — OpenAI, Twilio, n8n, Stripe, Supabase — so your systems are reliable and portable." },
  { t: "Security and privacy", b: "Encrypted credentials, least-privilege access and UK GDPR-conscious data handling are built in, not bolted on." },
  { t: "Partnership, not projects", b: "Automations need tuning as your business changes. We monitor, report and improve every month." },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About Kairo Systems"
        title="We build the systems that make sure no opportunity is missed."
        intro={<>Kairo comes from <em>kairos</em> — the Greek idea of the opportune moment. For most businesses, that moment is the instant a customer gets in touch. We make sure someone — or something — always answers.</>}
      />
      <Section>
        <div className="grid gap-12 lg:grid-cols-2">
          <SectionHeading eyebrow="Why we exist" title="Great businesses lose work for avoidable reasons." />
          <div className="space-y-5 text-[16px] leading-relaxed text-muted">
            <p>Tradespeople on a roof can't answer the phone. Dental receptionists can't reply to a 10pm enquiry. Recruiters spend half their day on admin. None of this reflects the quality of the business — but it decides who wins the customer.</p>
            <p>AI has made it possible to fix these gaps affordably. But badly implemented automation does damage: assistants that invent answers, workflows that silently fail, data handled carelessly. We exist to do it properly — designed around your processes, tested, approved and monitored.</p>
            <p>We work with UK businesses first, combining automation engineering with an understanding of the UK's data protection and electronic marketing rules.</p>
          </div>
        </div>
      </Section>
      <Section className="pt-0 lg:pt-0">
        <SectionHeading eyebrow="How we work" title="Our principles" />
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PRINCIPLES.map((p, i) => (
            <div key={p.t} className="surface-raised p-6">
              <span className="font-mono text-[12px] text-signal-300">0{i + 1}</span>
              <p className="mt-2 font-semibold text-fg">{p.t}</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{p.b}</p>
            </div>
          ))}
        </div>
      </Section>
      <CtaBand />
    </>
  );
}
