import { SERVICE_BY_KEY } from "@/lib/content/services";
import { INDUSTRIES, INDUSTRY_LABEL } from "@/lib/content/industries";

/** Deterministic, template-based proposal copy (works without any AI provider). */
export function draftProposalCopy(input: { company: string | null; industry: string | null; planName: string; message: string | null; services: string[] }) {
  const who = input.company || "your business";
  const ind = INDUSTRIES.find((i) => i.key === input.industry);
  const services = (input.services.length ? input.services : ind?.recommendedServices ?? ["lead_generation", "ai_chatbot"])
    .map((k) => SERVICE_BY_KEY[k]).filter(Boolean);

  const introduction = [
    `Thank you for considering Kairo Systems. This proposal sets out how we'll help ${who} respond to every enquiry quickly, reduce repetitive admin and make sure no opportunity is missed${ind ? ` — built around how ${INDUSTRY_LABEL[ind.key]?.toLowerCase()} businesses actually work` : ""}.`,
    input.message ? `You told us: "${input.message.slice(0, 400)}". The scope below is designed to address that directly.` : `The scope below reflects our consultation and can be adjusted before you accept.`,
  ].join("\n\n");

  const scope = [
    ...services.map((s) => `• ${s.name}: ${s.short}`),
    ...(ind ? ind.automations.slice(0, 2).map((a) => `• ${a.title}: ${a.body}`) : []),
    "• Discovery workshop to confirm processes, escalation rules and success measures",
    "• Configuration in a staging environment, followed by recorded end-to-end testing",
    "• Your review and written approval before any automation goes live",
    "• Client dashboard with leads, appointments, activity and monthly performance reporting",
    "• Ongoing monitoring, optimisation and support as described in your plan",
    "",
    "Assumptions: you will provide approved FAQs and access to the systems listed during onboarding. Usage allowances for AI, SMS and call minutes are set out in the line items; usage above allowance is billed at the agreed rates. All prices exclude VAT.",
  ].join("\n");

  return { introduction, scope };
}
