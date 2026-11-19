import "server-only";
import OpenAI from "openai";
import { serverEnv } from "@/lib/env";

export function openaiConfigured() {
  return Boolean(serverEnv("OPENAI_API_KEY"));
}

export function openaiModel() {
  return serverEnv("OPENAI_MODEL") || "gpt-5-mini";
}

let client: OpenAI | null = null;
export function getOpenAI(): OpenAI | null {
  const key = serverEnv("OPENAI_API_KEY");
  if (!key) return null;
  if (!client) client = new OpenAI({ apiKey: key, timeout: 30000, maxRetries: 1 });
  return client;
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function chatComplete(messages: ChatMessage[], opts: { maxTokens?: number } = {}): Promise<string> {
  const ai = getOpenAI();
  if (!ai) throw new Error("OpenAI is not configured");
  const res = await ai.chat.completions.create({
    model: openaiModel(),
    messages,
    max_completion_tokens: opts.maxTokens ?? 600,
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}
