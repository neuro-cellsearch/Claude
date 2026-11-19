export type Service = {
  slug: string;
  key: string;
  name: string;
  short: string;
  headline: string;
  intro: string;
  icon: "phone" | "chat" | "magnet" | "calendar" | "database" | "workflow";
  problems: string[];
  solution: { title: string; body: string }[];
  steps: string[];
  benefits: { title: string; body: string }[];
  integrations: string[];
  availability: string;
  fromPlan: "starter" | "growth" | "premium";
  addOn: string;
  faqs: { q: string; a: string }[];
};

export const SERVICES: Service[] = [
  {
    slug: "ai-receptionist",
    key: "ai_receptionist",
    name: "AI Receptionist",
    short: "Answers calls, handles routine questions and books appointments — then hands over to your team when it matters.",
    headline: "Every call answered. Even at 7pm on a Saturday.",
    intro:
      "A voice assistant that answers your business line when your team can't, using only the answers you approve. It captures the caller's details, books appointments, transfers urgent calls and sends a summary to you instantly.",
    icon: "phone",
    problems: [
      "Calls go to voicemail when the team is on site, with a patient, or out of hours — and most callers never leave a message.",
      "Front-desk staff spend hours on the same questions: opening times, prices, availability, directions.",
      "Callers who don't get through ring the next business on the list.",
    ],
    solution: [
      { title: "Natural voice answering", body: "Answers in a natural, on-brand voice and follows a script and knowledge base you approve line by line." },
      { title: "Details captured, every time", body: "Name, number, reason for calling and urgency are collected and written straight into your CRM or inbox." },
      { title: "Bookings and transfers", body: "Books into your calendar where supported and transfers urgent or complex calls to a named person." },
      { title: "Instant summaries", body: "You receive a text or email summary of every call within seconds, with the caller's request highlighted." },
    ],
    steps: [
      "We map your call types, FAQs, escalation rules and the questions the assistant must never answer.",
      "We configure the voice assistant on a dedicated number or as overflow from your existing line.",
      "We test real call scenarios with you and record every result before anything goes live.",
      "After your approval it goes live, and we review transcripts weekly for the first month.",
    ],
    benefits: [
      { title: "No more missed opportunities", body: "Callers get an answer instead of a voicemail tone." },
      { title: "Calmer front desk", body: "Routine questions are handled so your team can focus on people in front of them." },
      { title: "Full visibility", body: "Every call is logged with a transcript and outcome in your dashboard." },
    ],
    integrations: ["Twilio telephony", "Voice AI platform", "Google Calendar / Outlook", "HubSpot and other CRMs", "SMS and email"],
    availability:
      "Availability depends on your telephony setup. Call forwarding from most UK landlines, VoIP systems and mobiles is supported; some legacy PBX systems need adjustment. We confirm compatibility before you commit.",
    fromPlan: "premium",
    addOn: "Available as an add-on to Growth, priced on expected call volume.",
    faqs: [
      { q: "Will callers know they're speaking to an AI?", a: "Yes. We recommend the assistant introduces itself as a virtual assistant. Being transparent builds trust and is the right thing to do." },
      { q: "What if it doesn't know the answer?", a: "It never improvises on facts. If a question isn't covered by your approved knowledge, it takes a message or transfers the call according to your rules." },
      { q: "How are call costs charged?", a: "Telephony and voice AI usage scale with minutes. Your plan includes an agreed allowance and we show usage transparently in your dashboard." },
    ],
  },
  {
    slug: "ai-website-chatbot",
    key: "ai_chatbot",
    name: "AI Website Chatbot",
    short: "Responds to every website visitor instantly, answers business questions and turns conversations into qualified leads.",
    headline: "Turn website visitors into booked conversations.",
    intro:
      "A chat assistant trained only on your approved business information. It answers questions, asks your qualifying questions, captures contact details and passes complicated enquiries to a human — with the full conversation attached.",
    icon: "chat",
    problems: [
      "Most website visitors leave without filling in a form.",
      "Enquiries arriving in the evening wait until the next working day — by which time they've contacted competitors.",
      "Generic chat widgets either do nothing useful or say things you never approved.",
    ],
    solution: [
      { title: "Grounded in your knowledge", body: "Answers come from the FAQs, services and policies you approve — not from the open internet." },
      { title: "Qualifies as it chats", body: "Asks the questions your team would ask: location, timescale, budget, service needed." },
      { title: "Captures the lead", body: "Collects name, email and phone with consent and sends it straight to your CRM and inbox." },
      { title: "Knows when to hand over", body: "Escalates complaints, complex requests or anything sensitive to a human." },
    ],
    steps: [
      "We gather your FAQs, service information and qualification questions.",
      "We configure the assistant, your brand styling and the escalation rules.",
      "We test conversations against a scripted checklist including edge cases and misuse.",
      "You approve the behaviour, we install one line of code on your site and monitor results.",
    ],
    benefits: [
      { title: "24/7 response", body: "Visitors get an answer in seconds, whatever the time." },
      { title: "Better-qualified leads", body: "Your team receives enquiries with the key facts already gathered." },
      { title: "Safe by design", body: "Guardrails stop the assistant giving prices, promises or advice you haven't approved." },
    ],
    integrations: ["OpenAI", "Any website (one script tag)", "WordPress, Wix, Squarespace, Webflow", "HubSpot and other CRMs", "Email and SMS alerts"],
    availability: "Works on any website where you can add a script tag.",
    fromPlan: "starter",
    addOn: "Basic chatbot included in Starter; advanced qualification included in Growth and above.",
    faqs: [
      { q: "Can it give prices?", a: "Only if you want it to and only the prices you approve. Many clients prefer it to give ranges and book a quote visit." },
      { q: "Is the data GDPR compliant?", a: "Conversations are processed under a data processing agreement, stored in the UK/EU where possible and retained only as long as you specify." },
    ],
  },
  {
    slug: "lead-generation-automation",
    key: "lead_generation",
    name: "Lead Generation Automation",
    short: "Captures enquiries from every channel, scores them and alerts the right person — so no lead goes cold.",
    headline: "Every enquiry captured, scored and followed up.",
    intro:
      "Enquiries arrive from web forms, email, social media and directories. We bring them into one place, score them automatically, send permitted follow-ups and alert you the moment a high-value opportunity arrives.",
    icon: "magnet",
    problems: [
      "Leads are scattered across inboxes, social DMs and directory portals.",
      "Nobody knows which enquiries are worth chasing first.",
      "Follow-up depends on someone remembering to do it.",
    ],
    solution: [
      { title: "One inbox for every lead", body: "Web forms, email parsers and directory notifications flow into a single pipeline." },
      { title: "Automatic scoring", body: "Leads are scored on your criteria — service, location, budget, urgency — so the best are handled first." },
      { title: "Permitted follow-up", body: "People who asked to be contacted receive timely, personal follow-up messages, with opt-out honoured." },
      { title: "Instant owner alerts", body: "High-value enquiries trigger an immediate SMS or email to the right person." },
    ],
    steps: [
      "We audit where your enquiries come from and what happens to them today.",
      "We connect each source to a central pipeline and define your scoring rules.",
      "We write and approve follow-up messages with you.",
      "We test every source end-to-end, then go live after your approval.",
    ],
    benefits: [
      { title: "Faster first response", body: "Respond in minutes, not hours." },
      { title: "Focus on the best leads", body: "Scoring shows your team where to spend time." },
      { title: "Consistent follow-up", body: "No lead is forgotten because someone was busy." },
    ],
    integrations: ["Website forms", "Email parsing", "Facebook & Instagram lead forms", "Checkatrade, Rightmove and other portal notifications", "HubSpot / Pipedrive", "SMS & email"],
    availability: "Directory and portal integrations depend on the notification options each platform provides.",
    fromPlan: "starter",
    addOn: "Single-source capture in Starter; multi-source with scoring in Growth.",
    faqs: [
      { q: "Do you buy or scrape leads for us?", a: "No. We help you capture and convert the enquiries your business already generates. We never scrape personal data or send unsolicited messages on your behalf." },
    ],
  },
  {
    slug: "appointment-booking-automation",
    key: "appointment_booking",
    name: "Appointment Booking Automation",
    short: "Real-time availability, instant confirmations, reminders and easy rescheduling — without the phone tag.",
    headline: "Fill your diary without the back-and-forth.",
    intro:
      "Customers book directly into your real availability. Confirmations and reminders go out automatically, and cancellations or reschedules update your calendar instantly — reducing no-shows and admin.",
    icon: "calendar",
    problems: [
      "Booking a single appointment takes several calls or emails.",
      "No-shows waste hours of paid time every week.",
      "Cancellations leave gaps nobody fills.",
    ],
    solution: [
      { title: "Live availability", body: "Bookings check your real calendar, buffers and working hours." },
      { title: "Confirmations and reminders", body: "Email and SMS confirmations with reminders at the times you choose." },
      { title: "Self-service changes", body: "Customers cancel or reschedule via a secure link; your calendar updates automatically." },
      { title: "Booked from anywhere", body: "Bookings from your chatbot, receptionist, website or follow-up emails all land in one diary." },
    ],
    steps: [
      "We map appointment types, durations, staff and rules.",
      "We connect your calendar or booking system.",
      "We test bookings, reminders, cancellations and reschedules.",
      "After your approval we switch it on and track no-show rates.",
    ],
    benefits: [
      { title: "Fewer no-shows", body: "Timely reminders with easy rescheduling reduce wasted slots." },
      { title: "Less admin", body: "No more phone tag to agree a time." },
      { title: "More bookings", body: "Customers book when they're ready — including evenings and weekends." },
    ],
    integrations: ["Google Calendar", "Microsoft 365 / Outlook", "Calendly", "Cal.com", "Twilio SMS", "Industry booking systems with APIs"],
    availability: "Requires a supported calendar or a booking system with an API or webhook access.",
    fromPlan: "growth",
    addOn: "Included from Growth.",
    faqs: [
      { q: "We already use booking software — do we need to change?", a: "Usually not. If your software has an API or integrations, we connect to it rather than replace it." },
    ],
  },
  {
    slug: "crm-automation",
    key: "crm_automation",
    name: "CRM Automation",
    short: "Customer records created and updated automatically, with follow-up tasks and reporting that's always current.",
    headline: "A CRM that keeps itself up to date.",
    intro:
      "We connect your enquiry channels, calendar and communication tools to your CRM so records are created, updated and progressed automatically — with follow-up tasks and pipeline reports your team can trust.",
    icon: "database",
    problems: [
      "Customer details live in spreadsheets, inboxes and people's heads.",
      "Pipelines are out of date because updating them is manual.",
      "Follow-ups slip because nobody created the task.",
    ],
    solution: [
      { title: "Automatic records", body: "New enquiries create contacts and deals with source and context attached." },
      { title: "Status updates", body: "Bookings, replies and payments move deals through stages automatically." },
      { title: "Follow-up tasks", body: "Tasks are created with due dates whenever a lead needs a human touch." },
      { title: "Live reporting", body: "Dashboards show pipeline value, conversion and response times." },
    ],
    steps: [
      "We review your current CRM (or recommend one) and design your pipeline stages.",
      "We connect lead sources, calendar and email.",
      "We migrate existing data where needed and test every automation rule.",
      "We train your team and go live after approval.",
    ],
    benefits: [
      { title: "Single source of truth", body: "Everyone sees the same, current customer picture." },
      { title: "Nothing falls through", body: "Automatic tasks make follow-up systematic." },
      { title: "Decisions on real data", body: "Know your conversion rates and pipeline value at a glance." },
    ],
    integrations: ["HubSpot", "Pipedrive", "Zoho CRM", "Salesforce", "Industry CRMs with APIs", "Google Sheets"],
    availability: "Requires API access to your CRM. Some CRMs require a paid tier for API or workflow features.",
    fromPlan: "growth",
    addOn: "Standard CRM integration in Growth; advanced multi-pipeline automation in Premium.",
    faqs: [
      { q: "Which CRM do you recommend?", a: "For most small UK businesses HubSpot's free or Starter tier is a cost-effective start. If you already use a CRM, we'll work with it." },
    ],
  },
  {
    slug: "business-workflow-automation",
    key: "workflow_automation",
    name: "Business Workflow Automation",
    short: "Connect your apps and automate repetitive admin: reports, documents, notifications and hand-offs.",
    headline: "Give your team back the hours lost to admin.",
    intro:
      "We identify the repetitive tasks that eat into your week — copying data between systems, chasing documents, compiling reports — and automate them with reliable, monitored workflows.",
    icon: "workflow",
    problems: [
      "Skilled people spend hours copying data between systems.",
      "Reports are assembled manually every week or month.",
      "Documents and approvals get stuck waiting for someone.",
    ],
    solution: [
      { title: "App-to-app integration", body: "Your tools pass data to each other automatically and reliably." },
      { title: "Automated reports", body: "Weekly and monthly reports are generated and delivered on schedule." },
      { title: "Document handling", body: "Incoming documents are sorted, named, filed and the right person is notified." },
      { title: "Smart notifications", body: "The right people are alerted at the right time — and only when it matters." },
    ],
    steps: [
      "We run a workflow audit to find the highest-value tasks to automate.",
      "We design each workflow with error handling and alerts.",
      "We test with real (or anonymised) data and record results.",
      "You approve, we deploy, and we monitor every run.",
    ],
    benefits: [
      { title: "Hours saved weekly", body: "Remove repetitive tasks from skilled people's days." },
      { title: "Fewer errors", body: "Automated transfers don't mistype or forget." },
      { title: "Monitored reliability", body: "Every run is logged and failures alert us immediately." },
    ],
    integrations: ["n8n", "Make", "Google Workspace", "Microsoft 365", "Xero / QuickBooks", "Slack / Teams", "1,000+ apps via APIs"],
    availability: "Any system with an API, webhook, email or file export can usually be automated.",
    fromPlan: "growth",
    addOn: "Workflow count depends on plan; complex workflows quoted individually.",
    faqs: [
      { q: "What if a workflow fails?", a: "Every workflow has error handling. Failures are logged, retried where safe and alert our team so we can fix them — usually before you notice." },
    ],
  },
];

export const SERVICE_BY_KEY = Object.fromEntries(SERVICES.map((s) => [s.key, s]));
export const SERVICE_BY_SLUG = Object.fromEntries(SERVICES.map((s) => [s.slug, s]));
export const SERVICE_OPTIONS = SERVICES.map((s) => ({ value: s.key, label: s.name }));
