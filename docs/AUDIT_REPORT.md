# Production-readiness audit — 24 November 2026

**Verdict: not yet deployed — by design.** I fixed all the critical and high-severity security and payment defects found, and the fixes are verified by automated tests. **One deployment gate remains:** the Stripe integration has never been run against real Stripe. No API key was available, and this sandbox can't reach `api.stripe.com`. Run the Stripe test-mode checklist in §2 before taking real payments.

## How it was tested

Everything below ran against the real application (production build) and a real Supabase-compatible stack: Postgres, GoTrue auth and PostgREST in Docker. **No mock data was used to claim an integration works.** Where an external service couldn't be reached, this report says so.

| Suite | What it does | Result |
|---|---|---|
| Unit (`npm test`) | Tax/forecast maths, lead scoring, DST-safe booking slots, PECR rules, AES-GCM encryption, open-redirect guard, environment validation | **51 / 51 pass** |
| `platform.spec` | Core journeys: booking, quote, registration and onboarding, proposal acceptance, automation lifecycle, signed automation events, finance, outreach, unsubscribe, chat fallback, mobile menu, 404 | **20 / 20 pass** |
| `actions.spec` | Every remaining button and form in the portal and admin, with each effect verified in the database | **8 / 8 pass** |
| `permissions.spec` | Row-level security matrix using real login tokens: anonymous visitor, customer A vs B, staff | **6 / 6 pass** |
| `auth-email.spec` | Real emails captured by Mailpit (a local mail catcher): signup confirmation, sign-out, password reset, account-enumeration check, staff invitation | **5 / 5 pass** |
| `stripe-webhook.spec` | Webhook *logic*, using events signed with Stripe's library (not real Stripe), plus the duplicate-checkout guard | **9 / 9 pass** |
| Page crawl | 66 routes × mobile (390 px) and desktop (1440 px) as anonymous, customer and admin, checking HTTP status, console errors, crashes, horizontal overflow and load time | **132 / 132 clean**; median load 68 ms, p95 127 ms |
| Other checks | Security headers, `npm audit`, secret scan of git history, stored-XSS probe, brute-force and IP-spoofing probes, log scan | Clean (details below) |

Reproduce: `npm test`, then with the stack running and `npm start`:
`MAILPIT_URL=http://localhost:54329 STRIPE_TEST_URL=http://localhost:3001 npm run test:e2e` (see README for the email-mode stack and the dummy-key Stripe instance).

---

## Defects found and fixed in this audit

