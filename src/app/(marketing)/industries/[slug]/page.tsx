import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { PageHero, Section, SectionHeading, CtaBand } from "@/components/marketing/section";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/primitives";
import { INDUSTRIES } from "@/lib/content/industries";
import { SERVICE_BY_KEY } from "@/lib/content/services";
import { getPlans } from "@/lib/content/plans";
import { gbp } from "@/lib/format";

export function generateStaticParams() {
  return INDUSTRIES.map((i) => ({ slug: i.slug }));
}

export async function generateMetadata(props: PageProps<"/industries/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const i = INDUSTRIES.find((x) => x.slug === slug);
  return i ? { title: `AI automation for ${i.name}`, description: i.short } : {};
}

export default async function IndustryPage(props: PageProps<"/industries/[slug]">) {
  const { slug } = await props.params;
  const ind = INDUSTRIES.find((x) => x.slug === slug);
  if (!ind) notFound();
  const plan = (await getPlans()).find((p) => p.id === ind.recommendedPlan)!;

  return (
    <>
      <PageHero eyebrow={`For ${ind.name}`} title={ind.headline} intro={ind.short}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/book" size="lg">Book a consultation <ArrowRight size={16} /></ButtonLink>
          <ButtonLink href="/quote" size="lg" variant="outline">Request a quote</ButtonLink>
        </div>
      </PageHero>
      <Section>
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <SectionHeading eyebrow="Where opportunities leak" title="Sound familiar?" />
            <ul className="mt-8 space-y-3">
              {ind.pains.map((p) => (
                <li key={p} className="flex gap-3 rounded-xl border border-line bg-ink-850 px-4 py-3 text-[14px] text-fg/85">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" />{p}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <SectionHeading eyebrow="The playbook" title="What we typically automate" />
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {ind.automations.map((a) => (
                <div key={a.title} className="surface-raised p-5">
                  <p className="font-medium text-fg">{a.title}</p>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{a.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>
      <Section className="pt-0 lg:pt-0">
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="surface-raised p-6 lg:col-span-2">
            <p className="eyebrow">Recommended services</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {ind.recommendedServices.map((k) => {
                const s = SERVICE_BY_KEY[k];
                return (
                  <Link key={k} href={`/services/${s.slug}`} className="rounded-lg border border-line bg-ink-900 p-4 transition hover:border-signal-500/40">
                    <p className="font-medium text-fg">{s.name}</p>
                    <p className="mt-1 text-[13px] text-muted">{s.short}</p>
                  </Link>
                );
              })}
            </div>
            <p className="mt-5 text-[13px] text-subtle">Typical integrations: {ind.integrations.join(" · ")}</p>
          </div>
          <div className="surface-raised p-6">
            <p className="eyebrow">Typical starting point</p>
            <p className="mt-3 text-2xl font-semibold text-fg">{plan.name}</p>
            <p className="mt-1 text-muted">{gbp(plan.monthly_pence)}/month + {gbp(plan.setup_fee_pence)} setup</p>
            <p className="mt-3 text-[12.5px] text-subtle">Ex. VAT. Your proposal reflects your volumes and integrations.</p>
            <ButtonLink href="/pricing" variant="secondary" className="mt-5 w-full">See all plans</ButtonLink>
          </div>
        </div>
        {ind.compliance && <div className="mt-5"><Notice title="Responsible automation">{ind.compliance}</Notice></div>}
      </Section>
      <CtaBand title={`Let's map your ${ind.name.toLowerCase()} workflow.`} />
    </>
  );
}
