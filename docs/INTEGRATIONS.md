# Integrations

Every integration is optional except Supabase. Status and live tests are in **Admin → Integrations**: "configured" only means variables are set; an integration is working only once **Run live test** passes (each test makes a real authenticated API call).

## Stripe

1. Create a Stripe account; complete business verification (required for live payouts).
2. `STRIPE_SECRET_KEY` — Developers → API keys (start with `sk_test_…`).
3. Webhook endpoint: `https://YOUR-DOMAIN/api/stripe/webhook` with events:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded` → copy signing secret to `STRIPE_WEBHOOK_SECRET`.
4. Settings → Billing → **Customer portal**: enable cancellation, payment method updates and invoice history.
5. Optional: enable **Stripe Tax** if you register for VAT, so VAT is calculated at checkout.

**How billing works:** prices are read from the `plans` table (editable in Admin → Settings) or from an accepted proposal — never from the browser. Checkout creates a monthly subscription plus a one-off setup line on the first invoice. Webhooks create the `subscriptions` row, record `payments` (split into setup vs recurring), move the organisation to *onboarding*, mark *past_due* on failures and *churned* on cancellation. Events are idempotent (`stripe_events`).

Test locally with the Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

## OpenAI

`OPENAI_API_KEY` (project-scoped key) and optionally `OPENAI_MODEL`. **Set a monthly hard limit** in the OpenAI dashboard. Used by:
- the website assistant (`/api/chat`) — answers only from a fixed fact sheet, identifies itself as AI, and captures leads only via a tool call after the visitor provides details and agrees to be contacted;
- AI proposal drafting (admin) — always reviewed by a person before sending;
- the client workflow templates (via n8n).

Without a key the chat widget says the assistant is unavailable and points to the contact form; proposals use the built-in template draft.

## Resend (email)

1. Add and verify your sending domain (SPF, DKIM, DMARC). Use a **separate subdomain** (e.g. `mail.yourdomain.co.uk`) and consider a different one for cold outreach.
2. `RESEND_API_KEY`, `EMAIL_FROM="Kairo Systems <hello@mail.yourdomain.co.uk>"`, `ADMIN_NOTIFICATION_EMAIL`.
3. Also configure Resend as Supabase's SMTP (see DEPLOYMENT.md).

Without email configured, every attempted email is recorded in `email_messages` with status `not_configured` and **nothing is reported as sent**; due sequence emails stay queued and send once configured.

## n8n

See `automation-templates/README.md`. Platform variables: `N8N_BASE_URL`, `N8N_API_KEY` (enables live workflow activation/pausing from the admin and pushing encrypted client credentials into n8n), `AUTOMATION_WEBHOOK_SECRET` (shared with n8n as `KAIRO_WEBHOOK_SECRET`).

## Twilio

`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`. Buying UK numbers requires a regulatory bundle (proof of business address). In n8n, create an *HTTP Basic Auth* credential (SID / token) for the template SMS nodes. For production webhooks from Twilio into n8n, validate `X-Twilio-Signature`.

## AI receptionist (voice)

Recommended architecture: a voice-AI platform (e.g. Vapi or Retell) handles real-time speech using OpenAI/ElevenLabs, connected to a Twilio number (or call-forwarding from the client's existing line). Configure its system prompt from the client's **approved FAQs** (shown in the admin customer record), transfer rules and booking tool, then point its *end-of-call report* webhook at the `04-voice-call-report` n8n template, which logs the call and lead in the client portal. Always test call scenarios (including "speak to a human", complaints, out-of-scope questions) and record the test before approval.

## HubSpot, Calendly, Google Calendar, ElevenLabs, Make

Agency-level tokens (`HUBSPOT_PRIVATE_APP_TOKEN`, `CALENDLY_API_TOKEN`, `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` + `GOOGLE_CALENDAR_ID`, `ELEVENLABS_API_KEY`, `MAKE_API_TOKEN`) enable the live tests and your own workflows. **Client-level** access should be provided by each client during onboarding — ideally by inviting your team as a user, otherwise by storing a token through the encrypted credential form. Setting `NEXT_PUBLIC_CALENDLY_URL` replaces the built-in booking calendar on `/book` with your Calendly page.

---

## Automation event API

Any engine reports activity with one endpoint:

```
POST /api/automations/events
Content-Type: application/json
X-Kairo-Timestamp: <unix seconds>
X-Kairo-Signature: sha256=<hex HMAC-SHA256 of "<timestamp>.<raw body>" using AUTOMATION_WEBHOOK_SECRET>
```

```jsonc
{
  "automation_id": "uuid (shown on the admin customer page)",
  "event_type": "lead.captured",          // [a-z0-9_.-], free-form
  "summary": "Website chat: storm damage enquiry",
  "external_event_id": "evt-123",         // optional, makes retries idempotent
  "occurred_at": "2026-11-19T10:00:00Z",  // optional
  "test": false,                          // test events are accepted while testing and never create leads
  "payload": { },                         // optional extra data (keep personal data minimal)
  "lead": { "name": "…", "email": "…", "phone": "…", "source": "website_chat", "enquiry": "…", "score": 82, "estimated_value_pence": 250000 },
  "appointment": { "title": "Roof survey", "starts_at": "…", "status": "booked", "attendee_name": "…", "external_id": "gcal-event-id" }
}
```

Responses: `200` ok (`duplicate: true` on replays), `401` bad/stale signature (±5 min), `404` unknown automation, `409` automation not active (live events are only accepted from **active** automations), `413` too large, `429` rate-limited.

## Automation test webhook

From the admin customer page, **Send live test webhook** POSTs a signed `{ "test": true, "automation_id", "organization_id", "scenario" }` payload (headers `X-Kairo-Test: true`, `X-Kairo-Timestamp`, `X-Kairo-Signature`) to the automation's configured *test webhook URL* and records the HTTP result. A 2xx marks the test passed — **verify the side-effects yourself** before requesting approval. Manual tests (with written evidence) can be recorded for flows that can't be triggered by webhook.
