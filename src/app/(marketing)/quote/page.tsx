import type { Metadata } from "next";
import { PageHero, Section } from "@/components/marketing/section";
import { EnquiryForm } from "@/components/forms/enquiry-form";

export const metadata: Metadata = { title: "Request a tailored quote", description: "Tell us what you want to automate and receive a written, tailored proposal." };

export default async function QuotePage(props: PageProps<"/quote">) {
  const sp = await props.searchParams;
  const service = typeof sp.service === "string" ? sp.service : undefined;
  return (
    <>
      <PageHero eyebrow="Tailored quotation" title="Get a proposal built around your business." intro="The more you tell us, the more accurate your quote. We'll reply within one working day — usually with a few clarifying questions, then a written proposal with fixed setup pricing and clear monthly allowances." />
      <Section>
        <div className="mx-auto max-w-3xl"><EnquiryForm type="quote" defaultService={service} /></div>
      </Section>
    </>
  );
}
