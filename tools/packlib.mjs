// What the pack tools share: checking a pack with the app's own cleaners, tidying an offered pack, and the gallery's index.
// Used by pack.mjs (the checker), gallery.mjs (writes packs/index.json) and offer.mjs (turns an offered pack into a file).
import { cleanName, cleanAbout, cleanPalette, cleanMotion, cleanFilter, cleanOverlay, cleanWorld, cleanScene } from "../js/packs.js";

export const LIB_MAX = 16, MAX_BYTES = 200000;
export const KEYS = ["mirrorfold", "name", "author", "about", "scene", "palettes", "motions", "filters", "overlays", "worlds", "templates", "sets"];
export const CATS = ["world", "palette", "mirrors", "motion", "filter", "overlay", "land"];
const LISTS = [["world", "worlds", cleanWorld], ["palette", "palettes", cleanPalette], ["motion", "motions", cleanMotion], ["filter", "filters", cleanFilter], ["overlay", "overlays", cleanOverlay]];
// the same value, whatever order its fields were written in
const canon = v => Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v;
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

// Every way the app would refuse or change this pack, as a list of sentences. An empty list means it passes.
export function problems(text) {
  const out = [];
  if (text.length > MAX_BYTES) return ["larger than " + MAX_BYTES + " characters"];
  let p;
  try { p = JSON.parse(text); } catch (e) { return ["not valid JSON: " + e.message]; }
  if (!p || typeof p !== "object" || Array.isArray(p)) return ["not an object"];
  if (p.mirrorfold !== 1) out.push('"mirrorfold" must be 1');
  for (const k of Object.keys(p)) if (!KEYS.includes(k)) out.push("unknown field " + JSON.stringify(k));
  for (const k of ["name", "author"]) if (typeof p[k] !== "string" || cleanName(p[k]) !== p[k] || !p[k]) out.push(JSON.stringify(k) + " must be 1 to 28 plain characters");
  if (p.about !== undefined && (typeof p.about !== "string" || cleanAbout(p.about) !== p.about)) out.push('"about" must be one plain line of at most 160 characters');
  if (p.scene !== undefined && !same(cleanScene(p.scene), p.scene)) out.push('"scene" would be refused or changed (see packs/README.md, Scene)');
  for (const [kind, key, clean] of LISTS) {
    const list = p[key];
    if (list === undefined) continue;
    if (!Array.isArray(list)) { out.push(key + " is not a list"); continue; }
    if (list.length > LIB_MAX) out.push("more than " + LIB_MAX + " " + key);
    const names = [];
    list.forEach((item, i) => {
      const got = clean(item), label = kind + " " + (i + 1) + (item && item.name ? ' "' + item.name + '"' : "");
      if (!got) return out.push(label + " would be refused (wrong shape, a value that is not a number, or code that breaks the rules)");
      for (const k of Object.keys(item)) if (!(k in got)) out.push(label + " has an unknown field " + JSON.stringify(k));
      for (const k of Object.keys(got)) if (!same(got[k], item[k])) out.push(label + ": " + k + " " + JSON.stringify(item[k]) + " would become " + JSON.stringify(got[k]));
      if (names.includes(got.name)) out.push(label + " repeats a name");
      names.push(got.name);
    });
  }
  for (const t of Array.isArray(p.templates) ? p.templates : []) {
    if (!t || typeof t !== "object" || cleanName(t.name) !== t.name || !t.name) { out.push("a template has no plain name"); continue; }
    for (const k of Object.keys(t)) if (k !== "name" && !CATS.includes(k)) out.push('template "' + t.name + '" has an unknown field ' + JSON.stringify(k));
    for (const c of CATS) {
      const set = t[c] && t[c].set;
      if (set !== undefined && set !== null && !(Array.isArray(set) && set.every(x => typeof x === "string"))) out.push('template "' + t.name + '": ' + c + ".set must be a list of names");
    }
  }
  if (p.templates !== undefined && !Array.isArray(p.templates)) out.push("templates is not a list");
  if (p.sets !== undefined && !Array.isArray(p.sets)) out.push("sets is not a list");
  for (const s of Array.isArray(p.sets) ? p.sets : []) {
    if (!s || typeof s !== "object" || cleanName(s.name) !== s.name || !s.name) { out.push("a set has no plain name"); continue; }
    if (!Array.isArray(s.items)) out.push('set "' + s.name + '" has no items');
  }
  return out;
}

// How many of each thing a pack holds.
export function counts(p) {
  const n = k => (Array.isArray(p[k]) ? p[k].length : 0);
  return { worlds: n("worlds"), palettes: n("palettes"), motions: n("motions"), filters: n("filters"), overlays: n("overlays"), templates: n("templates"), sets: n("sets"), scene: p.scene ? 1 : 0 };
}

