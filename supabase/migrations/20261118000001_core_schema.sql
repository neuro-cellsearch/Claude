-- =============================================================================
-- Kairo Systems — core schema
-- All monetary values are stored as integer pence (GBP) to avoid float errors.
-- =============================================================================

-- gen_random_uuid() is built into PostgreSQL 13+, so no extension is required.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('customer', 'staff', 'admin');
create type public.org_status as enum ('prospect', 'onboarding', 'active', 'paused', 'churned');
create type public.subscription_status as enum ('pending', 'trialing', 'active', 'past_due', 'canceled', 'incomplete');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.payment_type as enum ('setup', 'subscription', 'one_off', 'refund');
create type public.automation_status as enum (
  'requested', 'in_build', 'testing', 'awaiting_approval', 'active', 'paused', 'failed', 'retired'
);
create type public.lead_status as enum ('new', 'contacted', 'qualified', 'won', 'lost');
create type public.appointment_status as enum ('booked', 'confirmed', 'rescheduled', 'cancelled', 'completed', 'no_show');
create type public.ticket_status as enum ('open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed');
create type public.ticket_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.enquiry_type as enum ('contact', 'consultation', 'quote', 'chatbot', 'proposal');
create type public.pipeline_stage as enum ('new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost');
create type public.quote_status as enum ('draft', 'sent', 'accepted', 'declined', 'expired');
create type public.task_owner as enum ('customer', 'agency');
create type public.task_status as enum ('todo', 'in_progress', 'done', 'blocked');
create type public.expense_category as enum ('software', 'ai_api', 'marketing', 'labour', 'contractors', 'other');
create type public.expense_frequency as enum ('monthly', 'annual', 'one_off');
create type public.prospect_status as enum (
  'new', 'approved', 'contacted', 'replied', 'interested', 'not_interested', 'do_not_contact'
);
create type public.entity_type as enum (
  'limited_company', 'llp', 'plc', 'scottish_partnership', 'public_body',
  'sole_trader', 'partnership', 'unknown'
);
create type public.outreach_channel as enum ('email', 'linkedin', 'phone');
create type public.campaign_status as enum ('draft', 'pending_approval', 'approved', 'sending', 'completed', 'cancelled');
create type public.recipient_status as enum ('pending', 'approved', 'skipped', 'sent', 'failed', 'replied');
create type public.email_status as enum ('queued', 'sent', 'failed', 'not_configured', 'suppressed');
create type public.enrollment_status as enum ('active', 'paused', 'completed', 'stopped');
create type public.consultation_status as enum ('scheduled', 'completed', 'cancelled', 'no_show');
create type public.request_status as enum ('submitted', 'reviewing', 'quoted', 'approved', 'declined', 'built');

-- ---------------------------------------------------------------------------
-- Shared trigger: maintain updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Organisations (customer businesses) and profiles
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  industry text,
  website text,
  phone text,
  address text,
  company_number text,
  employee_count text,
  description text,
  business_hours text,
  faq_knowledge text,              -- approved FAQs used to brief chatbots/receptionists
  status public.org_status not null default 'prospect',
  stripe_customer_id text unique,
  acquisition_source text,
  onboarding_submitted_at timestamptz,
  churned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger organizations_updated before update on public.organizations
  for each row execute function public.set_updated_at();

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  role public.user_role not null default 'customer',
  organization_id uuid references public.organizations (id) on delete set null,
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_org_idx on public.profiles (organization_id);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Plans, subscriptions and payments
-- ---------------------------------------------------------------------------
create table public.plans (
  id text primary key,                         -- 'starter' | 'growth' | 'premium' | 'enterprise'
  name text not null,
  setup_fee_pence integer not null check (setup_fee_pence >= 0),
  monthly_pence integer not null check (monthly_pence >= 0),
  description text,
  features jsonb not null default '[]'::jsonb,
  is_public boolean not null default true,
  sort_order integer not null default 0
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  plan_id text not null references public.plans (id),
  status public.subscription_status not null default 'pending',
  monthly_pence integer not null check (monthly_pence >= 0),
  setup_fee_pence integer not null default 0 check (setup_fee_pence >= 0),
  stripe_subscription_id text unique,
  stripe_checkout_session_id text unique,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  started_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_org_idx on public.subscriptions (organization_id);
create index subscriptions_status_idx on public.subscriptions (status);
create trigger subscriptions_updated before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  amount_pence integer not null,
  currency text not null default 'gbp',
  type public.payment_type not null,
  status public.payment_status not null default 'pending',
  description text,
  stripe_invoice_id text unique,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index payments_org_idx on public.payments (organization_id);
create index payments_paid_at_idx on public.payments (paid_at);

-- Idempotency for Stripe webhooks
create table public.stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Automations and their lifecycle
-- An automation can NEVER be active unless it has passed a recorded test and
-- has been explicitly approved — enforced at the database level.
-- ---------------------------------------------------------------------------
create table public.automations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  service_key text not null,
  name text not null,
  description text,
  status public.automation_status not null default 'requested',
  provider text not null default 'n8n',         -- n8n | make | vapi | custom
  external_workflow_id text,
  test_passed boolean not null default false,
  last_tested_at timestamptz,
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  activated_at timestamptz,
  config jsonb not null default '{}'::jsonb,     -- NON-secret configuration only
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint automation_active_requires_test_and_approval
    check (status <> 'active' or (test_passed and approved_at is not null))
);
create index automations_org_idx on public.automations (organization_id);
create trigger automations_updated before update on public.automations
  for each row execute function public.set_updated_at();

