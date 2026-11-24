import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRole } from "@/lib/env";
import { logger } from "@/lib/logger";

const memory = new Map<string, { start: number; count: number }>();

function memoryLimit(key: string, limit: number, windowSeconds: number) {
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || now - entry.start > windowSeconds * 1000) {
    memory.set(key, { start: now, count: 1 });
    if (memory.size > 5000) memory.clear();
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

/**
 * Fixed-window rate limiter. Uses Postgres (shared across serverless instances)
 * when available, otherwise an in-memory fallback. Returns true if allowed.
 */
/**
 * IP-keyed limit that is skipped (with a warning) when the client IP is unknown,
 * so a misconfigured proxy can't put every user into one shared bucket and lock
 * the whole site out. Callers must also apply an account/email-keyed limit.
 */
export async function rateLimitByIp(scope: string, ipHash: string | null, limit: number, windowSeconds: number): Promise<boolean> {
  if (!ipHash) {
    logger.warn("rate_limit_ip_unknown", { scope });
    return true;
  }
  return rateLimit(`${scope}:${ipHash}`, limit, windowSeconds);
}

export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  if (!hasServiceRole()) return memoryLimit(key, limit, windowSeconds);
  try {
    const { data, error } = await createAdminClient().rpc("check_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    return data === true;
  } catch (err) {
    logger.warn("rate_limit_db_failed", { err });
    return memoryLimit(key, limit, windowSeconds);
  }
}
