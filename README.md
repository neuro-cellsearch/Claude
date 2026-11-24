# Kairo Systems — AI Automation Agency Platform

A complete, deployable platform for running a UK AI-automation agency: a premium marketing website, customer acquisition system, client portal, administration dashboard, billing, onboarding, automation lifecycle management and financial planning — built on Next.js, Supabase, Stripe, OpenAI and n8n.

> **Status:** fully built and tested locally against a real Supabase-compatible stack (Postgres + GoTrue auth + PostgREST). Third-party integrations (Stripe, OpenAI, Resend, Twilio, n8n, HubSpot…) are implemented with real API calls but **need your credentials** before they work. Nothing in the platform reports an integration as working until a live API test passes. See [`docs/CREDENTIALS_CHECKLIST.md`](docs/CREDENTIALS_CHECKLIST.md).

## What's included

| Area | Highlights |
|---|---|
| **Website** | Home (with interactive workflow demo), 6 service sales pages, 8 industry pages, pricing, case studies (honest by design), about, contact, consultation booking, quote request, privacy, terms, unsubscribe |
| **Acquisition** | Scored enquiry pipeline (board + table), built-in consultation calendar (UK time/DST aware), AI website assistant with consented lead capture, staff notifications, follow-up email sequences, proposal generator (template + optional AI), public proposal acceptance |
| **Outbound** | Prospect database with lawful-basis fields, PECR/TPS compliance gating, 18 outreach templates (cold email, LinkedIn, phone × 6 industries), campaigns with per-message review and admin approval, daily send limits, suppression list |
| **Client portal** | Registration, onboarding wizard, automation status timeline, activity log, leads (status updates + CSV export), appointments, analytics charts, business details, billing via Stripe, support tickets, automation requests, GDPR export/deletion |
| **Admin** | KPI overview (MRR, ARR, ARPA, churn, LTV, pipeline value, net-profit target), revenue/MRR/acquisition/profit charts, customers, onboarding tracker, automation lifecycle (build → test → approve → activate), support desk, subscriptions & payments, finance with editable expenses + forecast calculator (5/10/15/20/30 scenarios, UK corporation tax), case studies/testimonials, integrations status with live tests, team roles, pricing, GDPR requests, audit log |
| **Automation engine** | Signed event API for n8n/Make/voice platforms; four importable n8n templates (website lead + AI qualification, missed-call text-back, appointment reminders, AI receptionist call report) |
| **Security** | Row-level security on every table, column-level grants, DB-enforced "no activation without test + approval", AES-256-GCM credential encryption, HMAC webhooks, rate limiting, CSP and security headers, audit log, hashed IPs |

## Quick start (local)

Requirements: Node 20.9+, Docker, `psql`.

```bash
npm install
npm run db:up            # Postgres + Supabase Auth + PostgREST + gateway on :54321
npm run env:local        # writes .env.local with local keys (never use in production)
npm run db:migrate       # applies supabase/migrations/*
npm run dev              # http://localhost:3000
```

Create your admin account: register at `/register`, then `npm run admin:grant -- you@yourdomain.co.uk`, and sign in at `/login` → you'll land on `/admin`.

## Tests

```bash
npm test                                   # 51 unit tests
npm run build && npm start &               # app on :3000
npm run test:e2e                           # journeys, every button/form, RLS permission matrix

# Real email auth flows (confirmation, reset, invites) via Mailpit:
docker compose -f docker-compose.yml -f docker-compose.email.yml up -d
MAILPIT_URL=http://localhost:54329 npm run test:e2e

# Stripe webhook LOGIC tests (synthetic signed events — not a substitute for Stripe test mode):
STRIPE_SECRET_KEY=sk_test_dummy STRIPE_WEBHOOK_SECRET=whsec_localtest npx next start -p 3001 &
STRIPE_TEST_URL=http://localhost:3001 npm run test:e2e
```

Latest results and the full production-readiness audit: [`docs/AUDIT_REPORT.md`](docs/AUDIT_REPORT.md).

## Documentation

| Document | Contents |
|---|---|
| [`docs/BRAND.md`](docs/BRAND.md) | Name, logo concept, colour, typography, voice and messaging |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Stack choice and costs, structure, data model, security model |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Production deployment (Supabase + Vercel), cron, backups, monitoring |
| [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) | Setting up every provider; automation event API; n8n templates |
| [`docs/BUSINESS_PLAN.md`](docs/BUSINESS_PLAN.md) | Offer, pricing logic, the path to £10k/month net profit, acquisition plan |
| [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md) | UK GDPR, PECR, TPS, AI transparency, advertising rules — and how the platform enforces them |
| [`docs/AUDIT_REPORT.md`](docs/AUDIT_REPORT.md) | Production-readiness audit: fixes, verified features, credentials, remaining risks |
| [`docs/CREDENTIALS_CHECKLIST.md`](docs/CREDENTIALS_CHECKLIST.md) | Everything that needs your credentials, decisions or manual approval |
| [`automation-templates/README.md`](automation-templates/README.md) | Importing and testing the n8n workflows |

## Project structure

```
src/
  app/
    (marketing)/        public website + public form actions
    (auth)/             login, register, password reset
    portal/             client portal (RLS-scoped to the customer's organisation)
    admin/              admin dashboard; _actions/ holds all privileged server actions
    api/                chat, slots, Stripe webhook, automation events, cron, health
    proposal/[token]/   public proposal view & acceptance
  components/           ui primitives, marketing, dashboard (charts, shell, forecast calculator)
  lib/                  auth, supabase clients, integrations/*, sales/*, finance, scoring, slots, crypto…
supabase/migrations/    schema, RLS & grants, reference data (plans, templates, sequences)
automation-templates/   n8n workflow JSON
scripts/                migrate, local env generator, grant admin
tests/                  unit (vitest) and e2e (playwright)
```
