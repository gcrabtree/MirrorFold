// Checks pack files with the same cleaners the app uses (imported from js/packs.js).
//
//   node tools/pack.mjs                  checks every pack in packs/ and packs/index.json
//   node tools/pack.mjs my-pack.json     checks one file
//
// A pack passes when every palette, motion, filter, overlay, world and scene is accepted unchanged. Anything the app
// would refuse or pull back into range is reported, and the exit code is 1. packs/index.json must be exactly what
// tools/gallery.mjs writes from the pack files.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";
import { problems, counts, indexEntry, indexText } from "./packlib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let bad = 0;
function fail(file, msg) { console.log("FAIL " + file + ": " + msg); bad++; }

function checkPack(path) {
  const file = basename(path), text = readFileSync(path, "utf8"), list = problems(text);
  list.forEach(m => fail(file, m));
  if (list.length) return null;
  const p = JSON.parse(text), c = counts(p);
  console.log("ok   " + file + ": " + c.worlds + " worlds, " + c.palettes + " palettes, " + c.motions + " motions, " + c.filters + " filters, " + c.overlays + " overlays, " + c.templates + " templates, " + c.sets + " sets" + (c.scene ? ", a scene" : ""));
  return p;
}

const args = process.argv.slice(2);
if (args.length) args.forEach(checkPack);
else {
  const dir = join(root, "packs"), files = readdirSync(dir).filter(f => f.endsWith(".json") && f !== "index.json").sort(), entries = [];
  for (const f of files) {
    if (!/^[a-z0-9][a-z0-9_-]*\.json$/.test(f)) { fail(f, "the file name must be lower-case letters, digits, - and _"); continue; }
    const p = checkPack(join(dir, f));
    if (p) entries.push(indexEntry(f, p));
  }
  let have = "";
  try { have = readFileSync(join(dir, "index.json"), "utf8"); } catch (e) { }
  if (!bad && have !== indexText(entries)) fail("index.json", "does not match the pack files. Run: node tools/gallery.mjs");
}
console.log(bad ? bad + " problem(s)" : "all packs pass");
process.exit(bad ? 1 : 0);
