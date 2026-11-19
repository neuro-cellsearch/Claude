import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

/** Append-only audit trail for security-relevant and financial actions. */
export async function audit(
  actorId: string | null,
  action: string,
  entityType?: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
) {
  try {
    await createAdminClient().from("audit_logs").insert({
      actor_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata: metadata ?? null,
    });
  } catch (err) {
    logger.error("audit_write_failed", { action, err });
  }
  logger.info("audit", { actorId, action, entityType, entityId });
}
