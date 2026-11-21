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
    expect(isOpenNow(week, new Date("2026-05-20T14:00:00Z"), "UTC")).toBe(true);
  });

  it("is closed late at night", () => {
    expect(isOpenNow(week, new Date("2026-05-20T23:00:00Z"), "UTC")).toBe(false);
  });

  it("returns null when hours are unknown", () => {
    expect(isOpenNow(null)).toBeNull();
  });
});

describe("todayHours / weeklyRows", () => {
  const week = parseHours("Mo-Sa 10:00-20:00; Su 10:00-18:00")!;

  it("formats today's hours in 12-hour time", () => {
    expect(todayHours(week, new Date("2026-05-20T09:00:00Z"), "UTC")).toBe("10 AM – 8 PM");
  });

  it("returns 7 rows with exactly one marked today", () => {
    const rows = weeklyRows(week, new Date("2026-05-20T09:00:00Z"), "UTC");
    expect(rows).toHaveLength(7);
    expect(rows.filter((r) => r.isToday)).toHaveLength(1);
    expect(rows[6].hours).toBe("10 AM – 6 PM");
  });
});


describe("store-local time zones", () => {
  const week = parseHours("Mo-Su 09:00-17:00")!;
  it("evaluates the same instant in the store's zone, not the visitor's", () => {
    const instant = new Date("2026-11-04T16:00:00Z");
    expect(isOpenNow(week, instant, "America/Los_Angeles")).toBe(false);
    expect(isOpenNow(week, instant, "America/New_York")).toBe(true);
  });
  it("accounts for daylight saving transitions", () => {
    const narrow = parseHours("Su 01:00-02:00")!;
    expect(isOpenNow(narrow, new Date("2026-11-01T08:30:00Z"), "America/Los_Angeles")).toBe(true);
    expect(isOpenNow(narrow, new Date("2026-11-01T09:30:00Z"), "America/Los_Angeles")).toBe(true);
    expect(isOpenNow(narrow, new Date("2026-11-01T10:30:00Z"), "America/Los_Angeles")).toBe(false);
  });
  it("uses the store-local date across midnight", () => {
    const sunday = parseHours("Su 16:00-20:00")!;
    expect(isOpenNow(sunday, new Date("2026-11-02T02:00:00Z"), "America/Los_Angeles")).toBe(true);
    expect(isOpenNow(sunday, new Date("2026-11-02T02:00:00Z"), "UTC")).toBe(false);
  });
  it("does not claim live status for unknown or invalid zones", () => {
    expect(isOpenNow(week)).toBeNull();
    expect(isOpenNow(week, new Date(), "Invalid/Zone")).toBeNull();
    expect(todayHours(week)).toBeNull();
    expect(weeklyRows(week).some((row) => row.isToday)).toBe(false);
  });
  it("localizes weekly labels and closed hours", () => {
    const rows = weeklyRows(parseHours("Mo 09:00-17:00"), new Date("2026-11-04T12:00:00Z"), "UTC", "es", { closed: "Cerrado", allDay: "Abierto las 24 horas" });
    expect(rows[0].day).toBe("lun");
    expect(rows[1].hours).toBe("Cerrado");
  });
});