-- Any change to configuration or the external workflow invalidates the test
create or replace function public.automation_invalidate_test()
returns trigger language plpgsql as $$
begin
  if (new.config is distinct from old.config
      or new.external_workflow_id is distinct from old.external_workflow_id
      or new.provider is distinct from old.provider) then
    new.test_passed := false;
    new.approved_at := null;
    new.approved_by := null;
    if new.status = 'active' then
      new.status := 'testing';
    end if;
  end if;
  return new;
end;
$$;
create trigger automations_invalidate_test before update on public.automations
  for each row execute function public.automation_invalidate_test();

create table public.automation_tests (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations (id) on delete cascade,
  ran_by uuid references public.profiles (id),
  method text not null check (method in ('live_webhook', 'manual')),
  passed boolean not null,
  notes text,
  result jsonb,
  created_at timestamptz not null default now()
);
create index automation_tests_automation_idx on public.automation_tests (automation_id);

-- Activity reported by live automations (via signed webhook from n8n/Make)
create table public.automation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  automation_id uuid references public.automations (id) on delete set null,
  event_type text not null,
  summary text not null,
  payload jsonb,
  occurred_at timestamptz not null default now(),
  external_event_id text,
  unique (organization_id, external_event_id)
);
create index automation_events_org_time_idx on public.automation_events (organization_id, occurred_at desc);

-- Leads captured FOR customers by their automations
create table public.customer_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  automation_id uuid references public.automations (id) on delete set null,
  name text,
  email text,
  phone text,
  source text,
  enquiry text,
  status public.lead_status not null default 'new',
  score integer check (score between 0 and 100),
  estimated_value_pence integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customer_leads_org_time_idx on public.customer_leads (organization_id, created_at desc);
create trigger customer_leads_updated before update on public.customer_leads
  for each row execute function public.set_updated_at();

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid references public.customer_leads (id) on delete set null,
  title text not null,
  attendee_name text,
  attendee_contact text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status public.appointment_status not null default 'booked',
  source text,
  external_id text,
  created_at timestamptz not null default now(),
  unique (organization_id, external_id)
);
create index appointments_org_time_idx on public.appointments (organization_id, starts_at);

-- ---------------------------------------------------------------------------
-- Customer onboarding
-- ---------------------------------------------------------------------------
create table public.onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  key text not null,
  title text not null,
  description text,
  owner public.task_owner not null,
  status public.task_status not null default 'todo',
  sort_order integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, key)
);

-- Integration credentials supplied by customers. Values are encrypted
-- server-side (AES-256-GCM) before insert and are NEVER returned to browsers.
create table public.integration_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null,
  label text not null,
  secret_ciphertext text not null,
  hint text,                                     -- e.g. last 4 characters
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index integration_credentials_org_idx on public.integration_credentials (organization_id);

