# Credentials, decisions and manual approvals checklist

Everything below needs **you** — the platform cannot (and should not) do these on its own.

## Business setup
- [ ] Confirm the brand name is available (Companies House, UK IPO classes 35/42, domain, social handles) — or pick an alternative
- [ ] Register the limited company; open a business bank account
- [ ] Pay the ICO data protection fee
- [ ] Professional indemnity + cyber insurance
- [ ] Solicitor review of `/privacy`, `/terms`, and a client Data Processing Agreement
- [ ] Set `NEXT_PUBLIC_COMPANY_LEGAL_NAME`, `_NUMBER`, `_ADDRESS`, `_CONTACT_EMAIL`, `_CONTACT_PHONE`, `_ICO_REGISTRATION`
- [ ] Decide on VAT registration timing with your accountant

## Required credentials
| Variable(s) | Where to get it | Unlocks |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` | Supabase project settings | Everything (database, auth) |
| `ENCRYPTION_KEY`, `AUTOMATION_WEBHOOK_SECRET`, `CRON_SECRET`, `IP_HASH_SALT` | Generate yourself (see DEPLOYMENT.md) | Credential encryption, signed events, cron, privacy |

## Optional credentials (each feature shows "not configured" until set and tested)
| Variable(s) | Unlocks |
|---|---|
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (+ webhook endpoint, customer portal, business verification) | Online checkout, subscriptions, invoices, revenue tracking |
| `OPENAI_API_KEY` (+ spend limit), `OPENAI_MODEL` | Website AI assistant, AI proposal drafting, client AI workflows |
| `RESEND_API_KEY`, `EMAIL_FROM` (+ verified domain DNS), `ADMIN_NOTIFICATION_EMAIL` | All outgoing email: acknowledgements, notifications, sequences, proposals, campaigns |
| Supabase custom SMTP | Branded confirmation/reset/invite emails |
| `N8N_BASE_URL`, `N8N_API_KEY` (+ self-hosted n8n) | Running client automations; activation/pausing from admin; pushing credentials |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` (+ UK regulatory bundle) | SMS, missed-call text-back, voice routing |
| Voice-AI platform account (Vapi/Retell) | AI receptionist |
| `ELEVENLABS_API_KEY` | Premium voices (optional) |
| `HUBSPOT_PRIVATE_APP_TOKEN` | HubSpot integration test / your own CRM workflows |
| `CALENDLY_API_TOKEN`, `NEXT_PUBLIC_CALENDLY_URL` | Calendly instead of the built-in booking calendar (optional) |
| `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`, `GOOGLE_CALENDAR_ID` | Google Calendar automations |
| `MAKE_API_TOKEN`, `MAKE_ZONE` | Make as an alternative engine (optional) |

## Manual approvals built into the platform (by design)
- **Every automation**: build → recorded test → admin approval → admin activation. The database blocks activation otherwise, and any configuration change resets the test and approval.
- **Every prospect** must be approved before outreach; **every outreach message** reviewed and approved; **every campaign** approved by an admin; email batches sent by an admin click, capped daily.
- **Email sequences** are inactive until you switch them on.
- **Proposals** are sent only when you click send (AI drafts must be reviewed first).
- **Case studies/testimonials** require recorded client permission before publishing.
- **Staff roles** are granted only by an admin.
- **GDPR deletion requests** are actioned by you (Supabase → Authentication → delete user) within one month.

## Before taking real money
- [ ] Run the full flow in Stripe **test mode**: register → choose plan → pay with `4242…` → subscription appears in Admin → Billing → cancel in the customer portal → customer shows as churned
- [ ] Run each integration's live test in Admin → Integrations
- [ ] Replace estimate expenses in Admin → Finance with real costs
- [ ] Set consultation availability; book a test consultation
- [ ] Send yourself a test proposal and accept it
