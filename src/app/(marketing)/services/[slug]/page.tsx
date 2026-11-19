import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Check, X as XIcon, ArrowRight } from "lucide-react";
import { PageHero, Section, SectionHeading, CtaBand } from "@/components/marketing/section";
import { ButtonLink } from "@/components/ui/button";
import { SERVICES, SERVICE_BY_SLUG } from "@/lib/content/services";
import { getPlans } from "@/lib/content/plans";
import { gbp } from "@/lib/format";

export function generateStaticParams() {
  return SERVICES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata(props: PageProps<"/services/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const s = SERVICE_BY_SLUG[slug];
  return s ? { title: s.name, description: s.short } : {};
}

export default async function ServicePage(props: PageProps<"/services/[slug]">) {
  const { slug } = await props.params;
  const s = SERVICE_BY_SLUG[slug];
  if (!s) notFound();
  const plans = await getPlans();
  const plan = plans.find((p) => p.id === s.fromPlan)!;

  return (
    <>
      <PageHero eyebrow={s.name} title={s.headline} intro={s.intro}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/book" size="lg">Book a consultation <ArrowRight size={16} /></ButtonLink>
          <ButtonLink href={`/quote?service=${s.key}`} size="lg" variant="outline">Get a quote for this</ButtonLink>
        </div>
      </PageHero>

      <Section>
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="The problem" title="What it's costing you today" />
            <ul className="mt-8 space-y-4">
              {s.problems.map((p) => (
                <li key={p} className="flex gap-3 text-[15px] leading-relaxed text-muted">
                  <XIcon size={18} className="mt-1 shrink-0 text-danger/80" />{p}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <SectionHeading eyebrow="The solution" title="How Kairo fixes it" />
            <div className="mt-8 grid gap-3">
              {s.solution.map((x) => (
                <div key={x.title} className="surface-raised p-5">
                  <p className="font-medium text-fg">{x.title}</p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{x.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section className="pt-0 lg:pt-0">
        <SectionHeading eyebrow="Implementation" title="From kick-off to live, safely" />
        <ol className="mt-10 grid gap-4 md:grid-cols-4">
          {s.steps.map((step, i) => (
            <li key={step} className="rounded-xl border border-line bg-ink-850 p-5">
              <span className="font-mono text-[12px] text-signal-300">Step {i + 1}</span>
              <p className="mt-2 text-[14px] leading-relaxed text-fg/90">{step}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section className="pt-0 lg:pt-0">
        <div className="grid gap-10 lg:grid-cols-3">
          {s.benefits.map((b) => (
            <div key={b.title}>
              <Check className="text-success" size={20} />
              <p className="mt-3 text-lg font-semibold text-fg">{b.title}</p>
              <p className="mt-1.5 text-[14px] text-muted">{b.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="pt-0 lg:pt-0">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="surface-raised p-7">
            <p className="eyebrow">Pricing</p>
            <p className="mt-3 text-2xl font-semibold text-fg">Included from {plan.name}</p>
            <p className="mt-2 text-muted">{gbp(plan.monthly_pence)}/month + {gbp(plan.setup_fee_pence)} setup (ex. VAT). {s.addOn}</p>
            <p className="mt-4 text-[13px] text-subtle">Exact pricing depends on integrations, volumes, AI usage and complexity, confirmed in a written proposal.</p>
            <div className="mt-6 flex gap-3">
              <ButtonLink href="/pricing" variant="secondary">Compare plans</ButtonLink>
              <ButtonLink href={`/quote?service=${s.key}`} variant="ghost">Tailored quote</ButtonLink>
            </div>
          </div>
          <div className="surface-raised p-7">
            <p className="eyebrow">Works with</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {s.integrations.map((i) => <span key={i} className="rounded-md border border-line-strong bg-ink-900 px-2.5 py-1 text-[13px] text-fg/85">{i}</span>)}
            </div>
            <p className="mt-5 text-[13px] leading-relaxed text-subtle">{s.availability}</p>
          </div>
        </div>
      </Section>

      {s.faqs.length > 0 && (
        <Section className="pt-0 lg:pt-0">
          <SectionHeading eyebrow="FAQs" title="Common questions" />
          <div className="mt-8 divide-y divide-line rounded-2xl border border-line bg-ink-850">
            {s.faqs.map((f) => (
              <details key={f.q} className="group p-6">
                <summary className="cursor-pointer list-none font-medium text-fg marker:hidden">{f.q}</summary>
                <p className="mt-3 text-[14px] leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted">Other services: {SERVICES.filter((x) => x.slug !== s.slug).map((x, i) => (
            <span key={x.slug}>{i > 0 && " · "}<Link className="text-signal-300 hover:underline" href={`/services/${x.slug}`}>{x.name}</Link></span>
          ))}</p>
        </Section>
      )}
      <CtaBand />
    </>
  );
}