create table public.automation_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references public.profiles (id),
  service_key text not null,
  description text not null,
  status public.request_status not null default 'submitted',
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger automation_requests_updated before update on public.automation_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Support
-- ---------------------------------------------------------------------------
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references public.profiles (id),
  subject text not null,
  status public.ticket_status not null default 'open',
  priority public.ticket_priority not null default 'normal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_org_idx on public.support_tickets (organization_id);
create trigger support_tickets_updated before update on public.support_tickets
  for each row execute function public.set_updated_at();

create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_id uuid references public.profiles (id),
  body text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index ticket_messages_ticket_idx on public.ticket_messages (ticket_id);

-- ---------------------------------------------------------------------------
-- Agency sales: inbound enquiries, consultations, CRM activity, quotes
-- ---------------------------------------------------------------------------
create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  type public.enquiry_type not null,
  name text not null,
  email text not null,
  phone text,
  company text,
  industry text,
  role text,
  message text,
  services text[] not null default '{}',
  budget text,
  monthly_enquiries text,
  stage public.pipeline_stage not null default 'new',
  score integer not null default 0 check (score between 0 and 100),
  estimated_monthly_pence integer,
  marketing_consent boolean not null default false,
  utm jsonb,
  ip_hash text,
  organization_id uuid references public.organizations (id) on delete set null,
  assigned_to uuid references public.profiles (id),
  next_follow_up_at timestamptz,
  lost_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index enquiries_stage_idx on public.enquiries (stage);
create index enquiries_created_idx on public.enquiries (created_at desc);
create index enquiries_email_idx on public.enquiries (lower(email));
create trigger enquiries_updated before update on public.enquiries
  for each row execute function public.set_updated_at();

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 0 and 6),  -- 0 = Sunday
  start_minute smallint not null check (start_minute between 0 and 1439),
  end_minute smallint not null check (end_minute between 1 and 1440),
  slot_minutes smallint not null default 30 check (slot_minutes between 15 and 120),
  active boolean not null default true,
  check (end_minute > start_minute)
);

create table public.consultations (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid references public.enquiries (id) on delete set null,
  scheduled_for timestamptz not null,
  duration_minutes smallint not null default 30,
  status public.consultation_status not null default 'scheduled',
  meeting_url text,
  notes text,
  created_at timestamptz not null default now()
);
-- Prevent double-booking of a slot (cancelled slots are released)
create unique index consultations_slot_unique on public.consultations (scheduled_for)
  where status <> 'cancelled';

create table public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid references public.enquiries (id) on delete cascade,
  prospect_id uuid,
  organization_id uuid references public.organizations (id) on delete cascade,
  type text not null check (type in ('note', 'email', 'call', 'meeting', 'stage_change', 'system')),
  body text not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index crm_activities_enquiry_idx on public.crm_activities (enquiry_id, created_at desc);

