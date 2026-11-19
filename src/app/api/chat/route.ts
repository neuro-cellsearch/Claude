import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpenAI, openaiModel } from "@/lib/integrations/openai";
import { rateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/crypto";
import { createEnquiry } from "@/lib/sales/enquiries";
import { hasServiceRole, site } from "@/lib/env";
import { logger } from "@/lib/logger";
import { SERVICES } from "@/lib/content/services";
import { STATIC_PLANS } from "@/lib/content/plans";
import { gbp } from "@/lib/format";

const body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(1200) })).min(1).max(16),
});

const SYSTEM = `You are the website assistant for Kairo Systems, a UK agency that designs, tests and runs AI automation systems for businesses.
Rules:
- Answer ONLY using the facts below. If you don't know, say so and offer to connect the visitor with the team.
- Be concise (2–4 sentences), warm and professional, British English.
- Never invent client results, statistics, testimonials or guarantees. Pricing depends on integrations, call volumes, AI usage and complexity.
- Do not give legal, financial or medical advice.
- To pass the visitor's details to the team, call capture_lead ONLY after the visitor has typed their name and email AND clearly agreed to be contacted.
Facts:
Services: ${SERVICES.map((s) => `${s.name}: ${s.short}`).join(" | ")}
Plans (ex VAT): ${STATIC_PLANS.filter((p) => p.id !== "enterprise").map((p) => `${p.name} ${gbp(p.setup_fee_pence)} setup + ${gbp(p.monthly_pence)}/month (${p.features.slice(0, 3).join(", ")})`).join(" | ")}. Enterprise: custom quote.
Process: consultation → tailored proposal → onboarding → build → every workflow tested → client approval → go live → monitored. Nothing goes live untested.
Industries: roofing & construction, estate agents, dental, recruitment, gyms, hospitality, automotive, professional services.
Book a free 30-minute consultation at ${site.url}/book or request a quote at ${site.url}/quote.`;

const tools = [
  {
    type: "function" as const,
    function: {
      name: "capture_lead",
      description: "Send the visitor's contact details to the Kairo team. Only call after the visitor explicitly provided name and email and agreed to be contacted.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          company: { type: "string" },
          summary: { type: "string", description: "One-paragraph summary of what they need" },
        },
        required: ["name", "email", "summary"],
      },
    },
  },
];

export async function POST(req: Request) {
  const ai = getOpenAI();
  if (!ai) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ipHash = hashIp(ip);
  if (!(await rateLimit(`chat:${ipHash ?? "unknown"}`, 30, 600))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  try {
    const res = await ai.chat.completions.create({
      model: openaiModel(),
      messages: [{ role: "system", content: SYSTEM }, ...parsed.data.messages],
      tools,
      max_completion_tokens: 500,
    });
    const msg = res.choices[0]?.message;
    const call = msg?.tool_calls?.find((t) => t.type === "function" && t.function.name === "capture_lead");
    if (call && call.type === "function") {
      const args = z
        .object({ name: z.string().min(2).max(120), email: z.string().email().max(254), phone: z.string().max(30).optional(), company: z.string().max(160).optional(), summary: z.string().max(2000) })
        .safeParse(JSON.parse(call.function.arguments || "{}"));
      if (!args.success || !hasServiceRole()) {
        return NextResponse.json({ reply: `I couldn't pass your details on automatically — please use ${site.url}/contact and the team will reply within one working day.` });
      }
      const transcript = parsed.data.messages.map((m) => `${m.role === "user" ? "Visitor" : "Assistant"}: ${m.content}`).join("\n");
      await createEnquiry({
        type: "chatbot", name: args.data.name, email: args.data.email.toLowerCase(), phone: args.data.phone, company: args.data.company,
        message: `${args.data.summary}\n\n--- Chat transcript ---\n${transcript}`.slice(0, 4000), ipHash,
      });
      return NextResponse.json({ reply: `Thanks ${args.data.name.split(" ")[0]} — I've passed your details to the team and someone will be in touch within one working day. You can also book a time directly at ${site.url}/book.`, leadCaptured: true });
    }
    return NextResponse.json({ reply: msg?.content || "Sorry, I didn't catch that. Could you rephrase?" });
  } catch (err) {
    logger.error("chat_failed", { err });
    return NextResponse.json({ error: "upstream_error" }, { status: 502 });
  }
}