| # | Severity | Area | Defect | Fix | Verified by |
|---|---|---|---|---|---|
| 1 | **Critical** | Permissions | Staff accounts could write directly to the database through Supabase's REST API. That let them self-approve and activate automations, bypassing both the admin-only approval and the test requirement, and create pre-approved outreach campaigns. Proven with a real staff token. | Migration `…0004`: browser tokens for staff and admin are now **read-only**. All privileged writes already go through server code with role checks. | `permissions.spec` |
| 2 | **High** | Security | **Open redirect:** `/login?next=/\evil.example` sent users to an attacker's site after a genuine login, which is useful for phishing. Proven in a browser. | `safeRedirectPath()` used for login, the auth callback and email confirmation | unit + browser probe |
| 3 | **High** | Security | Email lookups used `ilike` (case-insensitive SQL `LIKE`), where `_` and `%` act as wildcards: `j_hn@x.com` matched `john@x.com`. Effects: another person's accepted proposal could appear on the wrong customer's billing page; unsubscribe and do-not-contact could hit other records; admin role changes and invites could select the wrong user. | Exact matching on lower-cased emails | code + `actions.spec` |
| 4 | **High** | Security | Login rate limiting could be bypassed by rotating `X-Forwarded-For` (each spoofed IP got a new counter). Proven: 14+ guesses unblocked. | Prefer IP headers set by the hosting platform (Vercel, Cloudflare, `x-real-ip`) **plus a per-account limit** (15 per 15 min); password reset limited per email | IP-rotation probe: account locks at attempt 16 |
| 5 | **High** | Availability | If the client IP couldn't be determined (e.g. a misconfigured proxy), **every user shared one limit bucket** and the whole site would lock out after 10 logins. | IP limits are skipped with a logged warning when the IP is unknown; per-account and per-email limits still apply; the chat has a global spend cap | code review + tests |
| 6 | **High** | Payments | A `checkout.session.completed` event with `payment_status: unpaid` (delayed payment methods such as Bacs Direct Debit) **granted access before money cleared**. | Access is granted only when the session is paid; `async_payment_succeeded` and `async_payment_failed` are handled | `stripe-webhook.spec` |
| 7 | **High** | Payments | A customer with an active subscription could start a **second checkout** (the UI hid the option, but the server didn't check). | Server rejects it; a Stripe idempotency key collapses double-clicks | `stripe-webhook.spec` (stale-tab test) |
| 8 | **High** | Payments | Stripe calls outside the try/catch: a Stripe outage or bad key caused an **unhandled server error**, so the customer saw nothing happen. | All Stripe calls wrapped; the customer sees "We couldn't start checkout" | real call to an unreachable Stripe |
| 9 | Medium | Payments | Refunds weren't recorded, so revenue and profit were overstated. | `charge.refunded` → negative payment, recorded once per refund | `stripe-webhook.spec` |
| 10 | Medium | Payments | If the first invoice arrived before the checkout event, its payments weren't linked to the subscription. | Payments are back-linked when the checkout event is processed | `stripe-webhook.spec` |
| 11 | **High** | Broken feature | **Staff invitations never worked.** Supabase returns invite sessions in the URL fragment, which never reaches the server, so every invited client dead-ended on the login page. | New `/auth/accept` client page sets the session and clears the tokens from the URL | `auth-email.spec` (real invite email) |
| 12 | **High** | Broken feature | **The chat widget crashed the whole page** on the first message. Newer browsers return a Promise from `scrollIntoView`, and an effect returned it as if it were a cleanup function. | Effect body braced | `platform.spec` (desktop + mobile) |
| 13 | **High** | UX / all forms | **A validation error wiped every field the user had typed** (React 19 auto-resets forms after every action). Affected registration, enquiries, booking, login (email cleared after a wrong password) and every admin form. | `useFormAction` hook: no reset on error, explicit reset only after success | `platform.spec` regression checks |
| 14 | Medium | Performance | Each dashboard view triggered ~20 background renders of other dashboards (sidebar prefetching of fully dynamic pages): a 20× server-load multiplier. | Prefetch disabled on dashboard navigation; loading skeletons added | crawl: median 68 ms |
| 15 | Medium | Mobile | Horizontal overflow at 390 px on Consultations, Prospects, Finance and Customer detail (and Prospects at 1440 px). | Grid children can shrink (`min-width: 0`) so wide tables scroll inside their cards | crawl: 132/132 clean |
| 16 | Medium | UX | After a failed automation test, the panel holding the failure message collapsed and hid it. | Panel stays open when the status is `failed` | `actions.spec` |
| 17 | Medium | Config | No validation of configuration: a malformed `ENCRYPTION_KEY`, an HTTP site URL in production, or a Stripe key without its webhook secret (payments taken but never recorded) went unnoticed. | `checkEnv()` runs at server start (logged) and is shown in Admin → Integrations | unit |
| 18 | Low | Security | Auth cookies weren't marked `Secure`. | `Secure` on HTTPS deployments, `SameSite=Lax` | code |
| 19 | Low | Security | Prospect website and LinkedIn URLs accepted any scheme (e.g. `javascript:`). | Only `http(s)` accepted and rendered | code |
| 20 | Low | Accessibility | The mobile chat button had no accessible name; some admin form labels weren't linked to their inputs. | `aria-label`; labels linked | crawl + tests |
| 21 | Low | Observability | Unhandled server errors weren't logged in the structured format. | `onRequestError` instrumentation | code |
| 22 | Low | DX | No branded error or 404 pages (Next.js defaults were shown). | `error.tsx`, `not-found.tsx` | `platform.spec` |
| 23 | Low | Local stack | The local gateway broke when the auth container was recreated (stale IP), sent no CORS headers, and produced wrong verify-link paths. | nginx re-resolves containers via Docker DNS, CORS parity with hosted Supabase, GoTrue URL paths; optional `docker-compose.email.yml` (Mailpit) | `auth-email.spec` |
| 24 | Low | Database | Missing indexes on foreign keys and lookup columns. | 12 indexes in migration `…0004` | migration applied |

**Clean results:** stored-XSS probe (script payloads in name, company and message render as inert text on every admin view); security headers (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) on pages, APIs and portal routes; no `X-Powered-By`; `npm audit --omit=dev`: 0 vulnerabilities; no secrets in git history (only obvious test fixtures); `.env.local` git-ignored; zero application errors in the server logs across every run (the one database message was PostgREST's own startup check timing out while the database booted).

---

## 1. Fully working features (verified end-to-end on the local stack)

- **Website:** all 32 public routes render without errors on mobile and desktop; interactive workflow demo; branded 404.
- **Consultation booking:** real availability from the database, UK time/DST-correct slots, double-booking prevented by the database, admin availability editor.
- **Enquiries and quotes:** validation (input kept on error), honeypot, IP and per-email rate limits, lead scoring, deduplication, staff notifications, CRM timeline, stage changes, activity logging.
- **Proposals:** generated from a template, line-item totals, public link, acceptance (name + authority), enquiry marked won, decline/expire.
- **Authentication:** registration, email confirmation, login (rate-limited per IP and per account), sign-out, password reset (no account enumeration), staff invitations, role-based routing, open-redirect protection.
- **Client portal:** onboarding wizard, encrypted credential storage (write-only; the ciphertext is never served), automation status timeline, activity, leads (status updates + CSV export with formula-injection protection), appointments, analytics, business details and profile, support conversations (internal notes hidden), automation requests, GDPR export and deletion requests.
- **Admin:**
  - KPI overview, revenue/MRR/acquisition/profit charts (pounds, not pence), notifications.
  - Customers, onboarding checklist, automation lifecycle (build → recorded test → admin approval → activation), with activation blocked by the database without a passed test and approval.
  - Live test webhook recording (including failures), support desk, subscriptions and payments views.
  - Finance (expenses CRUD, P&L, forecast calculator), case studies and testimonials (permission enforced by the database; published proof appears on the site).
  - Settings (roles, plan pricing reflected on the site, data requests), audit log, configuration check.
- **Outreach compliance:**
  - Prospect approval; PECR corporate-subscriber rule for email.
  - TPS screening for calls.
  - Every message reviewed (unfilled placeholders block approval) and every campaign approved by an admin.
  - Opt-out line required in email templates; suppression list; do-not-contact; signed unsubscribe links.
- **Automation event API:** HMAC verification, ±5-minute timestamp window, idempotency, only *active* automations may log live events; leads and appointments appear in the client portal. The signing code in the n8n templates was executed against this endpoint and accepted.
- **Email sequences:** enrolment, processing, automatic stop on stage change or unsubscribe, honest `not_configured` status when no provider is set.
- **Cron endpoint** (bearer-protected), **health endpoint**, **permissions** (full RLS matrix), **security headers**.

## 2. Features requiring API credentials (implemented, **not verified against the real service**)

| Feature | Credentials | What I could and couldn't verify |
|---|---|---|
| **Payments** (checkout, subscriptions, invoices, customer portal) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Webhook logic verified with signed synthetic events. Checkout's failure path verified with a real (failing) call. **Never run against real Stripe.** The invoice line-item classification (setup vs recurring) depends on the Stripe API version's payload shape and must be checked in test mode. |
| Website AI assistant, AI proposal drafting | `OPENAI_API_KEY` | Fallback behaviour verified (honest "not switched on" message; no crash). Real responses and the lead-capture tool call are untested. |
| All outgoing email (acknowledgements, notifications, sequences, proposals, campaigns) | `RESEND_API_KEY`, `EMAIL_FROM` | Every attempt is logged as `not_configured`; nothing is falsely marked sent. Delivery and deliverability are untested. |
| Workflow activation/pausing from admin; pushing credentials to n8n | `N8N_BASE_URL`, `N8N_API_KEY` | Manual-confirmation path verified. The n8n API calls are untested. The templates haven't been imported into a real n8n. |
| SMS, missed-call text-back, voice routing | `TWILIO_*` (+ UK regulatory bundle) | Untested. |
| AI receptionist | Voice-AI platform account (+ Twilio) | Untested; the call-report template's signing is verified. |
| HubSpot, Calendly, Google Calendar, ElevenLabs, Make | respective tokens | "Run live test" buttons make real calls; untested without keys. |

**Stripe test-mode checklist (required before deploying with payments):**
1. Register → choose plan → pay with `4242 4242 4242 4242`. The subscription appears as `active` in Admin → Billing, and payments are split into setup and recurring.
2. Use a Bacs/SEPA test method. Access must stay locked until `async_payment_succeeded`.
3. Card `4000 0000 0000 0341` (attaches, then fails): renewal → `past_due` + notification.
4. Refund in the Stripe dashboard → a negative payment appears.
5. Cancel via the customer portal → the customer shows as churned.
6. Admin → Integrations → Stripe "Run live test" passes.

## 3. Features requiring manual configuration

- **Supabase:** London project; run migrations (`…0001`–`…0004`).
  - Site URL plus redirect URLs `/auth/callback` **and `/auth/accept`**.
  - Email confirmation on; custom SMTP.
  - **Raise Authentication → Rate Limits for sign-ins**: auth calls come from the app server's IP, so the default per-IP limits apply to all users together.
  - Pro plan backups and point-in-time recovery.
- **Hosting:** all environment variables set until Admin → Integrations shows no configuration issues. Use Vercel, or a reverse proxy that sets `X-Real-IP` and strips client-supplied forwarding headers. A cron caller for `/api/cron/process`.
- **Stripe:** business verification; webhook endpoint with the 8 events listed in `INTEGRATIONS.md`; customer portal enabled; Stripe Tax if VAT-registered.
- **Email:** verify the sending domain (SPF/DKIM/DMARC); a separate subdomain for outreach.
- **n8n:** deploy, set environment variables, import and bind templates, test each per client.
- **Business and legal:**
  - Company name, number, address and ICO registration environment variables (the boot check warns if they're missing).
  - Solicitor review of the privacy policy, terms and DPA; ICO fee; insurance.
  - Replace the estimate expenses with real costs; set consultation availability; activate email sequences.
- **Admin accounts:** `scripts/grant-admin.mjs`; strong unique passwords.

## 4. Remaining bugs and risks (not fixed — none critical)

| Severity | Item | Recommendation |
|---|---|---|
| Medium | The content security policy allows `'unsafe-inline'` scripts (needed by Next's inline bootstrap without nonces). React's output escaping is the main XSS defence. | Move to a nonce-based CSP via `proxy.ts`. |
| Medium | No multi-factor authentication for admin and staff accounts. | Enable Supabase MFA (TOTP) and enforce it for admin/staff. |
| Medium | Plan changes aren't possible from the Stripe customer portal (prices are created inline per checkout). | Create Stripe Products/Prices per plan if you want self-service upgrades; until then, upgrades go through a new proposal. |
| Low | The per-account login counter also counts successful logins (15 per 15 min). | Count failures only, if users report lockouts. |
| Low | Registration has no per-email limit (relies on the IP limit plus Supabase's signup/email limits). | Add CAPTCHA (e.g. Turnstile) on registration and public forms if spam appears. |
| Low | The public enquiry form sends an acknowledgement email to whatever address is entered (rate-limited per IP and per email). | Acceptable; add CAPTCHA if abused. |
| Low | Automation events without `external_event_id` can be replayed within the 5-minute signature window. | The templates send IDs; require `external_event_id` in a future API version. |
| Low | Stripe disputes (`charge.dispute.*`) aren't tracked. | Add a handler and notification. |
| Low | Simple status forms (`<form action>` with selects, e.g. lead status) show no inline error if the action throws (the error page appears instead). | Migrate them to `useFormAction` when convenient. |
| Low | RLS policies call `current_org_id()` per row. | Wrap as `(select public.current_org_id())` for query-plan caching when tables reach ~100k rows. |
| Low | Supabase auth cookies are readable by JavaScript (`httpOnly: false` is a design constraint of `@supabase/ssr`). | Mitigated by output escaping and the CSP; the nonce-based CSP above reduces the risk further. |
| Info | The intermittent outreach-test failure noted in the previous build did not recur in 8 full runs today. | — |

## Deployment recommendation

1. Deploy to a **staging** project with Stripe in **test mode** and complete the Stripe checklist in §2.
2. Fix any payload-shape differences found there (most likely in `invoice.paid` line classification).
3. Configure Supabase auth rate limits and enable MFA for admin/staff.
4. Switch to live keys only after Admin → Integrations shows no configuration errors and every live test passes.
