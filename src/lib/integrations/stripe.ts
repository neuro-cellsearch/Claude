import "server-only";
import Stripe from "stripe";
import { serverEnv } from "@/lib/env";

let stripe: Stripe | null = null;
export function stripeConfigured() {
  return Boolean(serverEnv("STRIPE_SECRET_KEY"));
}
export function getStripe(): Stripe | null {
  const key = serverEnv("STRIPE_SECRET_KEY");
  if (!key) return null;
  if (!stripe) stripe = new Stripe(key, { maxNetworkRetries: 2, appInfo: { name: "Kairo Systems Platform" } });
  return stripe;
}
