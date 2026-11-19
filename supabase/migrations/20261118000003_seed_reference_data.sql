-- =============================================================================
-- Kairo Systems — reference data (plans, outreach templates, sequences)
-- Safe to re-run: uses ON CONFLICT / NOT EXISTS guards.
-- =============================================================================

insert into public.plans (id, name, setup_fee_pence, monthly_pence, description, features, is_public, sort_order) values
('starter', 'Starter', 49900, 29900,
 'One focused automation to stop enquiries slipping through the cracks.',
 '["One core automation workflow","Website lead capture","Basic AI chatbot trained on your approved FAQs","Instant new-lead notifications","Monthly performance report","Email support"]', true, 10),
('growth', 'Growth', 99900, 79900,
 'A connected lead-to-booking system for businesses ready to scale.',
 '["Up to 4 automation workflows","Advanced AI chatbot with lead qualification","CRM integration (HubSpot or existing CRM)","Appointment booking with reminders","Automated follow-up sequences","Monthly optimisation review","Priority email support"]', true, 20),
('premium', 'Premium', 199900, 149900,
 'Full front-office automation including AI voice reception where supported.',
 '["Up to 10 automation workflows","AI receptionist (where telephony supported)","Multiple workflow and app integrations","Advanced CRM automation and pipeline reporting","Performance analytics dashboard","Quarterly strategy session","Priority support with 4-hour response target"]', true, 30),
('enterprise', 'Enterprise', 0, 0,
 'Custom scope, volumes, SLAs and integrations — quoted individually.',
 '["Custom workflow scope","Multi-site and multi-team setups","Custom SLAs","Dedicated implementation lead"]', true, 40)
on conflict (id) do update set
  name = excluded.name, description = excluded.description, features = excluded.features, sort_order = excluded.sort_order;

-- Default consultation availability: Mon–Fri, 09:30–17:00 (UK time is applied in the app)
insert into public.availability_rules (weekday, start_minute, end_minute, slot_minutes)
select d, 570, 1020, 30 from generate_series(1, 5) as d
where not exists (select 1 from public.availability_rules);

insert into public.app_settings (key, value) values
  ('business', '{"legal_name":"Kairo Systems Ltd","trading_name":"Kairo Systems","registered_address":"Set your registered address in Admin → Settings","company_number":"","vat_number":"","support_email":"support@example.com","timezone":"Europe/London"}'),
  ('finance', '{"net_profit_target_pence":1000000,"corporation_tax_mode":"uk_marginal","payment_fee_percent":1.5,"payment_fee_fixed_pence":20}')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Inbound follow-up sequence (people who asked us to contact them).
