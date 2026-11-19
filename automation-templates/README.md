# n8n automation templates

Four importable workflows that cover the most common client automations. Each one reports activity back to the Kairo platform through the HMAC-signed event API, so leads, appointments and actions appear in the client's portal and your admin analytics.

| File | Trigger | What it does |
|---|---|---|
| `n8n/01-website-lead-capture.json` | Webhook from a client's website form | Normalises the enquiry, qualifies it with OpenAI (JSON output), logs the lead in Kairo, SMSes the owner for hot leads (score ≥ 70) |
| `n8n/02-missed-call-text-back.json` | Twilio "call status" webhook | When a call is missed/busy, texts the caller back and logs the lead |
| `n8n/03-appointment-reminders.json` | Hourly schedule | Finds appointments 23–24h ahead in Google Calendar, sends SMS reminders, logs them |
| `n8n/04-voice-call-report.json` | End-of-call webhook from a voice-AI platform | Logs AI receptionist calls and callers as leads |

## Setup (once per n8n instance)

n8n environment variables (see `docs/DEPLOYMENT.md`):
`NODE_FUNCTION_ALLOW_BUILTIN=crypto`, `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`, `KAIRO_BASE_URL`, `KAIRO_WEBHOOK_SECRET` (= the platform's `AUTOMATION_WEBHOOK_SECRET`), `OPENAI_MODEL`, `TWILIO_ACCOUNT_SID`, `TWILIO_FROM_NUMBER`.

> For many clients on one n8n instance, duplicate the workflow per client and replace the `$env.*` client values (automation ID, `OWNER_MOBILE`, `BUSINESS_NAME`, calendar ID) with fixed values or an n8n *Set* node at the start of each copy.

## Per-client deployment

1. In Admin → Customers → the client → add/locate the automation. Copy its **automation ID**.
2. In n8n: *Import from file*, rename the workflow `<Client> · <Automation>`.
3. Set the automation ID (e.g. `KAIRO_AUTOMATION_ID_WEBSITE_LEAD`) and client values (`OWNER_MOBILE`, `BUSINESS_NAME`, `GOOGLE_CALENDAR_ID`).
4. Bind credentials on the nodes marked `REPLACE`: OpenAI (*Header Auth*: `Authorization: Bearer sk-…`), Twilio (*Basic Auth*), Google Calendar (OAuth2). Admins can push a client's stored credential straight into n8n from the customer page.
5. Back in the platform: set **Engine = n8n**, **Workflow ID** (from the n8n URL) and **Test webhook URL** (the n8n *test* or production webhook URL), then *Start build → Move to testing*.
6. **Test**: click *Send live test webhook* (signed `test: true` payload — the workflows verify the signature and never contact real customers on test runs) and verify the result in n8n's execution log. Record manual tests for anything webhook tests can't cover (e.g. place a real call to the Twilio number from your own phone).
7. *Request approval → Approve implementation → Activate*. With `N8N_API_KEY` set, activation switches the n8n workflow on; otherwise switch it on in n8n and tick the confirmation.

## Verified

The event-signing code in these templates was executed against the platform's `/api/automations/events` endpoint during development and accepted (HTTP 200, lead created). Node parameters target current n8n node versions (Webhook v2, Code v2, HTTP Request v4.2, IF v2, Schedule v1.2); if your n8n version differs, the importer will flag any node that needs a quick re-selection.
