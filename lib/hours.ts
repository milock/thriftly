// Pragmatic parser for the common subset of OSM `opening_hours` values that thrift
// stores actually use, e.g. "Mo-Sa 10:00-20:00; Su 10:00-18:00" or "24/7".
// Returns null for anything it can't confidently parse, so callers degrade gracefully.

export type Interval = [number, number]; // minutes from midnight [start, end)
export type Week = Interval[][]; // index 0=Mon … 6=Sun

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1, 2).toLowerCase();

function parseDays(part: string): number[] {
  const out = new Set<number>();
  for (const seg of part.split(",")) {
    const s = seg.trim();
    if (!s) continue;
    const range = s.split("-");
    if (range.length === 2) {
      const a = DAYS.indexOf(cap(range[0].trim()));
      const b = DAYS.indexOf(cap(range[1].trim()));
      if (a < 0 || b < 0) continue;
      for (let i = a; ; i = (i + 1) % 7) {
        out.add(i);
        if (i === b) break;
      }
    } else {
      const a = DAYS.indexOf(cap(s));
      if (a >= 0) out.add(a);
    }
  }
  return [...out];
}

function parseTimes(part: string): Interval[] {
  const out: Interval[] = [];
  for (const seg of part.split(",")) {
    const m = seg.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
    if (!m) continue;
    const start = +m[1] * 60 + +m[2];
    let end = +m[3] * 60 + +m[4];
    if (end === 0) end = 1440; // 24:00 / 00:00 close
    if (end > start) out.push([start, end]);
  }
  return out;
}

export function parseHours(spec?: string | null): Week | null {
  if (!spec) return null;
  const trimmed = spec.trim();
  if (/^24\s*\/\s*7$/.test(trimmed)) {
    return Array.from({ length: 7 }, () => [[0, 1440]] as Interval[]);
  }
  const week: Week = [[], [], [], [], [], [], []];
  let matched = false;
  for (const rule of trimmed.split(";")) {
    const r = rule.trim();
    if (!r || /off|closed|ph\b/i.test(r)) continue;
    const m = r.match(/^([A-Za-z,\s-]+?)\s+(\d{1,2}:\d{2}.*)$/);
    let dayPart: string;
    let timePart: string;
    if (m) {
      dayPart = m[1].trim();
      timePart = m[2].trim();
    } else if (/^\d{1,2}:\d{2}/.test(r)) {
      dayPart = "Mo-Su";
      timePart = r;
    } else {
      continue;
    }
    const days = parseDays(dayPart);
    const intervals = parseTimes(timePart);
    if (!days.length || !intervals.length) continue;
    for (const d of days) {
      week[d].push(...intervals);
      matched = true;
    }
  }
  return matched ? week : null;
}

/** 0=Mon … 6=Sun for a JS Date (whose getDay() is 0=Sun). */
export function osmDay(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function isOpenNow(week: Week | null, now: Date = new Date()): boolean | null {
  if (!week) return null;
  const day = osmDay(now);
  const mins = now.getHours() * 60 + now.getMinutes();
  return week[day].some(([s, e]) => mins >= s && mins < e);
}

function fmtTime(mins: number): string {
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const ampm = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function formatDayHours(intervals: Interval[]): string {
  if (!intervals.length) return "Closed";
  if (intervals.length === 1 && intervals[0][0] === 0 && intervals[0][1] === 1440) return "Open 24 hours";
  return intervals.map(([s, e]) => `${fmtTime(s)} – ${fmtTime(e)}`).join(", ");
}

export function todayHours(week: Week | null, now: Date = new Date()): string | null {
  if (!week) return null;
  return formatDayHours(week[osmDay(now)]);
}

export interface WeekRow {
  day: string;
  hours: string;
  isToday: boolean;
}

export function weeklyRows(week: Week | null, now: Date = new Date()): WeekRow[] {
  if (!week) return [];
  const today = osmDay(now);
  return week.map((intervals, i) => ({
    day: DAY_LABELS[i],
    hours: formatDayHours(intervals),
    isToday: i === today,
  }));
}
