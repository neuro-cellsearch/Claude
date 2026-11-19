export type Industry = {
  slug: string;
  key: string;
  name: string;
  short: string;
  headline: string;
  pains: string[];
  automations: { title: string; body: string }[];
  recommendedServices: string[]; // service keys
  recommendedPlan: "starter" | "growth" | "premium";
  integrations: string[];
  compliance?: string;
};

export const INDUSTRIES: Industry[] = [
  {
    slug: "roofing-construction",
    key: "roofing",
    name: "Roofing & Construction",
    short: "Be first back to every homeowner and never lose a job to a missed call.",
    headline: "Win the job by being first to respond — even from the roof.",
    pains: [
      "Calls missed while the team is on site",
      "Quotes sent but never chased",
      "Survey visits arranged by phone tag",
      "Job photos and details collected piecemeal",
    ],
    automations: [
      { title: "Missed-call text back", body: "Anyone whose call goes unanswered receives a text within seconds with a link to share job details and photos." },
      { title: "Survey booking", body: "Homeowners book survey visits into your diary based on area and availability." },
      { title: "Quote chasing", body: "Unanswered quotes are followed up politely on a schedule you set." },
      { title: "Review requests", body: "Completed jobs trigger a review request to happy customers." },
    ],
    recommendedServices: ["ai_receptionist", "lead_generation", "appointment_booking"],
    recommendedPlan: "growth",
    integrations: ["Checkatrade / MyBuilder notifications", "Tradify, Fergus, Jobber", "Google Calendar", "Twilio SMS"],
  },
  {
    slug: "estate-agents",
    key: "estate_agents",
    name: "Estate Agents",
    short: "Answer portal enquiries instantly, qualify applicants and book viewings out of hours.",
    headline: "Qualified viewings booked while the office is closed.",
    pains: ["Portal enquiries arriving evenings and weekends", "Time-consuming applicant qualification", "Viewing arrangements by phone", "Valuation leads not followed up"],
    automations: [
      { title: "Instant enquiry response", body: "Rightmove, Zoopla and website enquiries receive a personalised reply in seconds." },
      { title: "Applicant qualification", body: "Position, budget, mortgage status and timescales captured before a negotiator calls." },
      { title: "Viewing scheduling", body: "Applicants book viewings from available slots; vendors and landlords are notified." },
      { title: "Valuation nurture", body: "Valuation enquiries who asked for information receive helpful follow-ups until they're ready." },
    ],
    recommendedServices: ["ai_chatbot", "lead_generation", "appointment_booking", "crm_automation"],
    recommendedPlan: "growth",
    integrations: ["Reapit, Alto, Street, Jupix (where APIs available)", "Portal email parsing", "Google / Outlook calendars"],
  },
  {
    slug: "dental-practices",
    key: "dental",
    name: "Dental Practices",
    short: "Convert more high-value treatment enquiries and reduce costly no-shows.",
    headline: "More treatment consultations. Fewer empty chairs.",
    pains: ["New-patient enquiries waiting until the morning", "Front desk overwhelmed by routine calls", "No-shows on high-value appointments", "Recalls not followed up"],
    automations: [
      { title: "Treatment enquiry assistant", body: "Answers approved FAQs about implants, aligners and whitening and books consultations." },
      { title: "Smart reminders", body: "Reminders with confirm/reschedule options reduce no-shows." },
      { title: "Overflow call handling", body: "Calls that would ring out are answered, logged and routed." },
      { title: "Clinical escalation", body: "Any clinical or urgent question is passed to the practice team immediately — the assistant never gives clinical advice." },
    ],
    recommendedServices: ["ai_chatbot", "appointment_booking", "ai_receptionist"],
    recommendedPlan: "premium",
    integrations: ["Dentally, SOE, R4 (where integrations are available)", "Twilio SMS", "Google Calendar"],
    compliance: "We never process clinical records. Assistants only handle enquiry and appointment information, and practices remain the data controller.",
  },
  {
    slug: "recruitment-agencies",
    key: "recruitment",
    name: "Recruitment Agencies",
    short: "Screen applicants instantly, automate interview scheduling and keep your CRM current.",
    headline: "Consultants on the phone. Admin on autopilot.",
    pains: ["Hundreds of applications per role", "Interview scheduling back-and-forth", "Chasing references and timesheets", "CRM records out of date"],
    automations: [
      { title: "Applicant acknowledgement & screening", body: "Every applicant is acknowledged and asked your screening questions automatically." },
      { title: "Interview self-scheduling", body: "Shortlisted candidates pick interview slots from consultant diaries." },
      { title: "Compliance chasing", body: "Right-to-work documents, references and timesheets are requested and chased." },
      { title: "CRM sync", body: "Candidate and client activity is logged in your CRM automatically." },
    ],
    recommendedServices: ["workflow_automation", "crm_automation", "appointment_booking"],
    recommendedPlan: "growth",
    integrations: ["Bullhorn, Vincere, JobAdder (API)", "Job boards", "Microsoft 365 / Google"],
  },
  {
    slug: "gyms-fitness",
    key: "gyms",
    name: "Gyms & Fitness",
    short: "Turn enquiries and trial passes into members with instant replies and structured follow-up.",
    headline: "From enquiry to member, automatically.",
    pains: ["Social media enquiries going unanswered", "Trial visitors never followed up", "Class no-shows", "Lapsed members silently leaving"],
    automations: [
      { title: "Instant membership enquiries", body: "Website and social enquiries get immediate answers on pricing, classes and offers." },
      { title: "Trial booking", body: "Prospects book a trial session straight from the conversation." },
      { title: "Post-visit follow-up", body: "Every trial visitor receives a timely, personal follow-up." },
      { title: "Win-back campaigns", body: "Former members who consented to marketing receive tailored offers." },
    ],
    recommendedServices: ["ai_chatbot", "lead_generation", "appointment_booking"],
    recommendedPlan: "starter",
    integrations: ["Glofox, Mindbody, TeamUp (where APIs available)", "Meta lead forms", "Twilio SMS"],
  },
  {
    slug: "restaurants-hospitality",
    key: "hospitality",
    name: "Restaurants & Hospitality",
    short: "Handle reservations, event enquiries and FAQs without tying up your team during service.",
    headline: "Bookings handled. Service uninterrupted.",
    pains: ["Phones ringing during service", "Private event enquiries slow to get a reply", "Repeated questions about menus, allergens and parking", "No-shows on large bookings"],
    automations: [
      { title: "Reservation assistant", body: "Takes or directs bookings and answers approved questions about menus, hours and access." },
      { title: "Event enquiry capture", body: "Group and private-hire enquiries are qualified and sent to the events manager." },
      { title: "Booking reminders", body: "Confirmations and reminders reduce no-shows on larger tables." },
      { title: "Allergen safety", body: "Allergen questions are answered only from your approved information, with a prompt to speak to staff." },
    ],
    recommendedServices: ["ai_receptionist", "ai_chatbot", "appointment_booking"],
    recommendedPlan: "growth",
    integrations: ["OpenTable, ResDiary, SevenRooms (where APIs available)", "Google Business Profile", "Twilio"],
  },
  {
    slug: "automotive",
    key: "automotive",
    name: "Automotive",
    short: "Book services and MOTs, follow up vehicle enquiries and keep the workshop diary full.",
    headline: "A fuller workshop and faster sales follow-up.",
    pains: ["Service and MOT bookings by phone", "Vehicle sales enquiries left overnight", "MOT reminders sent manually", "Part-exchange enquiries not qualified"],
    automations: [
      { title: "Service & MOT booking", body: "Customers book slots online or via the assistant, with reminders before the day." },
      { title: "Sales enquiry response", body: "Vehicle enquiries get an instant reply and a test-drive booking option." },
      { title: "Renewal reminders", body: "Customers who opted in receive MOT and service reminders at the right time." },
      { title: "Part-exchange capture", body: "Registration, mileage and condition captured before a valuation call." },
    ],
    recommendedServices: ["appointment_booking", "lead_generation", "ai_chatbot"],
    recommendedPlan: "growth",
    integrations: ["Garage management systems with APIs", "AutoTrader lead emails", "Twilio SMS"],
  },
  {
    slug: "professional-services",
    key: "professional_services",
    name: "Professional Services",
    short: "Accountants, solicitors and consultancies: faster intake, smarter scheduling, less admin.",
    headline: "Client intake and admin, handled with care.",
    pains: ["New-client enquiries needing triage", "Document collection chasing", "Meeting scheduling across busy diaries", "Repetitive reporting"],
    automations: [
      { title: "Client intake", body: "Enquiries are triaged by service type and urgency, with conflict-check details collected." },
      { title: "Document collection", body: "Clients receive secure requests and reminders for the documents you need." },
      { title: "Consultation scheduling", body: "Prospective clients book introductory meetings with the right person." },
      { title: "Reporting automation", body: "Recurring client reports compiled and distributed automatically." },
    ],
    recommendedServices: ["workflow_automation", "crm_automation", "appointment_booking"],
    recommendedPlan: "growth",
    integrations: ["Microsoft 365", "Xero / QuickBooks", "Practice management software with APIs", "Secure file storage"],
    compliance: "Assistants never give legal or financial advice and escalate any such question to a qualified professional.",
  },
];

export const INDUSTRY_OPTIONS = [
  ...INDUSTRIES.map((i) => ({ value: i.key, label: i.name })),
  { value: "construction", label: "Construction (general)" },
  { value: "other", label: "Other" },
];

export const INDUSTRY_LABEL: Record<string, string> = Object.fromEntries(INDUSTRY_OPTIONS.map((o) => [o.value, o.label]));
