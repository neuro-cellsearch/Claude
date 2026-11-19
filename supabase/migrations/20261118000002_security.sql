-- =============================================================================
-- Kairo Systems — functions, triggers, Row Level Security and grants
-- Principle: browsers only ever hold the anon key + the user's JWT. Every table
-- has RLS enabled; customers see only their own organisation's data; staff
-- access is checked via a SECURITY DEFINER helper. Writes that need elevated
-- privileges happen server-side with the service role key.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role in ('staff', 'admin')
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

-- New auth user -> profile + organisation + onboarding checklist
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_company text;
begin
  v_company := nullif(trim(coalesce(new.raw_user_meta_data ->> 'company_name', '')), '');

  insert into public.organizations (name, industry, status, acquisition_source)
  values (
    coalesce(v_company, split_part(new.email, '@', 1) || '''s business'),
    nullif(new.raw_user_meta_data ->> 'industry', ''),
    'prospect',
    'self_signup'
  )
  returning id into v_org_id;

  insert into public.profiles (id, email, full_name, organization_id, marketing_consent)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    v_org_id,
    coalesce((new.raw_user_meta_data ->> 'marketing_consent')::boolean, false)
  );

  perform public.seed_onboarding_tasks(v_org_id);
  return new;
end;
$$;

create or replace function public.seed_onboarding_tasks(p_org uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.onboarding_tasks (organization_id, key, title, description, owner, sort_order) values
    (p_org, 'business_info',   'Business information',        'Tell us about your business, hours and contact details.',                'customer', 10),
    (p_org, 'select_services', 'Choose your automations',      'Select the automations you want us to implement.',                       'customer', 20),
    (p_org, 'knowledge',       'Approved FAQs and knowledge',  'Provide the answers your AI may give. Nothing else will be said.',        'customer', 30),
    (p_org, 'integrations',    'Connect your tools',           'Securely share access details for calendars, CRM and phone systems.',     'customer', 40),
    (p_org, 'kickoff',         'Kick-off call',                'We confirm scope, success metrics and escalation rules.',                'agency',   50),
    (p_org, 'build',           'Configure automations',        'We configure each workflow in a staging environment.',                    'agency',   60),
    (p_org, 'test',            'Test every workflow',          'Every automation is tested end-to-end and results are recorded.',        'agency',   70),
    (p_org, 'approval',        'Review and approve go-live',   'Implementation reviewed and approved before anything goes live.',        'agency',   80),
    (p_org, 'go_live',         'Go live and monitor',          'Activated only after approval, then monitored for the first 14 days.',   'agency',   90)
  on conflict (organization_id, key) do nothing;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profile email in sync when the auth email changes
create or replace function public.handle_user_email_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- Fixed-window rate limiter usable from server code (service role only)
create or replace function public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  insert into public.rate_limits as rl (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set count = case when rl.window_start < now() - make_interval(secs => p_window_seconds) then 1 else rl.count + 1 end,
        window_start = case when rl.window_start < now() - make_interval(secs => p_window_seconds) then now() else rl.window_start end
  returning count into v_count;
  return v_count <= p_limit;
end;
$$;

-- Housekeeping for rate limits (call from cron)
create or replace function public.purge_rate_limits()
returns void language sql security definer set search_path = public as $$
  delete from public.rate_limits where window_start < now() - interval '1 day';
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','profiles','plans','subscriptions','payments','stripe_events','automations',
    'automation_tests','automation_events','customer_leads','appointments','onboarding_tasks',
    'integration_credentials','automation_requests','support_tickets','ticket_messages','enquiries',
    'availability_rules','consultations','crm_activities','quotes','email_messages','email_sequences',
    'email_sequence_steps','sequence_enrollments','prospects','suppression_list','outreach_templates',
    'outreach_campaigns','campaign_recipients','expenses','case_studies','testimonials','notifications',
    'audit_logs','data_requests','app_settings','rate_limits'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Staff: full access to every business table (admin-only tables restricted)
-- ---------------------------------------------------------------------------
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
    execute format('create policy staff_all on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t);
  end loop;
end $$;

-- Finance, audit and settings: admin only
create policy admin_all on public.expenses for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_read on public.audit_logs for select to authenticated using (public.is_admin());
create policy admin_all on public.app_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_read on public.stripe_events for select to authenticated using (public.is_admin());
-- integration_credentials and rate_limits: no policies => only the service role can touch them.

-- Staff can only promote/demote roles if admin (enforced by column grants + trigger below)
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Only administrators can change roles';
  end if;
  if new.organization_id is distinct from old.organization_id and auth.uid() is not null and not public.is_staff() then
    raise exception 'Only staff can change organisation membership';
  end if;
  return new;
end;
$$;
create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------------------------------------------------------------------------
-- Public (anonymous) read access
-- ---------------------------------------------------------------------------
create policy public_read on public.plans for select to anon, authenticated using (is_public or public.is_staff());
create policy staff_write on public.plans for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy public_read_published on public.case_studies for select to anon, authenticated using (published);
create policy public_read_published on public.testimonials for select to anon, authenticated using (published);
-- Enquiries, consultations and quotes are written by the server (service role) after validation
-- and rate limiting, so anonymous users get no direct table access.

-- ---------------------------------------------------------------------------
-- Customer (organisation member) access
-- ---------------------------------------------------------------------------
create policy member_read on public.organizations for select to authenticated
  using (id = public.current_org_id());
create policy member_update on public.organizations for update to authenticated
  using (id = public.current_org_id()) with check (id = public.current_org_id());

create policy self_read on public.profiles for select to authenticated using (id = auth.uid());
create policy self_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy member_read on public.subscriptions for select to authenticated using (organization_id = public.current_org_id());
create policy member_read on public.payments for select to authenticated using (organization_id = public.current_org_id());
create policy member_read on public.automations for select to authenticated using (organization_id = public.current_org_id());
create policy member_read on public.automation_events for select to authenticated using (organization_id = public.current_org_id());
create policy member_read on public.customer_leads for select to authenticated using (organization_id = public.current_org_id());
create policy member_update on public.customer_leads for update to authenticated
  using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy member_read on public.appointments for select to authenticated using (organization_id = public.current_org_id());
create policy member_read on public.onboarding_tasks for select to authenticated using (organization_id = public.current_org_id());

create policy member_read on public.automation_requests for select to authenticated using (organization_id = public.current_org_id());
create policy member_insert on public.automation_requests for insert to authenticated
  with check (organization_id = public.current_org_id() and created_by = auth.uid() and status = 'submitted');

create policy member_read on public.support_tickets for select to authenticated using (organization_id = public.current_org_id());
create policy member_insert on public.support_tickets for insert to authenticated
  with check (organization_id = public.current_org_id() and created_by = auth.uid());

create policy member_read on public.ticket_messages for select to authenticated
  using (not is_internal and exists (
    select 1 from public.support_tickets t where t.id = ticket_id and t.organization_id = public.current_org_id()));
create policy member_insert on public.ticket_messages for insert to authenticated
  with check (not is_internal and author_id = auth.uid() and exists (
    select 1 from public.support_tickets t where t.id = ticket_id and t.organization_id = public.current_org_id()));

create policy member_read on public.notifications for select to authenticated
  using (audience = 'organization' and organization_id = public.current_org_id());

create policy self_read on public.data_requests for select to authenticated using (profile_id = auth.uid());
create policy self_insert on public.data_requests for insert to authenticated
  with check (profile_id = auth.uid() and status = 'received');

-- Customers may see their own accepted/sent quotes
create policy member_read on public.quotes for select to authenticated
  using (organization_id = public.current_org_id() and status <> 'draft');

-- ---------------------------------------------------------------------------
-- Column-level privileges: stop customers changing sensitive columns directly
-- through the REST API even where a row-level UPDATE policy exists.
-- ---------------------------------------------------------------------------
revoke update on public.organizations from authenticated;
grant update (name, industry, website, phone, address, company_number, employee_count,
              description, business_hours, faq_knowledge, onboarding_submitted_at)
  on public.organizations to authenticated;

revoke update on public.profiles from authenticated;
grant update (full_name, phone, marketing_consent) on public.profiles to authenticated;

revoke update on public.customer_leads from authenticated;
grant update (status, notes) on public.customer_leads to authenticated;

-- Staff need broader updates: they go through the service-role client in server
-- actions after an explicit role check, so authenticated grants stay narrow.

revoke all on public.integration_credentials from anon, authenticated;
revoke all on public.rate_limits from anon, authenticated;
revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.purge_rate_limits() from public, anon, authenticated;
revoke execute on function public.seed_onboarding_tasks(uuid) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
grant execute on function public.purge_rate_limits() to service_role;
grant execute on function public.seed_onboarding_tasks(uuid) to service_role;
