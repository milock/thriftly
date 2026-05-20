// Parses an already-extracted Census Gazetteer national tract file (tab-separated,
// latin1) and splits centroids into per-state JSON files. Run Step 1 first.
// Usage: node scripts/build-centroids.mjs   (override source with GAZ_DIR=/path)
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const SRC_DIR = process.env.GAZ_DIR || "/tmp/gaz_tracts";
const OUT_DIR = "data/tract-centroids";

async function main() {
  const files = await readdir(SRC_DIR);
  const txtName = files.find((f) => f.endsWith(".txt"));
  if (!txtName) {
    throw new Error(`No .txt found in ${SRC_DIR} — download + unzip the gazetteer first (Step 1).`);
  }
  const raw = await readFile(join(SRC_DIR, txtName), "latin1");

  const lines = raw.split(/\r?\n/);
  const header = lines[0].split("\t").map((h) => h.trim());
  const geoidIdx = header.indexOf("GEOID");
  const latIdx = header.indexOf("INTPTLAT");
  const lonIdx = header.indexOf("INTPTLONG");
  if (geoidIdx < 0 || latIdx < 0 || lonIdx < 0) {
    throw new Error(`Unexpected header: ${header.join("|")}`);
  }

  const byState = new Map();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    if (cols.length <= lonIdx) continue;
    const geoid = cols[geoidIdx].trim();
    const lat = parseFloat(cols[latIdx]);
    const lon = parseFloat(cols[lonIdx]);
    if (!geoid || Number.isNaN(lat) || Number.isNaN(lon)) continue;
    const state = geoid.slice(0, 2);
    if (!byState.has(state)) byState.set(state, []);
    byState.get(state).push({ geoid, lat, lon });
  }

  await mkdir(OUT_DIR, { recursive: true });
  for (const [state, arr] of byState) {
    await writeFile(join(OUT_DIR, `${state}.json`), JSON.stringify(arr));
  }
  console.log(`Wrote ${byState.size} state files to ${OUT_DIR}`);
}

main();
