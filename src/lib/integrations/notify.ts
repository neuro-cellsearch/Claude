import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { sendEmail } from "./email";
import { logger } from "@/lib/logger";
import { site } from "@/lib/env";

/** Internal notification: always stored in-app; also emailed when email is configured. */
export async function notifyStaff(title: string, body: string, link?: string) {
  try {
    await createAdminClient().from("notifications").insert({ audience: "staff", title, body, link });
    const to = serverEnv("ADMIN_NOTIFICATION_EMAIL");
    if (to) {
      await sendEmail({
        to,
        subject: `[Kairo] ${title}`,
        text: `${body}${link ? `\n\nOpen: ${site.url}${link}` : ""}`,
        context: "notification",
      });
    }
  } catch (err) {
    logger.error("notify_staff_failed", { err, title });
  }
}

export async function notifyOrganization(organizationId: string, title: string, body: string, link?: string) {
  try {
    await createAdminClient().from("notifications").insert({ audience: "organization", organization_id: organizationId, title, body, link });
  } catch (err) {
    logger.error("notify_org_failed", { err, title });
  }
}
