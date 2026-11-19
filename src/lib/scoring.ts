/**
 * Transparent, rules-based lead score (0–100) for inbound enquiries.
 * Deliberately explainable so the owner can see WHY a lead ranks highly.
 */
export type ScoreInput = {
  type: string;
  industry?: string | null;
  budget?: string | null;
  monthlyEnquiries?: string | null;
  services?: string[];
  phone?: string | null;
  company?: string | null;
  message?: string | null;
};

export const TARGET_INDUSTRIES = [
  "roofing", "construction", "estate_agents", "dental", "recruitment", "gyms", "hospitality", "automotive", "professional_services",
];

export function scoreEnquiry(input: ScoreInput): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const add = (n: number, why: string) => {
    score += n;
    reasons.push(`${n > 0 ? "+" : ""}${n} ${why}`);
  };

  if (input.type === "consultation") add(25, "booked a consultation");
  else if (input.type === "quote") add(20, "requested a quote");
  else if (input.type === "proposal") add(30, "accepted/engaged with a proposal");
  else if (input.type === "contact") add(8, "contact form");
  else if (input.type === "chatbot") add(5, "chat assistant");

  if (input.industry && TARGET_INDUSTRIES.includes(input.industry)) add(10, "target industry");

  switch (input.budget) {
    case "over_1500": add(25, "budget £1,500+/month"); break;
    case "750_1500": add(20, "budget £750–1,500/month"); break;
    case "300_750": add(12, "budget £300–750/month"); break;
    case "under_300": add(3, "budget under £300/month"); break;
  }

  switch (input.monthlyEnquiries) {
    case "500_plus": add(15, "500+ enquiries/month"); break;
    case "100_500": add(12, "100–500 enquiries/month"); break;
    case "25_100": add(8, "25–100 enquiries/month"); break;
    case "under_25": add(2, "under 25 enquiries/month"); break;
  }

  const services = input.services?.length ?? 0;
  if (services >= 3) add(10, "interested in 3+ services");
  else if (services > 0) add(5, "specific service interest");

  if (input.phone) add(5, "phone number provided");
  if (input.company) add(5, "company name provided");
  if ((input.message?.trim().length ?? 0) > 80) add(5, "detailed message");

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

/** Rough monthly value estimate from the stated budget band (pence). */
export function estimateMonthlyValue(budget?: string | null): number | null {
  switch (budget) {
    case "over_1500": return 149900;
    case "750_1500": return 79900;
    case "300_750": return 29900;
    case "under_300": return 29900;
    default: return null;
  }
}
