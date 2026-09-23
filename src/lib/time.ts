/**
 * The sidecar stores UTC timestamps without a zone designator
 * ("2026-09-23T10:00:00"), which `new Date()` would read as local time.
 */
export function parseServerDate(value: string): Date {
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
  return new Date(hasZone ? value : `${value.replace(" ", "T")}Z`);
}

export type DateGroup = "Today" | "Yesterday" | "Previous 7 days" | "Previous 30 days" | "Older";

export const DATE_GROUP_ORDER: readonly DateGroup[] = [
  "Today",
  "Yesterday",
  "Previous 7 days",
  "Previous 30 days",
  "Older",
];

const DAY_MS = 86_400_000;

/** Which recency bucket a date falls in, by calendar day in local time. */
export function dateGroup(date: Date, now: Date = new Date()): DateGroup {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = Math.floor((startOfToday - startOfDay(date)) / DAY_MS);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "Previous 7 days";
  if (days < 30) return "Previous 30 days";
  return "Older";
}

/** Items bucketed by recency, in display order, skipping empty buckets. */
export function groupByDate<T>(
  items: readonly T[],
  dateOf: (item: T) => Date,
  now: Date = new Date(),
): { group: DateGroup; items: T[] }[] {
  const buckets = new Map<DateGroup, T[]>();
  for (const item of items) {
    const group = dateGroup(dateOf(item), now);
    const bucket = buckets.get(group) ?? [];
    bucket.push(item);
    buckets.set(group, bucket);
  }
  return DATE_GROUP_ORDER.flatMap((group) => {
    const bucket = buckets.get(group);
    return bucket ? [{ group, items: bucket }] : [];
  });
}

/** "just now", "4 min ago", "3 h ago", then a short date. */
export function relativeTime(date: Date, now: Date = new Date()): string {
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
