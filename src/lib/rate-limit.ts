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
