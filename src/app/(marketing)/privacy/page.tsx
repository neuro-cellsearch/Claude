import type { Metadata } from "next";
import { PageHero, Section } from "@/components/marketing/section";
import { site } from "@/lib/env";

export const metadata: Metadata = { title: "Privacy policy" };
const UPDATED = "18 November 2026";

export default function PrivacyPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Privacy policy" intro={`Last updated ${UPDATED}`} />
      <Section className="max-w-4xl">
        <article className="prose-legal">
          <p>This policy explains how {site.legalName} (&ldquo;Kairo Systems&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) collects and uses personal data when you visit our website, contact us, use our client portal, or when we provide services to our clients. We are committed to complying with the UK General Data Protection Regulation (UK GDPR), the Data Protection Act 2018 and the Privacy and Electronic Communications Regulations 2003 (PECR).</p>

          <h2>1. Who we are</h2>
          <p>{site.legalName}{site.companyNumber && `, a company registered in England and Wales (No. ${site.companyNumber})`}{site.address && `, ${site.address}`}. For anything relating to your data, contact us at <a href={`mailto:${site.email}`}>{site.email}</a>.{site.icoRegistration && ` We are registered with the Information Commissioner's Office under registration number ${site.icoRegistration}.`}</p>

          <h2>2. Our two roles</h2>
          <ul>
            <li><strong>Controller</strong> — for data about our website visitors, enquirers, prospects and client contacts.</li>
            <li><strong>Processor</strong> — when we run automations for a client (for example, a chatbot answering that client's customers), we process data on the client's behalf and under their instructions, governed by a data processing agreement. The client is the controller and their privacy notice applies.</li>
          </ul>

          <h2>3. Data we collect</h2>
          <ul>
            <li><strong>Enquiry and booking data</strong>: name, email, phone, company, role, industry, the content of your message, budget and volume information you choose to share, and consultation times.</li>
            <li><strong>Chat assistant conversations</strong>: messages you type into our website assistant. Please don't share sensitive information in chat.</li>
            <li><strong>Client account data</strong>: login email, name, business details, billing status, support tickets and information you provide during onboarding.</li>
            <li><strong>Integration credentials</strong> provided by clients: encrypted with AES-256 before storage and accessible only to systems that need them.</li>
            <li><strong>Prospect data</strong>: business contact details (for example names, job titles and work email addresses published on company websites or professional directories) used for business-to-business outreach.</li>
            <li><strong>Technical data</strong>: we store a one-way hash of your IP address for security and abuse prevention, not the address itself.</li>
          </ul>

          <h2>4. How and why we use it (lawful bases)</h2>
          <ul>
            <li>Responding to enquiries, holding consultations and preparing proposals — <em>steps prior to entering a contract</em> / <em>legitimate interests</em>.</li>
            <li>Providing our services, client portal and support — <em>performance of a contract</em>.</li>
            <li>Billing, accounting and tax records — <em>legal obligation</em>.</li>
            <li>Follow-up emails about an enquiry you made — <em>legitimate interests</em>, with an opt-out in every message.</li>
            <li>Newsletters and marketing to individuals — <em>consent</em>, which you can withdraw at any time.</li>
            <li>Business-to-business outreach — <em>legitimate interests</em>, subject to a documented assessment. We only email corporate subscribers (such as limited companies and LLPs) without prior consent, never sole traders or partnerships without consent, and we screen telephone numbers against the TPS and CTPS before calling. Every message identifies us and offers an easy opt-out.</li>
            <li>Security, fraud and abuse prevention — <em>legitimate interests</em>.</li>
          </ul>
          <p>We do not sell personal data, and we do not scrape personal contact information.</p>

          <h2>5. Automated decision-making</h2>
          <p>We use a transparent, rules-based score to prioritise enquiries for follow-up. It does not produce legal or similarly significant effects; every enquiry is reviewed by a person.</p>

          <h2>6. Who we share data with</h2>
          <p>We use carefully selected processors under written contracts, including: Supabase (database and authentication), Vercel or our chosen hosting provider, Stripe (payments), OpenAI (AI processing), Resend (email delivery), Twilio (telephony and SMS), and n8n (workflow automation). Some providers are based outside the UK; where data is transferred internationally we rely on UK adequacy regulations or the International Data Transfer Agreement / Addendum.</p>

          <h2>7. How long we keep it</h2>
          <ul>
            <li>Enquiries that don't become clients: up to 24 months from last contact.</li>
            <li>Client records: for the duration of the contract and 6 years afterwards for legal and accounting purposes.</li>
            <li>Chat transcripts: up to 12 months.</li>
            <li>Suppression (opt-out) records: retained indefinitely so we can honour your request.</li>
          </ul>

          <h2>8. Security</h2>
          <p>Data is encrypted in transit and at rest; credentials receive additional application-level encryption; access is role-based and logged; databases are backed up daily. No system is perfectly secure, and we will notify you and the ICO of breaches where required.</p>

          <h2>9. Your rights</h2>
          <p>You have the right to access, rectify, erase, restrict or object to processing of your data, to data portability, and to withdraw consent. Clients can export their data and request deletion from the portal. To exercise any right, email <a href={`mailto:${site.email}`}>{site.email}</a>. We respond within one month. You can also complain to the Information Commissioner&rsquo;s Office at <a href="https://ico.org.uk" rel="noopener noreferrer">ico.org.uk</a>.</p>

          <h2>10. Cookies</h2>
          <p>We only use strictly necessary cookies — to keep you signed in to the client portal and to protect against abuse. We do not use advertising or analytics cookies. If that changes, we will ask for your consent first.</p>

          <h2>11. Changes</h2>
          <p>We will post any changes on this page and update the date above.</p>
          <p><em>This policy should be reviewed by a qualified adviser before launch to confirm it reflects your final providers and processes.</em></p>
        </article>
      </Section>
    </>
  );
}
