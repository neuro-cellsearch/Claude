import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { PageHero, Section, CtaBand } from "@/components/marketing/section";
import { INDUSTRIES } from "@/lib/content/industries";

export const metadata: Metadata = { title: "Industry solutions", description: "AI automation tailored to roofing, estate agents, dental, recruitment, gyms, hospitality, automotive and professional services." };

export default function IndustriesPage() {
  return (
    <>
      <PageHero eyebrow="Industry solutions" title="Automation designed for the way your sector works." intro="Every industry loses opportunities in different places. We start from proven playbooks for your sector and tailor them to your business." />
      <Section>
        <div className="grid gap-4 md:grid-cols-2">
          {INDUSTRIES.map((i) => (
            <Link key={i.slug} href={`/industries/${i.slug}`} className="group rounded-2xl border border-line bg-ink-850 p-7 transition hover:border-signal-500/40">
              <p className="text-xl font-semibold text-fg">{i.name}</p>
              <p className="mt-2 text-[14px] text-muted">{i.short}</p>
              <ul className="mt-5 grid gap-1.5 text-[13px] text-fg/80 sm:grid-cols-2">
                {i.automations.map((a) => <li key={a.title}>· {a.title}</li>)}
              </ul>
              <p className="mt-5 inline-flex items-center gap-1 text-sm text-signal-300 transition group-hover:gap-2">See the playbook <ArrowRight size={15} /></p>
            </Link>
          ))}
        </div>
      </Section>
      <CtaBand />
    </>
  );
}
