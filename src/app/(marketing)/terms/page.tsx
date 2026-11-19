import type { Metadata } from "next";
import { PageHero, Section } from "@/components/marketing/section";
import { site } from "@/lib/env";

export const metadata: Metadata = { title: "Terms and conditions" };

export default function TermsPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Terms and conditions" intro="Last updated 18 November 2026" />
      <Section className="max-w-4xl">
        <article className="prose-legal">
          <p>These terms govern the supply of services by {site.legalName} (&ldquo;Kairo Systems&rdquo;, &ldquo;we&rdquo;) to business customers (&ldquo;you&rdquo;). Our services are supplied to businesses only, not consumers. Your signed proposal (&ldquo;Order&rdquo;) and these terms form the contract. If they conflict, the Order prevails.</p>

          <h2>1. Services</h2>
          <p>We design, configure, test, host, monitor and support the automations described in your Order. We use third-party platforms (such as OpenAI, Twilio, n8n, Stripe and Supabase) to deliver the services, and their availability is subject to those providers.</p>

          <h2>2. Implementation, testing and approval</h2>
          <ul>
            <li>You will provide accurate business information, approved knowledge for AI assistants and the access needed to integrate your systems.</li>
            <li>We will test each automation and record the results. No automation is activated until you or your nominated representative has approved it, and we have recorded that approval.</li>
            <li>You are responsible for the accuracy of information you approve for AI assistants to use.</li>
          </ul>

          <h2>3. Fees and payment</h2>
          <ul>
            <li>Setup fees are payable before implementation begins. Monthly fees are billed in advance by card or direct debit via Stripe.</li>
            <li>All prices exclude VAT. Usage above the allowances in your Order (for example AI processing, SMS or call minutes) is charged as set out in the Order.</li>
            <li>Late payments may incur interest under the Late Payment of Commercial Debts (Interest) Act 1998, and we may suspend services after 14 days&rsquo; written notice of non-payment.</li>
          </ul>

          <h2>4. Term and cancellation</h2>
          <p>Unless your Order states otherwise, there is an initial term of 3 months, after which the services continue monthly until either party gives 30 days&rsquo; written notice. Setup fees are non-refundable once implementation has started.</p>

          <h2>5. Your obligations and acceptable use</h2>
          <ul>
            <li>You must have a lawful basis to process the personal data handled by your automations, and must comply with UK GDPR and PECR — including obtaining any consent required for marketing messages.</li>
            <li>You must not use the services to send unsolicited marketing unlawfully, to deceive people, or for any illegal purpose.</li>
            <li>AI assistants must be presented as automated where a reasonable person would expect to know.</li>
          </ul>

          <h2>6. Data protection</h2>
          <p>Where we process personal data on your behalf, we act as your processor under our Data Processing Agreement, which forms part of these terms and meets the requirements of Article 28 UK GDPR.</p>

          <h2>7. Intellectual property</h2>
          <p>You own your data and content. We own our pre-existing tools, templates and know-how; we grant you a licence to use the automation configurations we build for you during the term. On termination we will provide an export of your data on request.</p>

          <h2>8. Service levels and support</h2>
          <p>We aim to respond to support requests within the timescales stated for your plan. We do not guarantee uninterrupted operation, particularly where third-party platforms are unavailable, but we will monitor and use reasonable efforts to restore service promptly.</p>

          <h2>9. Results</h2>
          <p>Any projections, examples or estimates we provide are illustrative. We do not guarantee any particular commercial result, such as revenue, leads or bookings.</p>

          <h2>10. Liability</h2>
          <p>Nothing limits liability for death or personal injury caused by negligence, fraud, or anything that cannot be limited by law. Subject to that, we are not liable for loss of profits, revenue, business or goodwill, or indirect loss, and our total liability in any 12-month period is limited to the fees you paid in that period.</p>

          <h2>11. General</h2>
          <p>These terms are governed by the law of England and Wales, and the courts of England and Wales have exclusive jurisdiction. Contact: <a href={`mailto:${site.email}`}>{site.email}</a>.</p>
          <p><em>These terms are a starting template and should be reviewed by a solicitor before use with clients.</em></p>
        </article>
      </Section>
    </>
  );
}
