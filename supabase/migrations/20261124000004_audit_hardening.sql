-- =============================================================================
-- Production-readiness audit hardening
--
-- 1. Staff/admin JWTs become READ-ONLY at the REST layer.
--    Previously a staff user could PATCH automations (self-approve + activate),
--    insert pre-approved outreach campaigns, etc. directly via PostgREST,
--    bypassing the admin-only checks in server actions. The application already
--    performs every staff/admin write server-side with the service role after an
--    explicit role check, so browser tokens never need write access here.
-- 2. Indexes for foreign keys used in lookups.
-- =============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'organizations','profiles','subscriptions','payments','automations','automation_tests',
    'automation_events','customer_leads','appointments','onboarding_tasks','automation_requests',
    'support_tickets','ticket_messages','enquiries','availability_rules','consultations',
    'crm_activities','quotes','email_messages','email_sequences','email_sequence_steps',
    'sequence_enrollments','prospects','suppression_list','outreach_templates','outreach_campaigns',
    'campaign_recipients','case_studies','testimonials','notifications','data_requests'
  ] loop
    execute format('drop policy if exists staff_all on public.%I', t);
    execute format('create policy staff_read on public.%I for select to authenticated using (public.is_staff())', t);
  end loop;
end $$;

drop policy if exists admin_all on public.expenses;
create policy admin_read on public.expenses for select to authenticated using (public.is_admin());

drop policy if exists admin_all on public.app_settings;
create policy admin_read on public.app_settings for select to authenticated using (public.is_admin());

drop policy if exists staff_write on public.plans;

-- Foreign-key / lookup indexes
create index if not exists quotes_enquiry_idx on public.quotes (enquiry_id);
create index if not exists quotes_recipient_email_idx on public.quotes (recipient_email) where status = 'accepted';
create index if not exists crm_activities_prospect_idx on public.crm_activities (prospect_id);
create index if not exists sequence_enrollments_enquiry_idx on public.sequence_enrollments (enquiry_id);
create index if not exists consultations_enquiry_idx on public.consultations (enquiry_id);
create index if not exists automation_events_automation_idx on public.automation_events (automation_id);
create index if not exists customer_leads_automation_idx on public.customer_leads (automation_id);
create index if not exists payments_subscription_idx on public.payments (subscription_id);
create index if not exists prospects_business_email_idx on public.prospects (business_email);
create index if not exists enquiries_email_exact_idx on public.enquiries (email);
create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists integration_credentials_created_by_idx on public.integration_credentials (created_by);
