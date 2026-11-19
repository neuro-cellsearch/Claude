/** Helpers to bucket timestamped rows into chart-ready series (UK time). */
export function lastNDays(n: number, now = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" });
  const label = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getTime() - (n - 1 - i) * 86400_000);
    return { key: fmt.format(d), label: label.format(d) };
  });
}

export function lastNMonths(n: number, now = new Date()) {
  const out: { key: string; label: string; start: Date; end: Date }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    out.push({
      key: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
      label: start.toLocaleString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }),
      start, end,
    });
  }
  return out;
}

export function dayKey(ts: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date(ts));
}
export function monthKey(ts: string) {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function countBy<T>(rows: T[], key: (r: T) => string) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return m;
}
