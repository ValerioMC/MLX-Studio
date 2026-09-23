import { describe, expect, it } from "vitest";
import { dateGroup, groupByDate, parseServerDate, relativeTime } from "./time";

describe("parseServerDate", () => {
  it("reads zone-less timestamps as UTC", () => {
    expect(parseServerDate("2026-09-23T10:00:00").toISOString()).toBe("2026-09-23T10:00:00.000Z");
  });

  it("reads SQLite's space-separated format as UTC", () => {
    expect(parseServerDate("2026-09-23 10:00:00").toISOString()).toBe("2026-09-23T10:00:00.000Z");
  });

  it("respects an explicit offset", () => {
    expect(parseServerDate("2026-09-23T12:00:00+02:00").toISOString()).toBe("2026-09-23T10:00:00.000Z");
  });
});

describe("dateGroup", () => {
  const now = new Date(2026, 8, 23, 15, 0);

  it.each([
    [new Date(2026, 8, 23, 1, 0), "Today"],
    [new Date(2026, 8, 22, 23, 59), "Yesterday"],
    [new Date(2026, 8, 18, 12, 0), "Previous 7 days"],
    [new Date(2026, 8, 1, 12, 0), "Previous 30 days"],
    [new Date(2026, 5, 1, 12, 0), "Older"],
  ])("buckets %s as %s", (date, group) => {
    expect(dateGroup(date, now)).toBe(group);
  });
});

describe("groupByDate", () => {
  it("keeps display order and drops empty buckets", () => {
    const now = new Date(2026, 8, 23, 15, 0);
    const items = [new Date(2026, 5, 1), new Date(2026, 8, 23, 9), new Date(2026, 8, 23, 8)];

    const groups = groupByDate(items, (d) => d, now);

    expect(groups.map((g) => g.group)).toEqual(["Today", "Older"]);
    expect(groups[0]?.items).toHaveLength(2);
  });
});

describe("relativeTime", () => {
  const now = new Date(2026, 8, 23, 15, 0, 0);

  it("says just now under a minute", () => {
    expect(relativeTime(new Date(2026, 8, 23, 14, 59, 30), now)).toBe("just now");
  });

  it("counts minutes and hours", () => {
    expect(relativeTime(new Date(2026, 8, 23, 14, 50), now)).toBe("10 min ago");
    expect(relativeTime(new Date(2026, 8, 23, 12, 0), now)).toBe("3 h ago");
  });
});
