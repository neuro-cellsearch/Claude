/**
 * Returns a same-origin relative path, or the fallback. Rejects protocol-relative
 * (`//host`), backslash variants (`/\host`, which browsers normalise to `//host`),
 * control characters and anything not starting with a single `/`.
 */
export function safeRedirectPath(value: unknown, fallback: string): string {
  if (typeof value !== "string" || value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) return fallback;
  try {
    const u = new URL(value, "http://internal.invalid");
    if (u.origin !== "http://internal.invalid") return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}
