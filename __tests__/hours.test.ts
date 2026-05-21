import { describe, it, expect } from "vitest";
import { parseHours, isOpenNow, todayHours, weeklyRows } from "@/lib/hours";

describe("parseHours", () => {
  it("returns null for empty/unparseable input", () => {
    expect(parseHours(undefined)).toBeNull();
    expect(parseHours("")).toBeNull();
    expect(parseHours("by appointment")).toBeNull();
  });

  it("parses a typical thrift-store schedule", () => {
    const week = parseHours("Mo-Sa 10:00-20:00; Su 10:00-18:00")!;
    expect(week).not.toBeNull();
    expect(week[0]).toEqual([[600, 1200]]); // Monday 10:00-20:00
    expect(week[5]).toEqual([[600, 1200]]); // Saturday
    expect(week[6]).toEqual([[600, 1080]]); // Sunday 10:00-18:00
  });

  it("handles 24/7", () => {
    const week = parseHours("24/7")!;
    expect(week[0]).toEqual([[0, 1440]]);
    expect(week[6]).toEqual([[0, 1440]]);
  });

  it("treats a bare time range as every day", () => {
    const week = parseHours("09:00-17:00")!;
    expect(week[2]).toEqual([[540, 1020]]);
  });
});

describe("isOpenNow", () => {
  const week = parseHours("Mo-Sa 10:00-20:00; Su 10:00-18:00")!;

  it("is open mid-afternoon on a weekday", () => {
    // Wed 2026-05-20 at 14:00
    expect(isOpenNow(week, new Date("2026-05-20T14:00:00"))).toBe(true);
  });

  it("is closed late at night", () => {
    expect(isOpenNow(week, new Date("2026-05-20T23:00:00"))).toBe(false);
  });

  it("returns null when hours are unknown", () => {
    expect(isOpenNow(null)).toBeNull();
  });
});

describe("todayHours / weeklyRows", () => {
  const week = parseHours("Mo-Sa 10:00-20:00; Su 10:00-18:00")!;

  it("formats today's hours in 12-hour time", () => {
    expect(todayHours(week, new Date("2026-05-20T09:00:00"))).toBe("10 AM – 8 PM");
  });

  it("returns 7 rows with exactly one marked today", () => {
    const rows = weeklyRows(week, new Date("2026-05-20T09:00:00"));
    expect(rows).toHaveLength(7);
    expect(rows.filter((r) => r.isToday)).toHaveLength(1);
    expect(rows[6].hours).toBe("10 AM – 6 PM");
  });
});
