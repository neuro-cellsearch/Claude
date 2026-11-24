import type { Instrumentation } from "next";

/** Runs once per server instance: report configuration problems loudly at boot. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { checkEnv } = await import("@/lib/env-check");
  const { logger } = await import("@/lib/logger");
  const issues = checkEnv();
  for (const i of issues) (i.level === "error" ? logger.error : logger.warn)("config_issue", { variable: i.variable, message: i.message });
  if (!issues.length) logger.info("config_ok");
}

/** Structured logging for every unhandled server error (Server Components, actions, route handlers). */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { logger } = await import("@/lib/logger");
  const e = err as Error & { digest?: string };
  logger.error("unhandled_request_error", {
    message: e?.message, digest: e?.digest, path: request.path, method: request.method,
    routePath: context.routePath, routeType: context.routeType,
  });
};
