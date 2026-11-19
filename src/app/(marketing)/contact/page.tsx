import type { Metadata } from "next";
import { Mail, Phone, Clock } from "lucide-react";
import { PageHero, Section } from "@/components/marketing/section";
import { EnquiryForm } from "@/components/forms/enquiry-form";
import { site } from "@/lib/env";

export const metadata: Metadata = { title: "Contact", description: "Get in touch with Kairo Systems." };

export default function ContactPage() {
  return (
    <>
      <PageHero eyebrow="Contact" title="Talk to a specialist." intro="Tell us a little about your business and what you'd like to improve. We reply to every enquiry within one working day." />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
          <div className="space-y-6">
            <div className="flex gap-3"><Mail className="mt-0.5 text-signal-300" size={18} /><div><p className="font-medium text-fg">Email</p><a className="text-muted hover:text-fg" href={`mailto:${site.email}`}>{site.email}</a></div></div>
            {site.phone && <div className="flex gap-3"><Phone className="mt-0.5 text-signal-300" size={18} /><div><p className="font-medium text-fg">Phone</p><a className="text-muted hover:text-fg" href={`tel:${site.phone.replace(/\s/g, "")}`}>{site.phone}</a></div></div>}
            <div className="flex gap-3"><Clock className="mt-0.5 text-signal-300" size={18} /><div><p className="font-medium text-fg">Hours</p><p className="text-muted">Monday–Friday, 9:00–17:30 (UK)</p></div></div>
            {site.address && <p className="text-[13px] text-subtle">{site.legalName}<br />{site.address}</p>}
          </div>
          <EnquiryForm type="contact" />
        </div>
      </Section>
    </>
  );
}