// One line of packs/index.json: what the gallery shows before the pack itself is fetched.
export function indexEntry(file, p) {
  const e = { file, name: p.name, author: p.author };
  if (p.about) e.about = p.about;
  e.has = counts(p);
  return e;
}
export function indexText(entries) { return "[\n" + entries.map(e => " " + JSON.stringify(e)).join(",\n") + "\n]\n"; }

// A pack as its file is written: one item to a line, so that a change shows as a short difference.
export function packText(p) {
  const lines = [];
  for (const k of KEYS) {
    if (p[k] === undefined) continue;
    if (Array.isArray(p[k])) lines.push(" " + JSON.stringify(k) + ": [" + (p[k].length ? "\n" + p[k].map(x => "  " + JSON.stringify(x)).join(",\n") + "\n ]" : "]"));
    else lines.push(" " + JSON.stringify(k) + ": " + JSON.stringify(p[k]));
  }
  return "{\n" + lines.join(",\n") + "\n}\n";
}

// A template or a set from an offered pack, cut down to the fields the app reads. The app fills in and limits the rest when it loads.
function tidyTemplate(t) {
  if (!t || typeof t !== "object" || !cleanName(t.name)) return null;
  const out = { name: cleanName(t.name) };
  for (const c of CATS) {
    const o = t[c];
    if (!o || typeof o !== "object") continue;
    const q = {};
    if (["off", "keep", "random"].includes(o.mode)) q.mode = o.mode;
    if (typeof o.every === "number" && isFinite(o.every)) q.every = Math.max(4, Math.min(600, o.every));
    if (Array.isArray(o.set)) q.set = o.set.filter(x => typeof x === "string" && x.length <= 40).slice(0, 64);
    if (c === "world" && o.trigger === "sound") q.trigger = "sound";
    if (c === "mirrors" && (o.none === "50" || o.none === "75")) q.none = o.none;
    if (Object.keys(q).length) out[c] = q;
  }
  return out;
}
function tidySet(s) {
  if (!s || typeof s !== "object" || !cleanName(s.name) || !Array.isArray(s.items)) return null;
  const items = s.items.filter(it => it && cleanName(it.tpl)).slice(0, 32)
    .map(it => ({ tpl: cleanName(it.tpl), min: Math.max(0.25, Math.min(120, +it.min || 2)) }));
  return items.length ? { name: cleanName(s.name), order: s.order === "random" ? "random" : "cycle", items } : null;
}

// An offered pack made fit for the gallery: only known fields, every item through its cleaner, the rest dropped.
// Returns the pack and a list of what was dropped. The pack is null if nothing usable is left.
export function tidy(raw, name, author, about) {
  const dropped = [], p = { mirrorfold: 1, name: cleanName(name), author: cleanName(author) };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { pack: null, dropped: ["it is not a pack"] };
  if (cleanAbout(about)) p.about = cleanAbout(about);
  const sc = raw.scene === undefined ? null : cleanScene(raw.scene);
  if (sc) p.scene = sc; else if (raw.scene !== undefined) dropped.push("the scene");
  for (const [kind, key, clean] of LISTS) {
    const seen = [], list = [];
    for (const item of Array.isArray(raw[key]) ? raw[key] : []) {
      const got = clean(item);
      if (!got || seen.includes(got.name) || list.length >= LIB_MAX) { dropped.push(kind + " " + JSON.stringify(cleanName(item && item.name) || "?")); continue; }
      seen.push(got.name); list.push(got);
    }
    if (list.length) p[key] = list;
  }
  const tp = [], st = [];
  for (const t of Array.isArray(raw.templates) ? raw.templates : raw.tpls || []) {
    const got = tidyTemplate(t);
    if (!got || tp.some(x => x.name === got.name) || tp.length >= 32) dropped.push("a template"); else tp.push(got);
  }
  for (const s of Array.isArray(raw.sets) ? raw.sets : []) {
    const got = tidySet(s);
    if (!got || st.some(x => x.name === got.name) || st.length >= 16) dropped.push("a set"); else st.push(got);
  }
  if (tp.length) p.templates = tp;
  if (st.length) p.sets = st;
  const c = counts(p);
  if (!Object.values(c).some(v => v > 0)) return { pack: null, dropped };
  return { pack: p, dropped };
}

// A file name made from a pack's name: lower-case letters, digits and hyphens only.
export function slug(name, fallback) {
  const s = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
  return s || fallback;
}
