// Writes packs/index.json, the list the app's gallery reads, from the pack files in packs/.
//
//   node tools/gallery.mjs           write it
//   node tools/gallery.mjs --check   say whether it is up to date, and change nothing
//
// Each line holds a pack's file, name, author, the sentence about it and how many of each thing it has, so the app can
// show the gallery without fetching every pack. A pack that does not pass the checker is left out and reported.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { problems, indexEntry, indexText } from "./packlib.mjs";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "packs");
export function buildIndex() {
  const entries = [], skipped = [];
  for (const f of readdirSync(dir).filter(f => f.endsWith(".json") && f !== "index.json").sort()) {
    const text = readFileSync(join(dir, f), "utf8");
    if (!/^[a-z0-9][a-z0-9_-]*\.json$/.test(f) || problems(text).length) { skipped.push(f); continue; }
    entries.push(indexEntry(f, JSON.parse(text)));
  }
  return { text: indexText(entries), entries, skipped };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { text, entries, skipped } = buildIndex(), path = join(dir, "index.json");
  let have = "";
  try { have = readFileSync(path, "utf8"); } catch (e) { }
  skipped.forEach(f => console.log("left out " + f + ": it does not pass node tools/pack.mjs"));
  if (process.argv.includes("--check")) {
    console.log(have === text ? "packs/index.json is up to date" : "packs/index.json is out of date. Run: node tools/gallery.mjs");
    process.exit(have === text && !skipped.length ? 0 : 1);
  }
  if (have !== text) writeFileSync(path, text);
  console.log((have === text ? "no change: " : "wrote packs/index.json: ") + entries.length + " pack" + (entries.length === 1 ? "" : "s"));
  process.exit(skipped.length ? 1 : 0);
}
