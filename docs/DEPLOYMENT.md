# Production deployment

Recommended: **Supabase (London region) + Vercel**. Total time ≈ 1–2 hours excluding Stripe verification and DNS propagation. Alternatives (Docker on a VPS, Netlify, Railway) work — the app is a standard Next.js server with no Vercel-specific code except `vercel.json` (cron).

## 1. Supabase

1. Create a project at supabase.com → **Region: London (eu-west-2)** → strong DB password.
2. **Project Settings → API**: copy *Project URL*, *anon* key and *service_role* key.
3. **Project Settings → Database → Connection string → URI** (direct connection, port 5432): this is `DATABASE_URL` for migrations.
4. Apply migrations from your machine:
   ```bash
   DATABASE_URL="postgresql://postgres:…@db.<ref>.supabase.co:5432/postgres" node scripts/migrate.mjs
   ```
   The script is idempotent (tracks applied files in `schema_migrations`). Run it again after every release that adds a migration.
5. **Authentication → URL Configuration**: Site URL = `https://yourdomain.co.uk`; add redirect URLs `https://yourdomain.co.uk/auth/callback` and `https://yourdomain.co.uk/auth/accept` (used by staff invitations).
6. **Authentication → Providers → Email**: keep *Confirm email* **on**. Set minimum password length ≥ 10.
7. **Authentication → Emails → SMTP**: configure custom SMTP (Resend: `smtp.resend.com`, port 465, user `resend`, password = API key) so confirmation, reset and invite emails come from your domain. Supabase's built-in mailer is rate-limited and not for production.
8. **Database → Backups**: Pro plan includes daily backups (7 days). Enable **Point-in-Time Recovery** add-on once you have paying customers. See *Backups* below for an independent off-site copy.

## 2. Vercel

1. Import the Git repository into Vercel (framework auto-detected).
2. Add **every** variable from `.env.example` under *Settings → Environment Variables* (Production). Generate secrets with:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # ENCRYPTION_KEY
   node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"      # AUTOMATION_WEBHOOK_SECRET, CRON_SECRET, IP_HASH_SALT
   ```
   ⚠️ **Never rotate `ENCRYPTION_KEY` casually** — existing client credentials become unreadable. Store a copy in your password manager.
3. Deploy, then add your domain under *Settings → Domains* and update DNS.
4. **Cron:** `vercel.json` calls `/api/cron/process` every 15 minutes (sends due follow-ups, expires proposals, purges rate-limit rows). Vercel sends `Authorization: Bearer $CRON_SECRET` automatically. The Hobby plan only allows daily crons — use Pro (~$20/month), or call the endpoint from any scheduler (n8n *Schedule* node, cron-job.org) with the bearer header.
5. Redeploy after changing any `NEXT_PUBLIC_*` variable (they're inlined at build time).

## 3. First admin

1. Visit `https://yourdomain.co.uk/register`, create your account, confirm your email.
2. Promote yourself: `DATABASE_URL=… node scripts/grant-admin.mjs you@yourdomain.co.uk`
3. Sign in → `/admin`. Then in the admin area:
   - **Settings**: check plan prices; add staff by email after they register.
   - **Finance**: replace the estimate expenses with your real costs.
   - **Consultations**: set your weekly availability.
   - **Integrations**: run the live test on every integration you've configured.
   - **Sequences**: activate follow-up sequences once email passes its test.

## 4. Stripe

See `docs/INTEGRATIONS.md#stripe`. Create the webhook endpoint `https://yourdomain.co.uk/api/stripe/webhook` and use **test mode** end-to-end (test card `4242 4242 4242 4242`) before switching to live keys.

## 5. n8n (automation engine)

Smallest reliable setup: a 2 vCPU / 4 GB VPS (Hetzner, DigitalOcean) with Docker, behind Caddy for HTTPS:

```yaml
# docker-compose.yml on the VPS
services:
  n8n:
    image: n8nio/n8n:latest
    restart: unless-stopped
    environment:
      - N8N_HOST=n8n.yourdomain.co.uk
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://n8n.yourdomain.co.uk/
      - GENERIC_TIMEZONE=Europe/London
      - NODE_FUNCTION_ALLOW_BUILTIN=crypto
      - N8N_BLOCK_ENV_ACCESS_IN_NODE=false
      - N8N_ENCRYPTION_KEY=<random 32+ chars, back it up>
      - KAIRO_BASE_URL=https://yourdomain.co.uk
      - KAIRO_WEBHOOK_SECRET=<same as AUTOMATION_WEBHOOK_SECRET>
    volumes: [n8n_data:/home/node/.n8n]
  caddy:
    image: caddy:2
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    command: caddy reverse-proxy --from n8n.yourdomain.co.uk --to n8n:5678
volumes: { n8n_data: {} }
```

Enable n8n's owner account and 2FA immediately, back up the `n8n_data` volume nightly, then import the templates (see `automation-templates/README.md`).

## Backups

| What | How | Frequency |
|---|---|---|
| Supabase database | Built-in daily backups (Pro) + PITR add-on | Continuous / daily |
| Off-site copy | `pg_dump "$DATABASE_URL" -Fc -f kairo-$(date +%F).dump` to encrypted storage (e.g. S3 with object lock, Backblaze B2) — schedule via GitHub Actions or your VPS cron | Daily |
| n8n workflows & credentials | Snapshot the `n8n_data` volume **and** the `N8N_ENCRYPTION_KEY` | Daily |
| Secrets | `ENCRYPTION_KEY`, `N8N_ENCRYPTION_KEY`, Stripe/OpenAI keys in a password manager | On change |

**Test a restore quarterly**: `pg_restore -d <scratch-db> kairo-YYYY-MM-DD.dump`, run `npm run db:migrate` against it and start the app locally.

## Monitoring & operations

- Point an uptime monitor (Better Stack, UptimeRobot) at `/api/health` (returns 503 when the DB is unreachable).
- Vercel → Logs show structured JSON (`level`, `msg`) — create alerts on `level:error`.
- Admin overview shows notifications for every new enquiry, payment failure, churn, support ticket and onboarding submission.
- Weekly: review `/admin/automations` (failure events, test pass rate) and `/admin/support`.

## Security checklist before launch

- [ ] Supabase email confirmation on, custom SMTP configured
- [ ] All secrets set in Vercel only (never committed); `.env.local` is git-ignored
- [ ] Stripe webhook secret set and live test passing in `/admin/integrations`
- [ ] `AUTOMATION_WEBHOOK_SECRET` shared only with n8n
- [ ] Admin accounts use strong unique passwords (enable Supabase MFA for staff when available on your plan)
- [ ] Privacy policy and terms reviewed by a solicitor; company details set in `NEXT_PUBLIC_COMPANY_*`
- [ ] ICO data protection fee paid and registration number set in `NEXT_PUBLIC_ICO_REGISTRATION`
- [ ] Off-site backup job running and one restore tested
- [ ] Supabase → Authentication → Rate Limits raised for sign-in/sign-up (auth calls originate from the app server's IP)
- [ ] Self-hosting only: reverse proxy sets `X-Real-IP` and strips client-supplied `X-Forwarded-For`
- [ ] Admin → Integrations shows no configuration issues
- [ ] Stripe test-mode checklist in `docs/AUDIT_REPORT.md` §2 completed
