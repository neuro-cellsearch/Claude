# Compliance — UK GDPR, PECR and marketing rules

*This is practical guidance, not legal advice. Have a solicitor review your privacy policy, terms and DPA before launch.*

## Registration and paperwork
- Pay the **ICO data protection fee** (most small businesses: tier 1) and set `NEXT_PUBLIC_ICO_REGISTRATION`.
- Keep a **Record of Processing Activities** (enquiries, clients, prospects, client end-customers as processor).
- Sign a **Data Processing Agreement** with every client (you are their processor for data their automations handle) and keep DPAs with your sub-processors (Supabase, Stripe, OpenAI, Resend, Twilio, n8n host).
- For prospecting under legitimate interests, write one **Legitimate Interests Assessment** per campaign type and summarise per-prospect reasoning in the *LIA notes* field.

## Outbound marketing — what the platform enforces

| Rule (PECR / UK GDPR) | How it's enforced |
|---|---|
| Unsolicited marketing **email** may go to *corporate subscribers* (Ltd, LLP, PLC, Scottish partnerships, public bodies) but **not** to sole traders or other partnerships without consent | `outreachEligibility()` blocks email recipients unless entity type is corporate; "unknown" is treated as not allowed |
| Every message must identify the sender and give a simple opt-out | Templates are seeded with identity + opt-out; saving an email template without an opt-out line is rejected; sequence and campaign emails get an unsubscribe link and `List-Unsubscribe` header |
| Opt-outs must be honoured permanently | Unsubscribe link → suppression list → active sequences stopped, prospect set to *do not contact*; every send re-checks suppression |
| Live **calls** must not go to numbers on TPS/CTPS (unless consent) | Phone outreach requires a TPS/CTPS check recorded within the last 28 days and blocks registered numbers |
| No mass, automated, indiscriminate sending | Every prospect must be approved; every message reviewed (unfilled placeholders block approval); campaigns need admin approval; daily send cap |
| Accountability for data sources; no scraping of personal data | *Source of data* is mandatory for each prospect; only business contact details are stored |
| LinkedIn's terms prohibit automated messaging | LinkedIn campaigns produce reviewed messages that **you** send manually, then mark as done |

Practical tips: screen numbers via a TPS/CTPS checking service; prefer role addresses (`info@`, `office@`) or named work emails published by the company; send from a dedicated subdomain; keep volumes low and personal.

## Inbound enquiries and follow-up
- Forms explain the purpose and link to the privacy policy; marketing consent is a separate, unticked, optional checkbox.
- Follow-up sequences only go to people who contacted you about a service (legitimate interests / soft opt-in-style relationship), include an unsubscribe link and stop automatically when the lead progresses or opts out.

## Client automations (you as processor)
- AI assistants must disclose they are automated; the website assistant labels itself "AI assistant · may make mistakes · not a human".
- Assistants answer only from the client's **approved FAQs**; clinical, legal and financial questions are escalated.
- SMS from client automations: service messages (confirmations, reminders, missed-call replies to someone who just called) are fine; **marketing** SMS needs prior consent and a STOP opt-out.
- Call recording/transcription by a voice receptionist requires a clear notice at the start of the call.

## Data subject rights
- Clients can download all their data (JSON) and request deletion from the portal; requests appear in **Admin → Settings** with a one-month due date.
- Retention guidance is in the privacy policy (enquiries 24 months, client records 6 years after contract for HMRC, chat transcripts 12 months).

## Advertising and proof
- The **CMA guidance** and the **Digital Markets, Competition and Consumers Act 2024** prohibit fake or misleading reviews. The database refuses to publish testimonials or case studies without recorded permission; illustrative scenarios are clearly labelled.
- Don't claim guaranteed results; projections in proposals and the forecast tool are labelled as estimates.

## Security
Encrypted credentials, RLS, role-based admin, audit log, hashed IPs, rate limiting, CSP/HSTS headers, signed webhooks. Report personal data breaches to the ICO within 72 hours where required and notify affected clients without undue delay.