-- Inactive by default: switch on in Admin → Sequences once email is configured.
-- ---------------------------------------------------------------------------
do $$
declare v_seq uuid;
begin
  if not exists (select 1 from public.email_sequences where name = 'Consultation & quote follow-up') then
    insert into public.email_sequences (name, description, trigger_type, active)
    values ('Consultation & quote follow-up',
            'Sent to people who submitted a quote request. Stops automatically when the enquiry moves stage or the person opts out.',
            'quote', false)
    returning id into v_seq;

    insert into public.email_sequence_steps (sequence_id, step_order, delay_days, subject, body) values
    (v_seq, 1, 0, 'We''ve received your request, {{first_name}}',
$b$Hi {{first_name}},

Thanks for asking us about automating parts of {{company_name}}. A specialist will review what you sent and come back to you within one working day with initial thoughts.

If it helps to talk it through sooner, you can pick a time that suits you here: {{booking_url}}

Kind regards,
{{sender_name}}
{{agency_name}}$b$),
    (v_seq, 2, 3, 'Three questions that shape your automation quote',
$b$Hi {{first_name}},

When we scope a project, three things drive the cost and the result more than anything else:

1. How enquiries reach you today (phone, web forms, email, social) and roughly how many a month.
2. Which tools you already rely on — calendar, CRM, job management or booking software.
3. What happens when nobody responds quickly — and what a missed enquiry is typically worth to you.

If you reply with rough answers, we can make your quote far more accurate.

Kind regards,
{{sender_name}}
{{agency_name}}$b$),
    (v_seq, 3, 7, 'Shall I close your request?',
$b$Hi {{first_name}},

I don't want to fill your inbox, so this is my last follow-up on your request. If the timing isn't right, no problem at all — just reply "later" and I'll check back in a few months, or ignore this and I'll close it.

{{booking_url}}

Kind regards,
{{sender_name}}
{{agency_name}}$b$);
  end if;

  if not exists (select 1 from public.email_sequences where name = 'Consultation reminder & preparation') then
    insert into public.email_sequences (name, description, trigger_type, active)
    values ('Consultation reminder & preparation',
            'Sent to people who booked a consultation.', 'consultation', false)
    returning id into v_seq;

    insert into public.email_sequence_steps (sequence_id, step_order, delay_days, subject, body) values
    (v_seq, 1, 0, 'Your consultation with {{agency_name}} is booked',
$b$Hi {{first_name}},

Your consultation is confirmed. To get the most from 30 minutes, it helps to have to hand:

• roughly how many enquiries you receive each month and through which channels;
• the software you use for diary, CRM and quotes;
• one or two tasks your team repeats every day that you'd love to stop doing.

If you need to change the time, reply to this email.

Kind regards,
{{sender_name}}
{{agency_name}}$b$);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Outreach templates. Every cold email identifies the sender, explains why the
-- recipient is being contacted, and contains a clear opt-out — per PECR/UK GDPR.
-- Cold email may only be sent to CORPORATE subscribers (Ltd, LLP, PLC, Scottish
-- partnerships, public bodies). Sole traders and non-Scottish partnerships need
-- prior consent. Calls require TPS/CTPS screening.
-- ---------------------------------------------------------------------------
insert into public.outreach_templates (channel, industry, name, subject, body)
select * from (values
-- ROOFING -----------------------------------------------------------------
('email'::public.outreach_channel, 'roofing', 'Roofing — missed calls on the roof',
 'Calls missed while your team is on a roof at {{company_name}}',
$b$Hi {{first_name}},

I'm {{sender_name}} from {{agency_name}}. I'm contacting you because {{company_name}} is listed as a roofing contractor in {{area}}, and we help roofing firms respond to every enquiry — including the ones that come in while the team is up a ladder.

Most roofers we speak to lose jobs not to price, but to speed: the homeowner rings three companies and books whoever calls back first. We set up systems that reply to web and phone enquiries within seconds, collect job details and photos, and book survey visits straight into your diary.

Would a 20-minute call next week be useful to see whether it would work for {{company_name}}?

Kind regards,
{{sender_name}}
{{agency_name}} · {{agency_address}}

You're receiving this one-off business email because your company details are publicly listed. If you'd rather not hear from us, reply "unsubscribe" and we won't contact you again.$b$),
('linkedin'::public.outreach_channel, 'roofing', 'Roofing — LinkedIn connection note', null,
$b$Hi {{first_name}} — I work with UK roofing contractors on making sure no enquiry goes unanswered while the team's on site (instant replies, survey booking, follow-ups). Would be good to connect.$b$),
('phone'::public.outreach_channel, 'roofing', 'Roofing — call script', null,
$b$[Before dialling: confirm number screened against TPS/CTPS within the last 28 days. Record outcome in the prospect record.]

OPENING
"Hi, is that {{first_name}}? It's {{sender_name}} from {{agency_name}}. I'll be brief — have you got a minute, or is now a bad time?"
→ If bad time: "No problem — when's better?" Log callback.

REASON FOR CALL
"We help roofing companies respond to enquiries instantly, even when everyone's on a job. Can I ask — when someone rings or fills in your website form while you're on a roof, what happens to that enquiry?"

DISCOVERY (listen, don't pitch)
• Roughly how many enquiries a week?
• How quickly do you usually get back to them?
• Do you ever hear "we've already gone with someone else"?
• What do you use for your diary or job management?

VALUE
"What we set up replies within seconds, takes the job details and photos, and books the survey into your diary — so you're first back to the customer every time."

CLOSE
"Would it be worth a 20-minute video call where I show you how it'd look for {{company_name}}?" → Book via {{booking_url}}.

OBJECTIONS
"Too expensive" → "Understood. What's an average roofing job worth to you? If it wins one extra job a month, it typically covers itself — but let's check that against your numbers on the call."
"Not interested" → "No problem at all. Would you like me to make sure we don't call again?" → If yes, mark DO NOT CONTACT immediately.$b$),
-- ESTATE AGENTS ------------------------------------------------------------
('email'::public.outreach_channel, 'estate_agents', 'Estate agents — out-of-hours viewings',
 'Out-of-hours viewing requests at {{company_name}}',
$b$Hi {{first_name}},

I'm {{sender_name}} from {{agency_name}}. I'm getting in touch because {{company_name}} is an independent agency in {{area}}, and we help agents capture and qualify enquiries that arrive outside office hours.

A large share of portal and website enquiries land in the evening and at weekends. We set up AI assistants that reply instantly, qualify buyers and tenants (position, budget, mortgage status), and offer viewing slots from your diary — with everything logged in your CRM for the morning.

Open to a short call to see if it fits how {{company_name}} works?

Kind regards,
{{sender_name}}
{{agency_name}} · {{agency_address}}

You're receiving this one-off business email because your company details are publicly listed. Reply "unsubscribe" and we won't contact you again.$b$),
('linkedin'::public.outreach_channel, 'estate_agents', 'Estate agents — LinkedIn connection note', null,
$b$Hi {{first_name}} — I help independent agents reply to portal and website enquiries instantly, qualify applicants and book viewings out of hours. Thought it'd be useful to connect.$b$),
('phone'::public.outreach_channel, 'estate_agents', 'Estate agents — call script', null,
$b$[Before dialling: TPS/CTPS screened? Log outcome after the call.]

"Hi {{first_name}}, it's {{sender_name}} from {{agency_name}}. Have you got a quick minute?"

REASON: "We help independent agents handle enquiries that come in after hours — instant replies, applicant qualification and viewing bookings. How do you currently handle a Rightmove or website enquiry that arrives at 9pm on a Saturday?"

DISCOVERY
• Weekly enquiry volume across sales and lettings?
• Which CRM — Reapit, Alto, Street, Jupix, other?
• How long does qualifying a buyer take your negotiators?

VALUE: "The assistant replies within seconds, asks your qualifying questions, and offers viewing slots — your negotiators start Monday with qualified, booked viewings instead of a pile of emails."

CLOSE: "Worth a 20-minute look at how it'd work with your CRM?" → {{booking_url}}
If they ask not to be contacted: mark DO NOT CONTACT immediately.$b$),
-- DENTAL -------------------------------------------------------------------
('email'::public.outreach_channel, 'dental', 'Dental — new patient enquiries',
 'New patient enquiries at {{company_name}}',
$b$Hi {{first_name}},

I'm {{sender_name}} from {{agency_name}}. I'm contacting {{company_name}} because we help private and mixed dental practices make sure new patient enquiries — especially for implants, Invisalign and cosmetic treatment — are answered and booked quickly.

We set up systems that reply instantly to website and social enquiries, answer the practice's approved FAQs, book consultations, and send reminders that reduce no-shows. Clinical questions are always handed to your team.

Would a short call be useful to see if this could help your front desk?

Kind regards,
{{sender_name}}
{{agency_name}} · {{agency_address}}

You're receiving this one-off business email because your practice details are publicly listed. Reply "unsubscribe" and we won't contact you again.$b$),
('linkedin'::public.outreach_channel, 'dental', 'Dental — LinkedIn connection note', null,
$b$Hi {{first_name}} — I help dental practices answer new-patient enquiries instantly and cut no-shows with automated reminders, without adding front-desk workload. Would be great to connect.$b$),
('phone'::public.outreach_channel, 'dental', 'Dental — call script', null,
$b$[Before dialling: TPS/CTPS screened? Ask for the practice manager. Never discuss patient data.]

"Hi, could I speak to the practice manager? ... Hi {{first_name}}, it's {{sender_name}} from {{agency_name}}. Is now an OK time for a quick question?"

REASON: "We help practices respond instantly to new patient enquiries and reduce no-shows. When a potential implant patient fills in your website form on a Sunday, what happens next?"

DISCOVERY
• New patient enquiries per month? Which treatments?
• Practice management software — Dentally, SOE, R4, other?
• No-show rate and how reminders are sent today?

VALUE: "Enquiries get an immediate, on-brand reply using answers you've approved, and consultations are offered from your diary. Anything clinical goes straight to your team."

CLOSE: "Could we book 20 minutes to look at how it'd fit with your software?" → {{booking_url}}$b$),
-- RECRUITMENT --------------------------------------------------------------
('email'::public.outreach_channel, 'recruitment', 'Recruitment — candidate response time',
 'Candidate and client response times at {{company_name}}',
$b$Hi {{first_name}},

I'm {{sender_name}} from {{agency_name}}. I'm reaching out because {{company_name}} is a recruitment business, and we help agencies take repetitive admin off consultants' desks.

Typical examples: screening and acknowledging applicants instantly, booking interviews against consultant diaries, chasing timesheets and references, and keeping the CRM up to date automatically — so consultants spend their time on calls, not admin.

Would it be worth a 20-minute conversation?

Kind regards,
{{sender_name}}
{{agency_name}} · {{agency_address}}

You're receiving this one-off business email because your company details are publicly listed. Reply "unsubscribe" and we won't contact you again.$b$),
('linkedin'::public.outreach_channel, 'recruitment', 'Recruitment — LinkedIn connection note', null,
$b$Hi {{first_name}} — I build automations for recruitment agencies: instant applicant screening, interview scheduling and CRM updates, so consultants get hours back each week. Happy to connect.$b$),
('phone'::public.outreach_channel, 'recruitment', 'Recruitment — call script', null,
$b$[Before dialling: TPS/CTPS screened? Log outcome.]

"Hi {{first_name}}, {{sender_name}} from {{agency_name}} — do you have two minutes?"

REASON: "We automate the admin around candidates and clients for recruitment agencies. Roughly how many hours a week do your consultants spend on screening, scheduling and CRM updates?"

DISCOVERY
• CRM — Bullhorn, Vincere, JobAdder, other?
• Volume of applications per role?
• Biggest bottleneck: screening, interview scheduling, compliance docs, timesheets?

VALUE: "We connect your job boards, CRM and calendars so applicants are acknowledged and screened instantly and interviews self-book."

CLOSE: "Shall we book a short call to map one workflow together?" → {{booking_url}}$b$),
-- GYMS ---------------------------------------------------------------------
('email'::public.outreach_channel, 'gyms', 'Gyms — trial sign-ups and follow-up',
 'Turning more {{company_name}} enquiries into members',
$b$Hi {{first_name}},

I'm {{sender_name}} from {{agency_name}}. I'm contacting {{company_name}} because we help independent gyms and studios convert more enquiries and trial passes into paying members.

We set up instant replies to website and social enquiries, automatic trial-session booking, and friendly follow-ups after a visit — plus win-back messages to lapsed members who have agreed to hear from you.

Would a quick call be useful?

Kind regards,
{{sender_name}}
{{agency_name}} · {{agency_address}}

You're receiving this one-off business email because your business details are publicly listed. Reply "unsubscribe" and we won't contact you again.$b$),
('linkedin'::public.outreach_channel, 'gyms', 'Gyms — LinkedIn connection note', null,
$b$Hi {{first_name}} — I help independent gyms turn more enquiries and trials into members with instant replies, class/trial booking and follow-ups. Would be good to connect.$b$),
('phone'::public.outreach_channel, 'gyms', 'Gyms — call script', null,
$b$[Before dialling: TPS/CTPS screened? Log outcome.]

"Hi {{first_name}}, it's {{sender_name}} from {{agency_name}}. Got a minute?"

REASON: "We help gyms convert more enquiries into members. When someone asks about membership on Instagram or your website at 10pm, how quickly do they usually hear back?"

DISCOVERY
• Enquiries per month? Trial-to-member conversion?
• Booking/membership software — Glofox, Mindbody, TeamUp, other?
• Do you follow up after a trial session today?

VALUE: "Instant replies, trial booking from your timetable, and a structured follow-up after every visit."

CLOSE: "Could we book 20 minutes to look at your numbers?" → {{booking_url}}$b$),
-- CONSTRUCTION -------------------------------------------------------------
('email'::public.outreach_channel, 'construction', 'Construction — tender & enquiry admin',
 'Enquiry and quote admin at {{company_name}}',
$b$Hi {{first_name}},

I'm {{sender_name}} from {{agency_name}}. I'm getting in touch because {{company_name}} is a construction business in {{area}}, and we help builders and contractors reduce the admin between "new enquiry" and "signed job".

That usually means instant responses to enquiries, collecting project details and drawings up front, booking site visits, chasing quotes that haven't been answered, and keeping everything in one CRM pipeline.

Would a short call to see where it could save your team time be useful?

Kind regards,
{{sender_name}}
{{agency_name}} · {{agency_address}}

You're receiving this one-off business email because your company details are publicly listed. Reply "unsubscribe" and we won't contact you again.$b$),
('linkedin'::public.outreach_channel, 'construction', 'Construction — LinkedIn connection note', null,
$b$Hi {{first_name}} — I help construction firms cut the admin between enquiry and signed job: instant responses, site-visit booking and automatic quote chasing. Thought it'd be worth connecting.$b$),
('phone'::public.outreach_channel, 'construction', 'Construction — call script', null,
$b$[Before dialling: TPS/CTPS screened? Log outcome.]

"Hi {{first_name}}, {{sender_name}} from {{agency_name}}. Is now OK for a quick question?"

REASON: "We help contractors follow up every enquiry and quote automatically. Out of the quotes you send each month, how many get chased up if the client goes quiet?"

DISCOVERY
• Enquiries and quotes per month?
• Software for quotes/jobs — spreadsheets, Fergus, Tradify, Buildertrend, other?
• Who handles enquiries while you're on site?

VALUE: "Every enquiry gets an immediate response and the right questions; site visits book into your diary; unanswered quotes are chased politely on a schedule you choose."

CLOSE: "Worth a 20-minute call?" → {{booking_url}}$b$)
) as v(channel, industry, name, subject, body)
where not exists (select 1 from public.outreach_templates);