create sequence public.quote_number_seq start 1001;

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('KS-' || nextval('public.quote_number_seq')::text),
  enquiry_id uuid references public.enquiries (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  recipient_name text not null,
  recipient_email text not null,
  company text,
  plan_id text references public.plans (id),
  title text not null,
  introduction text,
  scope text,
  line_items jsonb not null default '[]'::jsonb,   -- [{description, setup_pence, monthly_pence}]
  setup_total_pence integer not null default 0 check (setup_total_pence >= 0),
  monthly_total_pence integer not null default 0 check (monthly_total_pence >= 0),
  valid_until date,
  status public.quote_status not null default 'draft',
  public_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  accepted_name text,
  accepted_at timestamptz,
  sent_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger quotes_updated before update on public.quotes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Email: log, sequences, enrolments
-- ---------------------------------------------------------------------------
create table public.email_messages (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  subject text not null,
  body text not null,
  status public.email_status not null default 'queued',
  provider_message_id text,
  error text,
  context text,                  -- e.g. 'notification', 'sequence', 'campaign', 'transactional'
  related_id uuid,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_messages_created_idx on public.email_messages (created_at desc);

create table public.email_sequences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  trigger_type public.enquiry_type,   -- auto-enrol enquiries of this type (null = manual only)
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.email_sequence_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.email_sequences (id) on delete cascade,
  step_order integer not null,
  delay_days integer not null check (delay_days >= 0),
  subject text not null,
  body text not null,
  unique (sequence_id, step_order)
);

create table public.sequence_enrollments (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.email_sequences (id) on delete cascade,
  enquiry_id uuid not null references public.enquiries (id) on delete cascade,
  current_step integer not null default 1,
  status public.enrollment_status not null default 'active',
  next_send_at timestamptz,
  created_at timestamptz not null default now(),
  unique (sequence_id, enquiry_id)
);
create index sequence_enrollments_due_idx on public.sequence_enrollments (next_send_at)
  where status = 'active';

-- ---------------------------------------------------------------------------
-- Outbound prospecting (manual approval required at every stage)
-- ---------------------------------------------------------------------------
create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  industry text,
  website text,
  entity_type public.entity_type not null default 'unknown',
  company_number text,
  contact_name text,
  contact_role text,
  business_email text,
  business_phone text,
  linkedin_url text,
  source text not null,                       -- where the data came from (required for accountability)
  lawful_basis text not null default 'legitimate_interests',
  lia_notes text,                             -- legitimate interests assessment notes
  tps_checked_at timestamptz,                 -- TPS/CTPS screening date before calls
  tps_registered boolean,
  status public.prospect_status not null default 'new',
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index prospects_status_idx on public.prospects (status);
create trigger prospects_updated before update on public.prospects
  for each row execute function public.set_updated_at();

alter table public.crm_activities
  add constraint crm_activities_prospect_fk foreign key (prospect_id) references public.prospects (id) on delete cascade;

create table public.suppression_list (
  id uuid primary key default gen_random_uuid(),
  value text not null unique,                -- lower-cased email, domain (@example.com) or E.164 phone
  kind text not null check (kind in ('email', 'domain', 'phone')),
  reason text not null,
  created_at timestamptz not null default now()
);

create table public.outreach_templates (
  id uuid primary key default gen_random_uuid(),
  channel public.outreach_channel not null,
  industry text not null,
  name text not null,
  subject text,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger outreach_templates_updated before update on public.outreach_templates
  for each row execute function public.set_updated_at();

create table public.outreach_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel public.outreach_channel not null,
  template_id uuid references public.outreach_templates (id) on delete set null,
  industry text,
  status public.campaign_status not null default 'draft',
  daily_limit integer not null default 25 check (daily_limit between 1 and 200),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_sending_requires_approval
    check (status not in ('approved', 'sending', 'completed') or approved_at is not null)
);
create trigger outreach_campaigns_updated before update on public.outreach_campaigns
  for each row execute function public.set_updated_at();

create table public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.outreach_campaigns (id) on delete cascade,
  prospect_id uuid not null references public.prospects (id) on delete cascade,
  status public.recipient_status not null default 'pending',
  subject text,
  body text not null,
  approved_at timestamptz,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (campaign_id, prospect_id),
  constraint recipient_send_requires_approval
    check (status not in ('approved', 'sent') or approved_at is not null)
);

-- ---------------------------------------------------------------------------
-- Finance
-- ---------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category public.expense_category not null,
  amount_pence integer not null check (amount_pence >= 0),
  frequency public.expense_frequency not null default 'monthly',
  is_cost_of_delivery boolean not null default false,  -- counts against gross margin
  start_date date not null default current_date,
  end_date date,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Marketing proof: only verified, permissioned content is ever published
-- ---------------------------------------------------------------------------
create table public.case_studies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  client_name text not null,
  industry text not null,
  headline text not null,
  challenge text not null,
  solution text not null,
  results text not null,
  client_permission boolean not null default false,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  constraint case_study_publish_requires_permission check (not published or client_permission)
);

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  author_name text not null,
  author_role text,
  company text,
  quote text not null,
  client_permission boolean not null default false,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  constraint testimonial_publish_requires_permission check (not published or client_permission)
);

-- ---------------------------------------------------------------------------
-- Operations: notifications, audit, GDPR requests, settings, rate limits
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  audience text not null default 'staff' check (audience in ('staff', 'organization')),
  organization_id uuid references public.organizations (id) on delete cascade,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_created_idx on public.notifications (created_at desc);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

create table public.data_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  email text not null,
  kind text not null check (kind in ('export', 'deletion', 'rectification')),
  status text not null default 'received' check (status in ('received', 'in_progress', 'completed', 'rejected')),
  notes text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count integer not null
);
