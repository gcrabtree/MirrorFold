// Checks pack files with the same cleaners the app uses (extracted from index.html by name).
//
//   node tools/pack.mjs                  checks every pack in packs/ and packs/index.json
//   node tools/pack.mjs my-pack.json     checks one file
//
// A pack passes when every palette, motion, filter and overlay is accepted unchanged. Anything the app would
// refuse or pull back into range is reported, and the exit code is 1.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "index.html"), "utf8");
function grab(name) {
  const m = src.match(new RegExp("function " + name + "\\([^)]*\\)\\{[\\s\\S]*?\\n\\}"));
  if (!m) throw new Error("could not find function " + name + " in index.html");
  return m[0];
}
const NAMES = ["cleanName", "cleanPalette", "cleanMotion", "cleanCode", "cleanFilter", "cleanOverlay", "cleanWorld"];
const { cleanName, cleanPalette, cleanMotion, cleanFilter, cleanOverlay, cleanWorld } = new Function(NAMES.map(grab).join("\n") + "\nreturn {" + NAMES.join(",") + "};")();

const LIB_MAX = 16, MAX_BYTES = 200000;
const KEYS = ["mirrorfold", "name", "author", "palettes", "motions", "filters", "overlays", "worlds", "templates", "sets"];
const CATS = ["world", "palette", "mirrors", "motion", "filter", "overlay", "land"];
let bad = 0;
function fail(file, msg) { console.log("FAIL " + file + ": " + msg); bad++; }

function checkList(file, kind, list, clean) {
  if (list === undefined) return [];
  if (!Array.isArray(list)) { fail(file, kind + "s is not a list"); return []; }
  if (list.length > LIB_MAX) fail(file, "more than " + LIB_MAX + " " + kind + "s");
  const names = [];
  list.forEach((item, i) => {
    const out = clean(item), label = kind + " " + (i + 1) + (item && item.name ? ' "' + item.name + '"' : "");
    if (!out) return fail(file, label + " would be refused (wrong shape, a value that is not a number, or code that breaks the rules)");
    for (const k of Object.keys(item)) if (!(k in out)) fail(file, label + " has an unknown field " + JSON.stringify(k));
    for (const k of Object.keys(out)) if (JSON.stringify(out[k]) !== JSON.stringify(item[k])) fail(file, label + ": " + k + " " + JSON.stringify(item[k]) + " would become " + JSON.stringify(out[k]));
    if (names.includes(out.name)) fail(file, label + " repeats a name");
    names.push(out.name);
  });
  return names;
}

function checkPack(path) {
  const file = basename(path), text = readFileSync(path, "utf8");
  if (text.length > MAX_BYTES) return fail(file, "larger than " + MAX_BYTES + " characters");
  let p;
  try { p = JSON.parse(text); } catch (e) { return fail(file, "not valid JSON: " + e.message); }
  if (!p || typeof p !== "object" || Array.isArray(p)) return fail(file, "not an object");
  const before = bad;
  if (p.mirrorfold !== 1) fail(file, '"mirrorfold" must be 1');
  for (const k of Object.keys(p)) if (!KEYS.includes(k)) fail(file, "unknown field " + JSON.stringify(k));
  for (const k of ["name", "author"]) if (typeof p[k] !== "string" || cleanName(p[k]) !== p[k] || !p[k]) fail(file, JSON.stringify(k) + " must be 1 to 28 plain characters");
  const pals = checkList(file, "palette", p.palettes, cleanPalette);
  const mots = checkList(file, "motion", p.motions, cleanMotion);
  const flts = checkList(file, "filter", p.filters, cleanFilter);
  const ovs = checkList(file, "overlay", p.overlays, cleanOverlay);
  const wls = checkList(file, "world", p.worlds, cleanWorld);
  const tpls = [];
  for (const t of Array.isArray(p.templates) ? p.templates : []) {
    if (!t || typeof t !== "object" || cleanName(t.name) !== t.name || !t.name) { fail(file, "a template has no plain name"); continue; }
    tpls.push(t.name);
    for (const k of Object.keys(t)) if (k !== "name" && !CATS.includes(k)) fail(file, 'template "' + t.name + '" has an unknown field ' + JSON.stringify(k));
    for (const c of CATS) {
      const set = t[c] && t[c].set;
      if (set !== undefined && set !== null && !(Array.isArray(set) && set.every(x => typeof x === "string"))) fail(file, 'template "' + t.name + '": ' + c + ".set must be a list of names");
    }
  }
  for (const s of Array.isArray(p.sets) ? p.sets : []) {
    if (!s || typeof s !== "object" || cleanName(s.name) !== s.name || !s.name) { fail(file, "a set has no plain name"); continue; }
    if (!Array.isArray(s.items)) fail(file, 'set "' + s.name + '" has no items');
  }
  if (bad === before) console.log("ok   " + file + ": " + wls.length + " worlds, " + pals.length + " palettes, " + mots.length + " motions, " + flts.length + " filters, " + ovs.length + " overlays, " + tpls.length + " templates, " + (p.sets || []).length + " sets");
}

const args = process.argv.slice(2);
if (args.length) args.forEach(checkPack);
else {
  const dir = join(root, "packs"), files = readdirSync(dir).filter(f => f.endsWith(".json") && f !== "index.json").sort();
  files.forEach(f => checkPack(join(dir, f)));
  let index = [];
  try { index = JSON.parse(readFileSync(join(dir, "index.json"), "utf8")); } catch (e) { fail("index.json", "not valid JSON"); }
  const listed = index.map(e => e.file);
  for (const e of index) {
    if (!/^[a-z0-9][a-z0-9_-]*\.json$/.test(e.file || "")) fail("index.json", "file name " + JSON.stringify(e.file) + " must be lower-case letters, digits, - and _");
    else if (!files.includes(e.file)) fail("index.json", e.file + " is listed but missing");
    if (!e.name || cleanName(e.name) !== e.name) fail("index.json", "entry for " + e.file + " needs a plain name");
  }
  for (const f of files) if (!listed.includes(f)) fail("index.json", f + " is not listed");
}
console.log(bad ? bad + " problem(s)" : "all packs pass");
process.exit(bad ? 1 : 0);
