import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { PageHero, Section, CtaBand } from "@/components/marketing/section";
import { SERVICES } from "@/lib/content/services";
import { SERVICE_ICONS } from "@/components/ui/icons";

export const metadata: Metadata = { title: "AI automation services", description: "AI receptionists, website chatbots, lead generation, appointment booking, CRM and workflow automation for UK businesses." };

export default function ServicesPage() {
  return (
    <>
      <PageHero eyebrow="AI automation services" title="Systems that answer, qualify, book and follow up — automatically." intro="Each service solves a specific, costly problem. Combine them into one connected system, managed by our team." />
      <Section>
        <div className="space-y-4">
          {SERVICES.map((s, i) => {
            const Icon = SERVICE_ICONS[s.icon];
            return (
              <Link key={s.slug} href={`/services/${s.slug}`} className="group grid gap-6 rounded-2xl border border-line bg-ink-850 p-7 transition hover:border-signal-500/40 md:grid-cols-[auto_1fr_auto] md:items-center">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-signal-500/12 text-signal-300 ring-1 ring-signal-500/25"><Icon size={20} /></span>
                <div>
                  <p className="font-mono text-[11px] text-subtle">0{i + 1}</p>
                  <p className="text-xl font-semibold text-fg">{s.name}</p>
                  <p className="mt-1.5 max-w-3xl text-[14px] text-muted">{s.short}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-sm text-signal-300 transition group-hover:gap-2">Explore <ArrowRight size={15} /></span>
              </Link>
            );
          })}
        </div>
      </Section>
      <CtaBand />
    </>
  );
}
