# Architecture

## Stack and why

| Layer | Choice | Why (cost-effectiveness first) |
|---|---|---|
| App | **Next.js 16 (App Router) + TypeScript** | One codebase for site, portal, admin and APIs. Server Components + Server Actions keep secrets server-side. |
| Styling | **Tailwind CSS v4** | Design tokens in one file; no runtime CSS cost. |
| Database & auth | **Supabase** (Postgres, GoTrue, PostgREST) | Managed Postgres with auth, RLS and backups. Free to start, ~$25/month Pro. London region available. |
| Payments | **Stripe Billing + Checkout + Customer Portal** | No monthly fee; hosted PCI-compliant checkout; self-service invoices and card updates. |
| AI | **OpenAI API** (model configurable) | Pay-per-use; small models cost pennies per conversation. Swappable behind `lib/integrations/openai.ts`. |
| Workflow engine | **n8n (self-hosted)** — Make supported | Self-hosted n8n on a £5–15/month VPS gives unlimited executions — far cheaper than per-operation pricing at agency scale. Make is supported via the same signed event API for clients already on it. |
| Telephony/SMS | **Twilio** | UK numbers, SMS, call webhooks; the receptionist voice layer is a voice-AI platform (e.g. Vapi/Retell) on top of Twilio, reporting back via the event API. Cheaper and more reliable than building real-time voice from scratch. |
| Voice | **ElevenLabs** (optional) | Premium voices where clients want them; often included in the voice platform. |
| Email | **Resend** | Simple API, free 3k/month, good deliverability; swappable in `lib/integrations/email.ts`. |
| CRM | **HubSpot** (client side) | Free tier for most small clients; private app tokens. |
| Calendar | **Built-in booking** for the agency; Google Calendar/Calendly for clients | The agency's own consultation booking needs no paid tool. |

**Indicative platform running cost at launch:** ~£80–150/month (hosting, Supabase Pro, n8n VPS, email, Workspace) plus usage-based AI/telephony that is passed through in client pricing.

## Modularity — changing providers

Each provider lives in `src/lib/integrations/*` with a single responsibility, and `registry.ts` declares its env vars, setup steps and a **real** connection test. Automations never call the platform's database directly — every engine (n8n, Make, a voice platform, custom code) talks to the platform through one versioned, HMAC-signed endpoint (`POST /api/automations/events`). Swapping n8n for Make, or Twilio for another carrier, changes only the workflows — not the portal, analytics or billing.

## Request flow and trust boundaries

```
Browser ──(anon key + user JWT only)──▶ Next.js server
   │                                       ├─ Server Components: read via user-scoped Supabase client (RLS)
   │                                       ├─ Server Actions: validate (zod) → authorise (role) → write
   │                                       │     privileged writes use the service-role client AFTER checks
   │                                       └─ Route handlers: Stripe webhook (signature), events (HMAC),
   │                                             cron (bearer secret), chat (rate-limited)
   ▼
proxy.ts — refreshes the auth cookie and redirects anonymous users away from /portal and /admin
```

- **Customers** read through RLS: they can only ever see rows where `organization_id = current_org_id()`.
- **Column-level grants** stop customers changing sensitive columns (role, status, Stripe IDs) even on rows they can update.
- **Staff/admin** operations run through server actions that call `assertStaff()` / `assertAdmin()` before using the service role. Finance, integrations, settings, automation activation and campaign approval are **admin-only**.
- **Integration credentials** supplied by clients are encrypted with AES-256-GCM (`ENCRYPTION_KEY`) before insert, the table has no RLS policies (service role only), and ciphertext is never selected into any page. Admins can push a credential straight into n8n server-to-server; it is never displayed.

## Data model (summary)

`supabase/migrations/20261118000001_core_schema.sql` — 38 tables, money stored in **integer pence**.

- **Accounts:** `organizations`, `profiles` (role: customer/staff/admin)
- **Revenue:** `plans`, `subscriptions`, `payments`, `stripe_events` (webhook idempotency)
- **Delivery:** `automations` (lifecycle + DB constraint), `automation_tests`, `automation_events`, `customer_leads`, `appointments`, `onboarding_tasks`, `integration_credentials`, `automation_requests`, `support_tickets`, `ticket_messages`
- **Sales:** `enquiries` (scored pipeline), `consultations` (unique slot index prevents double-booking), `availability_rules`, `crm_activities`, `quotes`
- **Email:** `email_messages` (every attempt and its real outcome), `email_sequences`, `email_sequence_steps`, `sequence_enrollments`
- **Outbound:** `prospects` (source, entity type, LIA notes, TPS dates), `suppression_list`, `outreach_templates`, `outreach_campaigns`, `campaign_recipients` (approval constraints)
- **Finance & proof:** `expenses`, `case_studies` and `testimonials` (cannot be published without recorded permission)
- **Operations:** `notifications`, `audit_logs`, `data_requests`, `app_settings`, `rate_limits`

### Guarantees enforced by the database (not just the UI)

| Rule | Mechanism |
|---|---|
| An automation can't be `active` without a passed test and approval | `CHECK` constraint `automation_active_requires_test_and_approval` |
| Changing an automation's config/workflow invalidates its test and approval | `BEFORE UPDATE` trigger |
| Campaigns/recipients can't be sent without approval | `CHECK` constraints on both tables |
| Case studies/testimonials can't be published without client permission | `CHECK` constraints |
| A consultation slot can't be double-booked | partial unique index |
| Customers can't escalate their role or change org membership | trigger + column grants |

## Observability

- Structured JSON logs (`lib/logger.ts`) with automatic redaction of secret-looking keys
- `audit_logs` for security and financial actions (role changes, credential use, checkouts, approvals, activations, exports)
- `GET /api/health` for uptime monitoring (database readiness, no config disclosure)
- `email_messages` records every email attempt with its true status (`sent`, `failed`, `not_configured`, `suppressed`)
