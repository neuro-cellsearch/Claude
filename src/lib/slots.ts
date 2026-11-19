/** Consultation slot generation in UK local time (handles BST/GMT changes). */
export type AvailabilityRule = { weekday: number; start_minute: number; end_minute: number; slot_minutes: number; active?: boolean };

const TZ = "Europe/London";

/** Offset in minutes of Europe/London from UTC at the given instant (0 or 60). */
export function londonOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** Converts a London wall-clock time to a UTC Date. */
export function londonToUtc(year: number, month0: number, day: number, minuteOfDay: number): Date {
  const guess = new Date(Date.UTC(year, month0, day, 0, minuteOfDay));
  const offset = londonOffsetMinutes(guess);
  const candidate = new Date(guess.getTime() - offset * 60000);
  // Re-check in case the guess straddled a DST boundary.
  const offset2 = londonOffsetMinutes(candidate);
  return offset2 === offset ? candidate : new Date(guess.getTime() - offset2 * 60000);
}

export function londonDateParts(at: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { year: Number(get("year")), month0: Number(get("month")) - 1, day: Number(get("day")), weekday: weekdayMap[get("weekday")] };
}

/**
 * Returns available slot start times (ISO, UTC) for the next `days` days,
 * excluding already-booked times and anything within `minNoticeHours`.
 */
export function generateSlots(
  rules: AvailabilityRule[],
  booked: string[],
  now: Date = new Date(),
  days = 14,
  minNoticeHours = 12,
): string[] {
  const bookedSet = new Set(booked.map((b) => new Date(b).toISOString()));
  const earliest = now.getTime() + minNoticeHours * 3600_000;
  const out: string[] = [];
  for (let d = 0; d < days; d++) {
    const dayAnchor = new Date(now.getTime() + d * 86400_000);
    const { year, month0, day, weekday } = londonDateParts(dayAnchor);
    for (const rule of rules) {
      if (rule.active === false || rule.weekday !== weekday) continue;
      for (let m = rule.start_minute; m + rule.slot_minutes <= rule.end_minute; m += rule.slot_minutes) {
        const slot = londonToUtc(year, month0, day, m);
        const iso = slot.toISOString();
        if (slot.getTime() >= earliest && !bookedSet.has(iso)) out.push(iso);
      }
    }
  }
  return Array.from(new Set(out)).sort();
}
