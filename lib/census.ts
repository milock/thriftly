import type { TractDemographics } from "@/lib/types";

const BASE = "https://api.census.gov/data/2022/acs/acs5";

// Census uses large negative sentinels for missing/suppressed values.
function num(raw: string | undefined): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  if (Number.isNaN(n) || n <= -666666666) return null;
  return n;
}

type Row = string[];
type Table = Row[];

function geoid(row: Row, sIdx: number, cIdx: number, tIdx: number): string {
  return `${row[sIdx]}${row[cIdx]}${row[tIdx]}`;
}

export function parseAcsDetail(table: Table): Record<string, Omit<TractDemographics, "pctBachelorsPlus">> {
  const [header, ...rows] = table;
  const inc = header.indexOf("B19013_001E");
  const home = header.indexOf("B25077_001E");
  const rent = header.indexOf("B25064_001E");
  const pop = header.indexOf("B01003_001E");
  const s = header.indexOf("state");
  const c = header.indexOf("county");
  const t = header.indexOf("tract");
  const out: Record<string, Omit<TractDemographics, "pctBachelorsPlus">> = {};
  for (const row of rows) {
    const id = geoid(row, s, c, t);
    out[id] = {
      geoid: id,
      medianHouseholdIncome: num(row[inc]),
      medianHomeValue: num(row[home]),
      medianGrossRent: num(row[rent]),
      population: num(row[pop]),
    };
  }
  return out;
}

export function parseAcsSubject(table: Table): Record<string, number | null> {
  const [header, ...rows] = table;
  const pct = header.indexOf("S1501_C02_015E");
  const s = header.indexOf("state");
  const c = header.indexOf("county");
  const t = header.indexOf("tract");
  const out: Record<string, number | null> = {};
  for (const row of rows) out[geoid(row, s, c, t)] = num(row[pct]);
  return out;
}

export async function fetchCountyDemographics(
  stateFips: string, countyFips: string,
): Promise<TractDemographics[]> {
  const key = process.env.CENSUS_API_KEY ? `&key=${process.env.CENSUS_API_KEY}` : "";
  const where = `&for=tract:*&in=state:${stateFips}%20county:${countyFips}`;
  const detailUrl = `${BASE}?get=NAME,B19013_001E,B25077_001E,B25064_001E,B01003_001E${where}${key}`;
  const subjectUrl = `${BASE}/subject?get=NAME,S1501_C02_015E${where}${key}`;

  const opts: RequestInit = { next: { revalidate: 2592000 } }; // 30 days
  const [detailRes, subjectRes] = await Promise.all([fetch(detailUrl, opts), fetch(subjectUrl, opts)]);
  if (!detailRes.ok) throw new Error(`Census detail ${detailRes.status}`);
  if (!subjectRes.ok) throw new Error(`Census subject ${subjectRes.status}`);

  const detail = parseAcsDetail((await detailRes.json()) as Table);
  const subject = parseAcsSubject((await subjectRes.json()) as Table);

  return Object.values(detail).map((d) => ({ ...d, pctBachelorsPlus: subject[d.geoid] ?? null }));
}
