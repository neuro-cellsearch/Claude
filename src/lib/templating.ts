/** Replaces {{variable}} placeholders. Unknown variables are left visible so
 *  they are caught during manual review rather than silently sent blank. */
export function renderTemplate(template: string, vars: Record<string, string | null | undefined>): string {
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (match, key: string) => {
    const v = vars[key];
    return v === undefined || v === null || v === "" ? match : String(v);
  });
}

export function unresolvedPlaceholders(text: string): string[] {
  return Array.from(new Set(Array.from(text.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)).map((m) => m[1])));
}
