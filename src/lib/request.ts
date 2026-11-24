import "server-only";
import { headers } from "next/headers";

/**
 * Best-effort client IP. Prefers headers that the hosting edge sets and clients
 * cannot spoof (Vercel, Cloudflare, or x-real-ip from your reverse proxy), and only
 * falls back to the first X-Forwarded-For entry. When self-hosting, make sure your
 * proxy sets X-Real-IP and strips client-supplied forwarding headers.
 * IP limits are a coarse layer: security-critical limits are also keyed per account.
 */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return (
    h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null
  );
}
