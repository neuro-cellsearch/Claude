import type { Metadata } from "next";
import { Check } from "lucide-react";
import { PageHero, Section } from "@/components/marketing/section";
import { BookingWidget } from "@/components/forms/booking-widget";
import { site } from "@/lib/env";

export const metadata: Metadata = { title: "Book a consultation", description: "Book a free 30-minute AI automation consultation with Kairo Systems." };

export default function BookPage() {
  return (
    <>
      <PageHero eyebrow="Book a consultation" title="30 minutes. A clear plan." intro="A video call with a Kairo specialist. No obligation and no hard sell." />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <p className="text-lg font-semibold text-fg">What we'll cover</p>
            <ul className="mt-5 space-y-3">
              {["How enquiries reach you today and where they're lost", "The tools you already use and what can connect", "Which automation would pay back fastest", "Realistic costs, timelines and what you'll need to provide"].map((x) => (
                <li key={x} className="flex gap-2.5 text-[14.5px] text-muted"><Check size={17} className="mt-0.5 shrink-0 text-success" />{x}</li>
              ))}
            </ul>
            <p className="mt-8 text-[13px] text-subtle">Prefer to send details first? <a href="/quote" className="text-signal-300 underline">Request a quote</a> instead.</p>
          </div>
          {site.calendlyUrl ? (
            <iframe src={site.calendlyUrl} title="Book a consultation" className="h-[720px] w-full rounded-2xl border border-line bg-white" />
          ) : (
            <BookingWidget />
          )}
        </div>
      </Section>
    </>
  );
}
