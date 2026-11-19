import { cn } from "@/components/ui/cn";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function Section({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn("mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28", className)}>
      {children}
    </section>
  );
}

export function SectionHeading({ eyebrow, title, intro, center = false }: { eyebrow?: string; title: ReactNode; intro?: ReactNode; center?: boolean }) {
  return (
    <div className={cn("max-w-3xl", center && "mx-auto text-center")}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-fg sm:text-[2.6rem] sm:leading-[1.1]">{title}</h2>
      {intro && <p className="mt-5 text-[16px] leading-relaxed text-muted">{intro}</p>}
    </div>
  );
}

export function PageHero({ eyebrow, title, intro, children }: { eyebrow: string; title: ReactNode; intro?: ReactNode; children?: ReactNode }) {
  return (
    <div className="relative overflow-hidden border-b border-line/60">
      <div className="hero-aura pointer-events-none absolute inset-0" />
      <div className="grid-backdrop pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-20 lg:px-8 lg:pb-20 lg:pt-28">
        <p className="eyebrow animate-fade-up">{eyebrow}</p>
        <h1 className="mt-4 max-w-4xl animate-fade-up text-4xl font-semibold tracking-tight text-fg sm:text-5xl sm:leading-[1.05]">{title}</h1>
        {intro && <p className="mt-6 max-w-2xl animate-fade-up text-[17px] leading-relaxed text-muted">{intro}</p>}
        {children && <div className="mt-8 animate-fade-up">{children}</div>}
      </div>
    </div>
  );
}

export function CtaBand({ title = "See what we'd automate first.", body = "A 30-minute consultation. We'll map where enquiries and hours are being lost, and tell you honestly whether automation will pay for itself." }: { title?: string; body?: string }) {
  return (
    <Section className="py-16 lg:py-20">
      <div className="relative overflow-hidden rounded-3xl border border-line bg-ink-850 px-6 py-14 text-center sm:px-14">
        <div className="hero-aura pointer-events-none absolute inset-0 opacity-80" />
        <div className="relative">
          <h2 className="text-3xl font-semibold tracking-tight text-fg sm:text-4xl">{title}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-[16px] text-muted">{body}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/book" size="lg">Book a consultation <ArrowRight size={16} /></ButtonLink>
            <ButtonLink href="/quote" size="lg" variant="outline">Request a tailored quote</ButtonLink>
          </div>
        </div>
      </div>
    </Section>
  );
}
