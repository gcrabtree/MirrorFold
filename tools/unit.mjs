// Unit tests for the pieces of pure logic:
//   makeChangeDetector  decides when the music has changed enough to trigger a world change
//   jPick               picks a journey's next option, including the weighted mirror choice
//   devMat, gyroTurn    turn the phone's orientation angles into a head turn for the VR viewer
//   userActive          decides how much the user is steering, so the autopilot can stand back
//   cleanName, cleanPalette, cleanMotion, cleanFilter, cleanCode   check and limit everything read from a pack
//
//   node tools/unit.mjs
// The functions come straight from the app's modules. A module does nothing when it is loaded (its start-up work is in
// init(), which only main.js calls), so they can be loaded here without a page. __dbg is each module's list of every name in it.
import { __dbg as listen } from "../js/listen.js";
import { __dbg as journey } from "../js/journey.js";
import { __dbg as vr } from "../js/vr.js";
import { __dbg as camera } from "../js/camera.js";
import { __dbg as packs } from "../js/packs.js";
import { __dbg as editor } from "../js/editor.js";
import { __dbg as tasteM } from "../js/taste.js";
import { __dbg as stillM } from "../js/still.js";
import { __dbg as targetsM } from "../js/targets.js";
import { __dbg as zoomM } from "../js/zoom.js";
import { __dbg as pictureM } from "../js/picture.js";
import { __dbg as galleryM } from "../js/gallery.js";
import { __dbg as recordM } from "../js/record.js";
import { __dbg as sparkM } from "../js/spark.js";
import { __dbg as flitsM } from "../js/flits.js";
import { __dbg as midiM } from "../js/midi.js";
import { __dbg as songM } from "../js/song.js";
import { __dbg as flightM } from "../js/flightdata.js";
import { __dbg as togetherM } from "../js/together.js";
import { __dbg as doorsM } from "../js/doors.js";
import { __dbg as worldsM } from "../js/worlds.js";
import { __dbg as scoreM } from "../js/scoredata.js";
import { __dbg as hearM } from "../js/scoreanalyse.js";
import { tidy, slug, problems, packText, indexEntry } from "./packlib.mjs";
import { handle, answer, packField } from "./offer.mjs";
const { makeChangeDetector } = listen, { jPick } = journey, { devMat, gyroTurn } = vr, { userActive } = camera;
const { cleanName, cleanPalette, cleanMotion, cleanCode, cleanFilter, cleanOverlay, cleanWorld } = packs, { palFromSimple, palToSimple } = editor;

let failed = 0;
function expect(label, ok, detail) {
  console.log((ok ? "ok   " : "FAIL ") + label + (detail ? "  [" + detail + "]" : ""));
  if (!ok) failed++;
}

// ---- change detector: feed 60 fps of (energy, balance) and record when it fires
function fires(fn, secs) {
  const d = makeChangeDetector(), dt = 1 / 60, out = [];
  for (let i = 0; i < secs * 60; i++) {
    const t = i * dt, [e, b] = fn(t);
    if (d(dt, e * (1 + 0.1 * (Math.random() - 0.5)), b + 0.02 * (Math.random() - 0.5))) out.push(+t.toFixed(1));
  }
  return out;
}
let f;
f = fires(() => [0.4, 0.35], 60);                                   expect("steady song never fires", f.length === 0, f.join());
f = fires(t => [0.3 + 0.2 * Math.max(0, Math.sin(t * 12.6)), 0.35], 60); expect("pumping beat never fires", f.length === 0, f.join());
f = fires(t => [0.15 + 0.35 * Math.min(1, t / 40), 0.35], 60);      expect("slow build never fires", f.length === 0, f.join());
f = fires(t => [t < 20 ? 0.15 : 0.5, t < 20 ? 0.5 : 0.3], 60);      expect("drop at 20 s fires once, promptly", f.length === 1 && f[0] >= 20 && f[0] < 22, f.join());
f = fires(t => [(t > 30 && t < 40) ? 0.12 : 0.5, 0.33], 60);        expect("breakdown fires going in and coming out", f.length === 2, f.join());
f = fires(t => [0.4, t < 25 ? 0.25 : 0.55], 60);                    expect("brighter section at same loudness fires", f.length === 1, f.join());

// ---- weighted mirror pick: "0" is no mirrors
const N = 100000;
function share(none, pool) {
  let cur = pool[0], z = 0;
  for (let i = 0; i < N; i++) { cur = jPick("mirrors", { none }, cur, pool); if (cur === "0") z++; }
  return 100 * z / N;
}
const full = ["0", "3", "4", "6", "8", "12"];
let s;
s = share("even", full); expect("even: none about 1 in 6", Math.abs(s - 16.7) < 1, s.toFixed(1) + "%");
s = share("50", full);   expect("50% none", Math.abs(s - 50) < 1, s.toFixed(1) + "%");
s = share("75", full);   expect("75% none", Math.abs(s - 75) < 1, s.toFixed(1) + "%");
s = share("75", ["0", "6", "12"]); expect("75% none with a reduced option list", Math.abs(s - 75) < 1, s.toFixed(1) + "%");
s = share("75", ["3", "6"]);       expect("weight ignored when none is not an option", s === 0, s.toFixed(1) + "%");

// ---- plain picks never repeat the current option when there is a choice
let cur = "a", repeat = false; const seen = new Set();
for (let i = 0; i < 2000; i++) { const n = jPick("motion", {}, cur, ["a", "b", "c"]); if (n === cur) repeat = true; cur = n; seen.add(n); }
expect("subset pick never repeats and reaches every option", !repeat && seen.size === 3);
expect("single option stays put", jPick("motion", {}, "a", ["a"]) === "a");
expect("empty option list changes nothing", jPick("motion", {}, "a", []) === "a");
{ let back = false; for (let i = 0; i < 500; i++) if (jPick("world", {}, "a", ["a", "b", "c"], "b") !== "c") back = true;
  expect("Journey does not pick the world it just left", !back);
  expect("unless it is the only other one", jPick("world", {}, "a", ["a", "b"], "b") === "b");
  { const jn = (await import("../js/journey.js")).__dbg, src = (await import("node:fs")).readFileSync(new URL("../js/journey.js", import.meta.url), "utf8"), heavy = worldsM.WORLDS.filter(w => w.heavy).map(w => w.id);
    expect("a heavy world is in no built-in template, and Journey leaves it out of a template that takes every world", heavy.length >= 1 && heavy.every(id => !src.includes('"' + id + '"')) && /cfg\.set&&WORLDS\[i\]&&WORLDS\[i\]\.heavy\)return/.test(src) && typeof jn.jPool === "function", heavy.join()); }
  let ch = 0; for (let i = 0; i < 2000; i++) if (jPick("overlay", {}, "Dancer", ["Dancer", "Chorus line", "Dance floor"]) === "Chorus line") ch++;
  expect("Journey reaches for the chorus line far less often than for the other dancers, but does reach for it", ch > 100 && ch < 420, String(ch)); }

// ---- VR viewer head turn: angles are (alpha, beta, gamma, screen rotation) in degrees; the result is in
// screen axes (x right, y up, z toward the viewer), in degrees here for reading
function turn(a, b) {
  return gyroTurn(devMat(...a), devMat(...b)).map(x => x * 180 / Math.PI);
}
function near(v, want) { return v.every((x, i) => Math.abs(x - want[i]) < 1e-6); }
function show(v) { return v.map(x => x.toFixed(2)).join(","); }
let w;
w = turn([30, 0, 0, 0], [40, 0, 0, 0]);       expect("flat phone spun on the table turns about z", near(w, [0, 0, 10]), show(w));
w = turn([20, 50, 0, 0], [20, 60, 0, 0]);     expect("portrait: tipping the top back turns about x", near(w, [10, 0, 0]), show(w));
w = turn([20, 50, 10, 0], [20, 50, 20, 0]);   expect("portrait: turning about the long axis turns about y", near(w, [0, 10, 0]), show(w));
w = turn([20, 50, 10, 90], [20, 50, 20, 90]); expect("landscape: the long axis is now screen x, reversed", near(w, [-10, 0, 0]), show(w));
w = turn([20, 50, 10, -90], [20, 50, 20, -90]); expect("other landscape: the long axis is screen x", near(w, [10, 0, 0]), show(w));
w = turn([20, 50, 0, 90], [20, 60, 0, 90]);   expect("landscape: the short axis is now screen y", near(w, [0, 10, 0]), show(w));
w = turn([0, 0, -89, 0], [180, 180, 89, 0]);  expect("no jump where gamma wraps at 90 degrees", near(w, [0, -2, 0]), show(w));
w = turn([33, -20, 70, 90], [33, -20, 70, 90]); expect("no movement gives no turn", near(w, [0, 0, 0]), show(w));

// ---- user steering: feed a turn rate (radians a second) at 60 fps and read the level
function steer(rateAt, secs) {
  let a = 0; const out = [];
  for (let i = 0; i < secs * 60; i++) { a = userActive(a, rateAt(i / 60), 1 / 60); out.push(a); }
  return out;
}
let u;
u = steer(() => 0.05, 5);                expect("a small tremor does not count as steering", Math.max(...u) === 0);
u = steer(() => 1.0, 1);                 expect("a real turn takes over within a quarter second", u[14] > 0.9, u[14].toFixed(2));
u = steer(t => (t < 1 ? 1.0 : 0), 4);    expect("control comes back gently: half back after about half a second", u[89] > 0.35 && u[89] < 0.65, u[89].toFixed(2));
expect("and nearly all back after three seconds", u[239] < 0.03, u[239].toFixed(3));
u = steer(() => 0.29, 3);                expect("a slow turn counts for half", Math.abs(u[179] - 0.5) < 0.02, u[179].toFixed(2));

// ---- packs: what is read from a pack file is refused or pulled into range
const okPal = { name: "Glacier", a: [0.45, 0.6, 0.7], b: [0.35, 0.35, 0.3], c: [1, 1, 1], d: [0.5, 0.55, 0.6] };
let c;
c = cleanPalette(okPal);                 expect("a good palette passes unchanged", JSON.stringify(c) === JSON.stringify(okPal));
c = cleanPalette({ ...okPal, extra: "x", onload: "alert(1)" }); expect("unknown fields are dropped", Object.keys(c).join() === "name,a,b,c,d");
c = cleanPalette({ ...okPal, a: [5, -5, 0.5], c: [99, 1, 1] }); expect("palette numbers are pulled into range", c.a.join() === "1,0,0.5" && c.c[0] === 3, JSON.stringify(c));
expect("a palette with a missing part is refused", cleanPalette({ name: "x", a: [0, 0, 0], b: [0, 0, 0], c: [1, 1, 1] }) === null);
expect("a palette with a wrong length is refused", cleanPalette({ ...okPal, d: [0, 0] }) === null);
expect("a palette with text for a number is refused", cleanPalette({ ...okPal, a: ["1", 0, 0] }) === null);
expect("a palette with NaN or Infinity is refused", cleanPalette({ ...okPal, b: [NaN, 0, 0] }) === null && cleanPalette({ ...okPal, b: [Infinity, 0, 0] }) === null);
expect("a palette with no name is refused", cleanPalette({ ...okPal, name: "  " }) === null && cleanPalette({ ...okPal, name: 7 }) === null);
expect("things that are not objects are refused", cleanPalette(null) === null && cleanPalette("x") === null && cleanMotion(3) === null);
expect("names are trimmed, flattened and cut to 28", cleanName("  a\n\tb   c  ") === "a b c" && cleanName("x".repeat(99)).length === 28);
c = cleanMotion({ name: "Slow spin", decay: 0.96, zoom: 0.998, rot: 0.006 });
expect("a good motion passes unchanged", JSON.stringify(c) === JSON.stringify({ name: "Slow spin", decay: 0.96, zoom: 0.998, rot: 0.006 }));
c = cleanMotion({ name: "Wild", decay: 1, zoom: 3, rot: 9, swirl: -9, wob: 1, rip: 1, dx: 1, dy: -1, kick: 50, code: "x" });
expect("motion numbers are pulled into range", JSON.stringify(c) === JSON.stringify({ name: "Wild", decay: 0.98, zoom: 1.05, rot: 0.025, swirl: -0.08, wob: 0.006, rip: 0.03, dx: 0.012, dy: -0.012, kick: 1 }), JSON.stringify(c));
expect("trails from a motion always fade", cleanMotion({ name: "x", decay: 1 }).decay < 1);
expect("a motion with text for a number is refused", cleanMotion({ name: "x", zoom: "1" }) === null);

// ---- pack filters: control mixes are limited, and shader code is refused unless it keeps to the rules
c = cleanFilter({ name: "Inked", edge: 0.6, post: 6 });
expect("a good filter mix passes unchanged", JSON.stringify(c) === JSON.stringify({ name: "Inked", edge: 0.6, post: 6 }));
c = cleanFilter({ name: "x", post: 1, mos: 2, edge: 9, fx: 4.4, liq: 1, reviewed: true, prog: {} });
expect("filter numbers are pulled into range and other fields dropped", JSON.stringify(c) === JSON.stringify({ name: "x", edge: 1, post: 3, mos: 8, liq: 0.03, fx: 4 }), JSON.stringify(c));
const good = "float l=luma(col);col=mix(pal(0.15),pal(0.65),l);";
expect("plain filter code passes", cleanCode(good) === good);
expect("a counted loop with a few picture reads passes", cleanCode("vec3 s=vec3(0.0);for(int i=0;i<8;i++){s+=scene(uv+pixel*float(i));}col=s/8.0;") !== null);
expect("gl_FragCoord is allowed", cleanCode("col*=0.8+0.2*cos(gl_FragCoord.y);") !== null);
const refused = {
  "the clock": "col*=step(0.5,fract(uTime*10.0));",
  "the slow hue clock": "col=pal(uHue);",
  "the picture texture by name": "col=texture2D(uT,uv).rgb;",
  "other gl_ names": "col=gl_FragColor.rgb;",
  "a preprocessor line": "#define X uTime\ncol*=X;",
  "a line comment": "col*=0.5; // hi",
  "a block comment": "/* { */ col*=0.5;",
  "a backslash": "col*=0.5;\\\n",
  "closing the function to start another": "} void f(){ col*=0.5;",
  "unbalanced braces": "if(col.r>0.5){col*=0.5;",
  "a while loop": "float i=0.0;while(i<9.0){i+=1.0;}",
  "a loop without a plain count": "for(float t=0.0;t<1.0;t+=0.001){col*=0.999;}",
  "a loop that counts too far": "for(int i=0;i<200;i++){col*=0.999;}",
  "too many picture reads in loops": "for(int i=0;i<8;i++){for(int j=0;j<8;j++){col+=scene(uv)+scene(uv);}}",
  "discard": "if(col.r>0.5)discard;",
  "its own main": "col*=0.5;} void main(){",
  "characters outside plain text": "col*=0.5;\u00e9",
  "more than 2000 characters": "col*=1.0;".repeat(300),
  "something that is not text": 7,
};
for (const [what, code] of Object.entries(refused)) expect("filter code is refused for: " + what, cleanCode(code) === null);
const ovCode = "ln=1.0-smoothstep(0.0,0.01,abs(length(p)-0.2-0.1*beat-0.05*sound(0.3)));hue=0.4+0.1*sin(time);";
c = cleanOverlay({ name: "Loop", sound: "bands", code: ovCode, reviewed: true });
expect("a good overlay passes, and cannot mark itself reviewed", JSON.stringify(c) === JSON.stringify({ name: "Loop", sound: "bands", code: ovCode }));
expect("an overlay without code is refused", cleanOverlay({ name: "x" }) === null);
expect("an overlay with an unknown sound source is refused", cleanOverlay({ name: "x", sound: "mic", code: ovCode }) === null);
const wCode = "float d=length(p)-0.3-0.1*m;for(int i=0;i<8;i++){d=min(d,length(p-0.1*float(i))-0.05);}return d;";
c = cleanWorld({ name: "Balls", period: [2, 2, 99], code: wCode, fog: 9, reviewed: true, de: "alert(1)" });
expect("a world keeps its code, has its numbers kept in range, and loses unknown fields", c && c.code === wCode && c.period[2] === 16 && c.fog === 0.5 && c.speed === 0.7 && !("reviewed" in c) && !("de" in c), JSON.stringify(c));
expect("a world without a period is refused", cleanWorld({ name: "x", code: wCode }) === null);
expect("a world that returns nothing is refused", cleanWorld({ name: "x", period: [2, 2, 2], code: "float d=1.0;" }) === null);
expect("a world whose loops run more than 16 times is refused", cleanWorld({ name: "x", period: [2, 2, 2], code: wCode.replace("i<8", "i<17") }) === null);
expect("a world may not use the clock or the sound", cleanWorld({ name: "x", period: [2, 2, 2], code: "return length(p)-0.3*time;" }) === null && cleanWorld({ name: "x", period: [2, 2, 2], code: "return length(p)-0.3*uTime;" }) === null);
expect("a world may not close its function and start another", cleanWorld({ name: "x", period: [2, 2, 2], code: "return 1.0;} float f(){return 2.0;" }) === null);
expect("a world's name needs a letter", cleanWorld({ name: "123", period: [2, 2, 2], code: wCode }) === null);
expect("overlay code is held to the same rules", cleanOverlay({ name: "x", code: "ln=step(0.5,fract(uTime*9.0));" }) === null);
expect("sound reads in loops are counted", cleanCode("for(int i=0;i<40;i++){ln+=sound(0.1)+sound(0.2);}") === null && cleanCode("for(int i=0;i<16;i++){ln+=sound(float(i)/16.0);}") !== null);
expect("a filter with refused code is refused whole", cleanFilter({ name: "x", edge: 0.5, code: "col*=uTime;" }) === null);

// ---- palette editor: two colours and three settings make a palette, and can be read back from it
const palAt = (q, x) => [0, 1, 2].map(j => q.a[j] + q.b[j] * Math.cos(2 * Math.PI * (q.c[j] * x + q.d[j])));
const closeTo = (u, w, e) => u.every((x, j) => Math.abs(x - w[j]) < e);
let two = palFromSimple({ one: [1, 0.2, 0], two: [0, 0.4, 1], changes: 1, slide: 0, rainbow: 0 });
expect("a two-colour palette starts at the first colour and ends at the second", closeTo(palAt(two, 0), [1, 0.2, 0], 1e-3) && closeTo(palAt(two, 1), [0, 0.4, 1], 1e-3));
expect("a two-colour palette passes the cleaner unchanged", JSON.stringify(cleanPalette({ name: "x", ...two })) === JSON.stringify({ name: "x", ...two }));
let rtBad = 0, rtN = 0;
for (let n = 1; n <= 6; n++) for (const slide of [0, 0.25, 0.5, 0.99]) for (const rainbow of [0, 0.3, 1]) for (const [one, two2] of [[[1, 0.2, 0], [0, 0.4, 1]], [[0, 0, 0], [1, 1, 1]], [[0.8, 0.5, 0.5], [0.1, 0.5, 0.9]]]) {
  const q = palFromSimple({ one, two: two2, changes: n, slide, rainbow }), s = palToSimple(q), q2 = palFromSimple(s);
  rtN++;
  if (!s.exact || s.changes !== n || [0, 0.13, 0.5, 0.77, 1].some(x => !closeTo(palAt(q, x), palAt(q2, x), 0.03))) rtBad++;
}
expect("settings read back from a two-colour palette rebuild the same palette", rtBad === 0, rtBad + " of " + rtN + " differ");
expect("the built-in Spectrum reads as black to white with full rainbow", (s => s.exact && s.changes === 2 && Math.abs(s.rainbow - 1) < 0.03)(palToSimple({ a: [.5, .5, .5], b: [.5, .5, .5], c: [1, 1, 1], d: [0, .33, .67] })));
expect("a palette with unequal waves is reported as not exact", palToSimple({ a: [.5, .5, .5], b: [.5, .5, .5], c: [1, .7, .4], d: [0, .15, .2] }).exact === false);

// ---- likes: weights for Journey's choices
{
  const { tasteOf, tasteNudge, pickWeighted, cleanTaste, TASTE_MIN, TASTE_MAX } = tasteM, w = {};
  expect("an option nobody has judged has weight 1", tasteOf(w, "filter", "Neon") === 1);
  for (let i = 0; i < 20; i++) tasteNudge(w, "filter", "Neon", 1.4);
  expect("liking stops at the upper limit", tasteOf(w, "filter", "Neon") === TASTE_MAX);
  for (let i = 0; i < 40; i++) tasteNudge(w, "filter", "Neon", 0.6);
  expect("disliking stops at the lower limit, above zero", tasteOf(w, "filter", "Neon") === TASTE_MIN && TASTE_MIN > 0);
  tasteNudge(w, "motion", "Melt", 1.4); tasteNudge(w, "motion", "Melt", 1 / 1.4);
  expect("a weight back at 1 is forgotten", !("motion:Melt" in w));
  const n = { a: 0, b: 0, c: 0 }, N = 30000, wt = { a: 4, b: 1, c: 0.2 };
  for (let i = 0; i < N; i++) n[pickWeighted(["a", "b", "c"], x => wt[x], Math.random())]++;
  expect("choices come in proportion to their weights", Math.abs(n.a / N - 4 / 5.2) < 0.02 && Math.abs(n.c / N - 0.2 / 5.2) < 0.01, JSON.stringify(n));
  expect("the least liked option is still chosen sometimes", n.c > 0);
  expect("no options gives nothing", pickWeighted([], () => 1, 0.5) === undefined);
  expect("weights that are all zero fall back to an even choice", pickWeighted(["a", "b"], () => 0, 0.75) === "b");
  const c = cleanTaste({ "filter:Neon": 99, "motion:Melt": -3, "bad key": 2, "world:julia": "2", "palette:x": NaN, "__proto__": 3 });
  expect("stored likes are limited and wrong ones dropped", c["filter:Neon"] === TASTE_MAX && c["motion:Melt"] === TASTE_MIN && Object.keys(c).length === 2, JSON.stringify(c));
  expect("stored likes of the wrong shape give none", Object.keys(cleanTaste([1, 2])).length === 0 && Object.keys(cleanTaste(null)).length === 0);
}
// ---- Hold still: the shifts of the rays
{
  const { halton } = stillM, xs = [], ys = [];
  for (let i = 1; i <= 64; i++) { xs.push(halton(i, 2)); ys.push(halton(i, 3)); }
  const inRange = xs.concat(ys).every(v => v > 0 && v < 1), mean = a => a.reduce((p, q) => p + q, 0) / a.length;
  expect("ray shifts stay inside the pixel", inRange);
  expect("ray shifts average to the middle of the pixel", Math.abs(mean(xs) - 0.5) < 0.02 && Math.abs(mean(ys) - 0.5) < 0.02, mean(xs).toFixed(3) + " " + mean(ys).toFixed(3));
  expect("no two of the first 64 shifts are the same", new Set(xs.map((x, i) => x + "," + ys[i])).size === 64);
}

// ---- Save picture: a pack inside a PNG, and the scene cleaner
{
  const { crc32, pngPut, pngGet, asciiJson } = pictureM, { cleanScene, cleanAbout } = packs;
  const chunk = (type, data) => {
    const b = new Uint8Array(12 + data.length), n = data.length;
    b.set([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255, ...[...type].map(c => c.charCodeAt(0))]); b.set(data, 8);
    const c = crc32(b, 4, 8 + n); b.set([c >>> 24, (c >>> 16) & 255, (c >>> 8) & 255, c & 255], 8 + n); return b;
  };
  const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, ...chunk("IHDR", [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]), ...chunk("IDAT", [1, 2, 3]), ...chunk("IEND", [])]);
  expect("the check number of an empty IEND part is the known one", crc32(png, png.length - 8, png.length - 4) === 0xae426082);
  const text = asciiJson({ name: "Caf\u00e9 \u2603", n: 1 }), out = pngPut(png, "mirrorfold", text);
  expect("text with other alphabets is written in plain ASCII and reads back the same", !/[^\x20-\x7e]/.test(text) && JSON.parse(text).name === "Caf\u00e9 \u2603");
  expect("a picture with a pack put in gives the pack back", out && pngGet(out, "mirrorfold") === text);
  expect("the picture's own parts are untouched", out && out.length === png.length + 12 + 11 + text.length && png.subarray(33).every((v, i) => v === out[out.length - (png.length - 33) + i]));
  expect("a picture with nothing put in gives nothing", pngGet(png, "mirrorfold") === null);
  expect("a file that is not a PNG is refused both ways", pngPut(new Uint8Array(60), "mirrorfold", "x") === null && pngGet(new Uint8Array(60), "mirrorfold") === null);
  expect("text that is not plain ASCII is refused", pngPut(png, "mirrorfold", "caf\u00e9") === null);
  const bad = out.slice(); bad[33] = 255;
  expect("a part that claims to be longer than the file is refused", pngGet(bad, "mirrorfold") === null);
  expect("a pack over the size limit is refused", pngGet(out, "mirrorfold", 5) === null);
  const sc = cleanScene({ spot: "julia-0123456789abcdef", palette: " Ember ", mirrors: 5.6, fx: "trails", land: "alps over", evil: "<img>" });
  expect("a scene keeps only what is known, tidied", JSON.stringify(sc) === JSON.stringify({ spot: "julia-0123456789abcdef", palette: "Ember", mirrors: 6, fx: "trails", land: "alps over" }), JSON.stringify(sc));
  expect("a scene needs a spot of the right shape", cleanScene({ spot: "julia" }) === null && cleanScene({ spot: "javascript:alert(1)-0123456789abcdef" }) === null && cleanScene({}) === null && cleanScene([]) === null);
  expect("a scene with a wrong field is refused", cleanScene({ spot: "julia-0123456789abcdef", fx: "strobe" }) === null && cleanScene({ spot: "julia-0123456789abcdef", land: "http://x over" }) === null && cleanScene({ spot: "julia-0123456789abcdef", mirrors: "6" }) === null);
  expect("a sentence about a pack is one plain line of at most 160 characters", cleanAbout("  two\nlines\t here ") === "two lines here" && cleanAbout("x".repeat(500)).length === 160 && cleanAbout(5) === "");
}

// ---- Detail auto: when it steps, and what it keeps for the next visit
{
  const { detailNext, detailSaved, DWAIT, DWAIT_MAX } = targetsM;
  const s = { slowN: 0, hold: 0, wait: DWAIT, up: false };
  expect("one slow reading does not step down", detailNext(0.05, 1000, s) === null);
  expect("a second in a row does, and nothing goes up until the wait is over", detailNext(0.05, 2000, s) === "down" && detailNext(0.01, 2000 + DWAIT - 1, s) === null);
  expect("a slow reading with an ordinary one between does not step down", (detailNext(0.05, 3000, s), detailNext(0.03, 4000, s), detailNext(0.05, 5000, s)) === null);
  s.slowN = 0;
  expect("after the wait it goes up, roomy when there is a great deal of time", detailNext(0.02, 2001 + DWAIT, s) === "up" && detailNext(0.01, 2002 + DWAIT, s) === "roomy");
  detailNext(0.05, 50000, s); detailNext(0.05, 51000, s);
  expect("a step down that undoes a step up doubles the wait", s.wait === 2 * DWAIT && s.hold === 51000 + 2 * DWAIT);
  for (let i = 0; i < 10; i++) { s.up = true; detailNext(0.05, 0, s); detailNext(0.05, 0, s); }
  expect("the wait stops growing", s.wait === DWAIT_MAX);
  expect("a kept setting is read back", JSON.stringify(detailSaved('{"q":0.6,"landQ":0.7}')) === '{"q":0.6,"landQ":0.7}');
  expect("a kept setting out of range, or not a setting, is ignored", detailSaved('{"q":0.1,"landQ":1}') === null && detailSaved('{"q":0.6,"landQ":0.6}') === null && detailSaved("x") === null && detailSaved(null) === null && detailSaved('{"q":"1","landQ":1}') === null);
}

// ---- Getting ready ahead of need: the order
{
  const { preloadOrder } = (await import("../js/preload.js")).__dbg;
  const o = preloadOrder(5, 2, 4, 1).map(x => x[0][0] + x[1]).join(" ");
  expect("the land in use first, then the other landscapes in the button's order, then the worlds after the one in use", o === "l2 l3 l4 l0 l1 w2 w3 w0", o);
}

// ---- Detail auto: what it gives up, and in what order
{
  const { detailStep } = targetsM;
  const run = (q, lq, land) => { const seen = []; for (let i = 0, st; i < 40 && (st = detailStep(true, false, q, lq, land)); i++) { q = st.q; lq = st.landQ; seen.push(q.toFixed(2) + "/" + lq); } return { q, lq, seen }; };
  const w = run(0.85, 1, false), l = run(0.85, 1, true);
  expect("without the land, sharpness stops at 60% and the land's size is left alone", Math.abs(w.q - 0.6) < 1e-9 && w.lq === 1);
  expect("with the land, sharpness goes to 60%, then the land's picture shrinks, then sharpness goes on to 35%", Math.abs(l.q - 0.35) < 1e-9 && l.lq === 0.5 && l.seen.indexOf("0.60/0.7") >= 0 && l.seen.indexOf("0.60/0.5") === l.seen.indexOf("0.60/0.7") + 1, l.seen.join(" "));
  expect("going back up, the whole picture comes first", detailStep(false, true, 0.5, 0.5, true).landQ === 0.5 && detailStep(false, true, 0.5, 0.5, true).q > 0.5);
  expect("the land's picture grows again only with a great deal of time to spare", detailStep(false, false, 1, 0.5, true) === null && detailStep(false, true, 1, 0.5, true).landQ === 0.7 && detailStep(false, true, 1, 0.7, true).landQ === 1 && detailStep(false, true, 1, 1, true) === null);
}

// ---- the zoom worlds: reference paths, targets, the tour and share links
{
  const { refOrbit, fixedPoint, zoomIter, targetDepth, pilotTo, zoomSpot, zoomFromSpot, zoomEnter, zm, ZTARGETS, JULIAS, REF_W, ZTOP, ZMIN } = zoomM;
  const buf = new Float32Array(REF_W * 2 * 4);
  expect("a point outside the set leaves in a few steps, and the path ends there", (n => n < 8 && buf[4] === 1 && buf[5] === 1 && buf[8] === 1 && buf[9] === 3 && Math.hypot(buf[4 * n - 4], buf[4 * n - 3]) > 16 && Math.hypot(buf[4 * n - 8], buf[4 * n - 7]) <= 16)(refOrbit(buf, 0, 0, 0, 1, 1)));
  expect("a point inside the set fills the whole path", refOrbit(buf, 1, 0, 0, -0.1, 0.1) === REF_W && Math.hypot(buf[REF_W * 4 + 4 * 1000], buf[REF_W * 4 + 4 * 1000 + 1]) < 1);
  const misi = t => { let x = 0, y = 0; const seen = []; for (let i = 0; i < 40; i++) { const nx = x * x - y * y + t.x; y = 2 * x * y + t.y; x = nx; seen.push([x, y]); } return seen; };
  expect("every Mandelbrot target but the small copy lands on a cycle: its path stays put or repeats", ZTARGETS.filter(t => t.d < 0.01).every(t => { const o = misi(t); for (let n = 0; n < 27; n++) for (let p = 1; p <= 3; p++) if (Math.hypot(o[n + p][0] - o[n][0], o[n + p][1] - o[n][1]) < 1e-9) return true; return false; }));
  expect("no two targets are the same place, and a share link has a number for each", ZTARGETS.length <= 35 && ZTARGETS.every((t, i) => ZTARGETS.every((u, j) => i === j || Math.hypot(t.x - u.x, t.y - u.y) > 1e-3)));
  expect("every target stays on its path for the whole of it (it is in the set)", ZTARGETS.every(t => misi(t).slice(0, 30).every(q => Math.hypot(q[0], q[1]) < 2.01)));
  expect("a Julia set's chosen point maps to itself and pushes away", JULIAS.every(c => { const f = fixedPoint(c[0], c[1]); return Math.hypot(f[0] * f[0] - f[1] * f[1] + c[0] - f[0], 2 * f[0] * f[1] + c[1] - f[1]) < 1e-12 && 2 * Math.hypot(f[0], f[1]) > 1.04; }));
  expect("more steps are taken as the view shrinks, up to the device's limit", zoomIter(ZTOP, 1024, false) === 150 && zoomIter(1e-4, 1024, false) > zoomIter(1e-2, 1024, false) && zoomIter(1e-12, 1024, false) === 1024 && zoomIter(1e-12, 384, false) === 384);
  expect("a device given fewer steps is not taken as deep", targetDepth(ZTARGETS[1], 384) > targetDepth(ZTARGETS[1], 1024) && targetDepth(ZTARGETS[7], 1024) === 0.03);
  const z = { x: -0.6, y: 0, s: 1.5 }, t = ZTARGETS[0]; let steps = 0, minS = 9;
  while (!pilotTo(z, t.x, t.y, 1e-11, 1 / 60, 0.45) && steps < 20000) { steps++; }
  expect("the tour reaches a target exactly, and at the size asked for", z.x === t.x && z.y === t.y && z.s === 1e-11 && steps < 20000, steps + " " + JSON.stringify(z));
  const z2 = { x: t.x, y: t.y, s: 1e-9 }, t2 = ZTARGETS[2]; let grew = false, off = false; steps = 0;
  while (!pilotTo(z2, t2.x, t2.y, 1e-9, 1 / 60, 0.45) && steps < 40000) { steps++; if (z2.s > 0.5) grew = true; if (grew && z2.s < 1e-3 && Math.hypot(t2.x - z2.x, t2.y - z2.y) > z2.s) off = true; }
  expect("going from one target to another, the view backs out first and never loses the new one off the picture on the way in", grew && !off && z2.x === t2.x && z2.s === 1e-9, steps + " " + grew + " " + off);
  const mw = { flat: true }, jw = { flat: true, julia: true };
  zoomEnter(mw); zm.x = ZTARGETS[1].x; zm.y = -ZTARGETS[1].y; zm.s = 3e-8; zm.rot = 1;
  const sp = zoomSpot(mw); zoomEnter(mw); zoomFromSpot(mw, sp);
  expect("a link to a target comes back to exactly that place", sp.length === 14 && /^[0-9a-z]+$/.test(sp) && zm.x === ZTARGETS[1].x && zm.y === -ZTARGETS[1].y && Math.abs(Math.log10(zm.s / 3e-8)) < 0.01 && Math.abs(zm.rot - 1) < 0.2, sp + " " + JSON.stringify(zm));
  const last = ZTARGETS[ZTARGETS.length - 1]; zoomEnter(mw); zm.x = last.x; zm.y = -last.y; zm.s = 1e-6; const spL = zoomSpot(mw); zoomEnter(mw); zoomFromSpot(mw, spL);
  expect("the last target in the list comes back too, mirrored", zm.x === last.x && zm.y === -last.y, spL);
  zoomEnter(mw); zoomFromSpot(mw, "k" + sp.slice(1, 13) + "0");
  expect("a link of the first form, which marked a mirrored target by adding 18, still opens", zm.x === ZTARGETS[1].x && zm.y === -ZTARGETS[1].y, JSON.stringify(zm));
  {
    const { interest, centreOn, patternPick, PATTERNS } = zoomM;
    expect("the tour picks cells, stripes or none, and never the setting that means it picks", [0, 0.44, 0.46, 0.79, 0.81, 0.999].map(patternPick).join() === "1,1,2,2,3,3" && PATTERNS[1] === "cells" && PATTERNS[2] === "stripes" && PATTERNS[3] === "none");
    const c = interest(0.9, 0, 0.8, 0, 1, 1, false, 0, 0, 200), flat = interest(1.5, 1.5, 1e-3, 0, 1, 1, false, 0, 0, 200);
    expect("the busy part of a view with the set on its left is to the left, and a view of plain colour is not busy", c[0] < -0.2 && Math.abs(c[1]) < 0.05 && c[2] > flat[2] * 20, JSON.stringify([c, flat]));
    const turned = interest(0.9, 0, 0.8, Math.PI / 2, 1, 1, false, 0, 0, 200);
    expect("it is measured on the picture as shown: with the view turned a quarter, the set is below or above, not left", Math.abs(turned[0]) < 0.05 && Math.abs(turned[1]) > 0.2, JSON.stringify(turned));
    const z = { rot: 0.7, ox: 0, oy: 0 }; for (let i = 0; i < 200; i++) centreOn(z, 1, -1, 0.2, 0.6, 1.6);
    const tu = -(Math.cos(0.7) * z.ox + Math.sin(0.7) * z.oy), tv = -(-Math.sin(0.7) * z.ox + Math.cos(0.7) * z.oy);
    expect("however hard the picture is pulled, the point being zoomed on stays on it", Math.abs(tu) <= 0.75 * 0.6 + 1e-9 && Math.abs(tv) <= 0.75 * 1.6 + 1e-9 && Math.abs(tu) > 0.4, tu + " " + tv);
    expect("which point of a Julia set is zoomed on is decided by the constant before the sound moved it", JULIAS.every(k => { const f = fixedPoint(k[0] + 0.02, k[1] - 0.02, k[0], k[1]), g = fixedPoint(k[0], k[1]); return Math.hypot(f[0] - g[0], f[1] - g[1]) < Math.hypot(f[0] - 1 + g[0], f[1] + g[1]); }));
    zoomEnter(mw); zm.x = ZTARGETS[4].x; zm.y = ZTARGETS[4].y; zm.s = 1e-5; zm.ox = 0.31; zm.oy = -0.52; const so = zoomSpot(mw); zoomEnter(mw); zoomFromSpot(mw, so);
    expect("a link to a target keeps how far the picture's middle is from it", zm.x === ZTARGETS[4].x && Math.abs(zm.ox - 0.31) < 1e-4 && Math.abs(zm.oy + 0.52) < 1e-4, so + " " + JSON.stringify(zm));
  }
  zoomEnter(mw); zm.x = -0.7453; zm.y = 0.1127; zm.s = 1e-7; const sp2 = zoomSpot(mw); zoomFromSpot(mw, sp2);
  expect("a link to anywhere else comes back near it, and no deeper than it can be trusted", Math.hypot(zm.x + 0.7453, zm.y - 0.1127) < 1e-5 && zm.s === 1e-3, JSON.stringify(zm));
  zoomEnter(jw); const c0 = [zm.jx, zm.jy], f = fixedPoint(zm.jx, zm.jy); zm.x = f[0]; zm.y = f[1]; zm.s = 1e-5; const sp3 = zoomSpot(jw); zoomEnter(jw); zoomFromSpot(jw, sp3);
  expect("a Julia link keeps which set it was and the fixed point", zm.jx === c0[0] && zm.jy === c0[1] && zm.x === f[0] && zm.y === f[1] && Math.abs(Math.log10(zm.s / 1e-5)) < 0.01, JSON.stringify(zm));
  zoomFromSpot(mw, "zzzzzzzzzzzzzz");
  expect("a nonsense link still leaves a view inside the limits", Math.abs(zm.x) <= 3 && Math.abs(zm.y) <= 3 && zm.s >= ZMIN && zm.s <= 2 * ZTOP, JSON.stringify(zm));
}

// ---- the gallery: its list, the offer form's address, and the script that takes an offered pack
{
  const { cleanEntry, offerUrl } = galleryM;
  const e = cleanEntry({ file: "evenings.json", name: " Evenings ", author: "x", about: "a\nb", has: { templates: 4, sets: 1, worlds: -2, scene: "1", filters: 1e9 } });
  expect("a gallery line is tidied and its numbers limited", e && e.name === "Evenings" && e.about === "a b" && e.has.templates === 4 && e.has.worlds === 0 && e.has.scene === 0 && e.has.filters === 0, JSON.stringify(e));
  expect("a gallery line may only name a plain file in the packs folder", ["../x.json", "a/b.json", "http://x/y.json", "X.json", "x.js", ""].every(f => cleanEntry({ file: f, name: "n" }) === null));
  expect("a gallery line needs a name", cleanEntry({ file: "a.json" }) === null && cleanEntry(null) === null);
  const u = offerUrl("https://github.com/a/b", '{"x":"& #"}', 6000), long = offerUrl("https://github.com/a/b", "x".repeat(7000), 6000);
  expect("the offer form's address carries the pack, safely encoded", u.filled && u.url.endsWith("&pack=%7B%22x%22%3A%22%26%20%23%22%7D") && u.url.startsWith("https://github.com/a/b/issues/new?template=pack.yml"));
  expect("a pack too long for an address is left out of it", !long.filled && long.url.length < 200);

  const starter = { mirrorfold: 1, palettes: [{ name: "Glacier", a: [9, 0.6, 0.7], b: [0.35, 0.35, 0.3], c: [1, 1, 1], d: [0.5, 0.55, 0.6] }, { name: "Glacier", a: [0, 0, 0], b: [0, 0, 0], c: [0, 0, 0], d: [0, 0, 0] }],
    filters: [{ name: "Bad", code: "while(true){}" }], templates: [{ name: "T", world: { mode: "random", every: 1, set: ["julia", 5], junk: 1 }, junk: 2 }], sets: [{ name: "S", items: [{ tpl: "T", min: 999 }] }], junk: "<script>" };
  const t = tidy(starter, " My pack ", "me", "about it");
  expect("an offered pack is cut down to what the app would take", t.pack && t.pack.palettes.length === 1 && t.pack.palettes[0].a[0] === 1 && !t.pack.filters && !("junk" in t.pack) && t.pack.templates[0].world.every === 4 && t.pack.templates[0].world.set.join() === "julia" && !("junk" in t.pack.templates[0]) && t.pack.sets[0].items[0].min === 120, JSON.stringify(t.pack));
  expect("what was dropped from an offered pack is listed", t.dropped.length === 2, t.dropped.join());
  expect("a tidied pack passes the checker", problems(packText(t.pack)).length === 0, problems(packText(t.pack)).join("; "));
  expect("a pack with nothing usable is refused", tidy({ filters: [{ name: "Bad", code: "discard;" }] }, "n", "a", "").pack === null && tidy("x", "n", "a", "").pack === null);
  expect("a file name is made of lower-case letters, digits and hyphens only", slug("Glass & Rust!! $(rm -rf /)", "p") === "glass-rust-rm-rf" && slug("../../etc", "p") === "etc" && slug("!!!", "pack-3") === "pack-3" && /^[a-z0-9-]+$/.test(slug("x".repeat(90) + " y", "p")));
  expect("the gallery's line for a pack counts what is in it", indexEntry("a.json", t.pack).has.templates === 1 && indexEntry("a.json", t.pack).has.scene === 0);
  const body = (n, w, a, p) => "### Pack name\n\n" + n + "\n\n### Your name\n\n" + w + "\n\n### About it\n\n" + a + "\n\n### The pack\n\n```json\n" + p + "\n```\n\n### Before you send\n\n- [X] ok\n";
  const b = body("Mine", "_No response_", "hello", JSON.stringify(starter));
  expect("the form's answers are found under their headings", answer(b, "pack name") === "Mine" && answer(b, "about") === "hello" && JSON.parse(packField(b)).mirrorfold === 1);
  const good = handle({ number: 7, body: b, user: { login: "octo" } }, () => false);
  expect("an offered pack that passes gets a file name and the author's GitHub name", good.ok && good.file === "mine.json" && JSON.parse(good.text).author === "octo" && problems(good.text).length === 0);
  expect("a file name already in use gets the issue number added", handle({ number: 7, body: b, user: { login: "octo" } }, () => true).file === "mine-7.json");
  const hostile = handle({ number: 8, body: body("@everyone `x` [a](http://b)", "me", "", JSON.stringify({ palettes: [{ name: "@team <b>", a: 1 }] })), user: { login: "o" } }, () => false);
  expect("a refusal quotes the issue's text only as plain text", !hostile.ok && !/(^|[^\\])[@<`\[]/.test(hostile.comment.split("\n")[0].replace("**Offer what is ticked**", "")), hostile.comment.split("\n")[0]);
  // offering only what is ticked
  const { offerPick, packNames, cleanFrom, offerSummary } = galleryM;
  const mine = [
    { kind: "worlds", key: "cage", item: { name: "Cage" }, label: "World: Cage" },
    { kind: "palettes", key: "Rust", item: { name: "Rust" }, label: "Palette: Rust" },
    { kind: "palettes", key: "Moss", item: { name: "Moss" }, label: "Palette: Moss" },
    { kind: "motions", key: "Tide", item: { name: "Tide" }, label: "Motion: Tide" },
    { kind: "templates", key: "T1", item: { name: "T1", palette: { mode: "random", set: ["Rust", "Ember"] }, world: { mode: "random", set: ["julia", "cage"] }, motion: { mode: "off", set: null } }, label: "Journey template: T1" },
    { kind: "templates", key: "T2", item: { name: "T2", palette: { mode: "random", set: null } }, label: "Journey template: T2" },
    { kind: "sets", key: "S", item: { name: "S", items: [{ tpl: "T1", min: 2 }, { tpl: "Classic", min: 2 }] }, label: "Journey set: S" },
    { kind: "scene", key: "now", item: { spot: "cage-abc", palette: "Moss", motion: "Melt" }, label: "The scene" }
  ];
  const one = offerPick(mine, [2]);
  expect("offering one thing sends that thing and nothing else", JSON.stringify(one.pack) === JSON.stringify({ mirrorfold: 1, name: "My Mirrorfold pack", author: "", palettes: [{ name: "Moss" }] }) && one.extra.length === 0, JSON.stringify(one));
  const viaSet = offerPick(mine, [6]);
  expect("a set brings its templates, and they bring what they name", viaSet.pack.sets.length === 1 && viaSet.pack.templates.length === 1 && viaSet.pack.templates[0].name === "T1" && viaSet.pack.palettes.length === 1 && viaSet.pack.palettes[0].name === "Rust" && viaSet.pack.worlds.length === 1 && !viaSet.pack.motions && !viaSet.pack.scene, JSON.stringify(viaSet.pack));
  expect("what came along is named, and what was ticked is not", viaSet.extra.join() === "World: Cage,Palette: Rust,Journey template: T1" && offerPick(mine, [1, 4]).extra.join() === "World: Cage");
  expect("a template that may use anything brings nothing", Object.keys(offerPick(mine, [5]).pack).join() === "mirrorfold,name,author,templates");
  const sc = offerPick(mine, [7]);
  expect("the scene brings its world and its look", sc.pack.scene.spot === "cage-abc" && sc.pack.worlds.length === 1 && sc.pack.palettes[0].name === "Moss" && !sc.pack.motions && offerSummary(sc.pack) === "1 world and 1 palette, and the scene", offerSummary(sc.pack));
  expect("nothing ticked, or a tick on nothing, makes an empty pack", Object.keys(offerPick(mine, []).pack).length === 3 && Object.keys(offerPick(mine, [99]).pack).length === 3);
  expect("the names in a gallery pack are noted by kind", packNames(JSON.stringify({ palettes: [{ name: " Glacier " }, { a: 1 }, null], templates: [{ name: "Tour" }], junk: [{ name: "x" }] })).join("|") === "palettes: Glacier |palettes:Glacier|templates:Tour" && packNames("{nope").length === 0);
  expect("the stored note of what came from the gallery is kept only if it is a list of short strings", cleanFrom(["palettes:A", 3, null, "x".repeat(50), "nocolon"]).join() === "palettes:A" && cleanFrom({ a: 1 }).length === 0 && cleanFrom(Array(2000).fill("p:a")).length === 600);
  expect("an empty or broken pack box is refused with a reason", !handle({ number: 9, body: body("a", "b", "", "{nope"), user: {} }, () => false).ok && !handle({ number: 9, body: "", user: {} }, () => false).ok);
}

// ---- driven motions
{
  const { cleanMotion, driven, MOTION_LIM, DRIVE_TO } = packs;
  const mo = cleanMotion({ name: "Tide", zoom: 1, drive: [{ to: "zoom", by: "wave", amount: 5, every: 1 }, { to: "rot", by: "mid", amount: 0.4, every: 3 }] });
  expect("a driver is limited: how far to 1, a wave to 8 seconds at the quickest", mo && mo.drive[0].amount === 1 && mo.drive[0].every === 8);
  expect("a driver that follows the sound keeps no wave length", mo && !("every" in mo.drive[1]));
  expect("a wave driver with no length gets 20 seconds", cleanMotion({ name: "a", drive: [{ to: "rot", by: "wave", amount: 1 }] }).drive[0].every === 20);
  expect("trail length and beat push cannot be driven", cleanMotion({ name: "a", drive: [{ to: "decay", by: "bass", amount: 1 }] }) === null && cleanMotion({ name: "a", drive: [{ to: "kick", by: "wave", amount: 1 }] }) === null);
  expect("a driver of the wrong shape refuses the motion", [[{ to: "rot", by: "clock", amount: 1 }], [{ to: "rot", by: "wave", amount: "1" }], [{}, {}, {}], "x", [null]].every(d => cleanMotion({ name: "a", drive: d }) === null));
  expect("an empty list of drivers is left out", !("drive" in cleanMotion({ name: "a", drive: [] })));
  let lo = 9, hi = -9, worst = 0;
  for (let t = 0; t < 16; t += 0.01) { const v = driven(mo, "zoom", 0.994, t, 1, 1, 1, 1); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  expect("a driven number never leaves the range a pack is held to", lo >= MOTION_LIM.zoom[0] && hi <= MOTION_LIM.zoom[1] && hi - lo > 0.09, lo + " " + hi);
  for (const f of DRIVE_TO) for (const by of ["wave", "bass", "mid", "high"]) for (const a of [-1, 1]) {
    const q = cleanMotion({ name: "q", [f]: MOTION_LIM[f][a < 0 ? 0 : 1], drive: [{ to: f, by, amount: a, every: 8 }, { to: f, by, amount: a, every: 9 }] });
    for (let t = 0; t < 20; t += 0.37) { const v = driven(q, f, 0, t, 1, 1, 1, 1); if (v < MOTION_LIM[f][0] || v > MOTION_LIM[f][1]) worst++; }
  }
  expect("that holds for every control, every source and both directions", worst === 0, worst + " outside");
  expect("the bass at full pushes a number by half its range times how far", Math.abs(driven(mo, "rot", 0, 0, 0, 1, 0, 1) - 0.4 * 0.025) < 1e-12 && driven(mo, "rot", 0, 0, 1, 0, 1, 1) === 0);
  expect("a motion with no drivers gives its own numbers, or the default", driven({ name: "x", rot: 0.01 }, "rot", 0, 5, 1, 1, 1, 1) === 0.01 && driven({ name: "x" }, "zoom", 0.994, 5, 1, 1, 1, 1) === 0.994);
  expect("reduced motion turns a driver down", Math.abs(driven(mo, "rot", 0, 0, 0, 1, 0, 0.25) - 0.1 * 0.025) < 1e-12);
  let fastest = 0, prev = driven(mo, "zoom", 1, 0, 0, 0, 0, 1);
  for (let t = 1 / 60; t < 16; t += 1 / 60) { const v = driven(mo, "zoom", 1, t, 0, 0, 0, 1); fastest = Math.max(fastest, Math.abs(v - prev) * 60); prev = v; }
  expect("the quickest, strongest wave crosses its range no faster than once in about 2.5 seconds", fastest < 0.1 / 2.5, fastest.toFixed(4) + " a second over a range of 0.1");
}

// ---- Record video
{
  const { recType, recClock, REC_TYPES } = recordM;
  expect("the first kind of video the browser can record is chosen", recType(t => /webm/.test(t)) === REC_TYPES[1] && recType(() => true) === REC_TYPES[0]);
  expect("a browser that names no kind gets none, and the recorder its own default", recType(() => false) === "");
  expect("the recording clock reads minutes and seconds", recClock(0) === "0:00" && recClock(75.9) === "1:15" && recClock(-3) === "0:00");
}

// ---- Sprites: fading, where they arrive, turning, keeping clear of surfaces, and the shader's count of them
{
  const { flitFade, flitAim, flitTurn, flitSlide, flitMove, NFLIT, FLIT_IN, FLIT_OUT } = flitsM, near = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
  expect("a sprite is unseen as it arrives and as it leaves, and full between", flitFade(0, 6) === 0 && flitFade(6, 6) === 0 && flitFade(3, 6) === 1);
  expect("a sprite fades in and out evenly, never past full", Math.abs(flitFade(FLIT_IN / 2, 6) - 0.5) < 1e-12 && Math.abs(flitFade(6 - FLIT_OUT / 2, 6) - 0.5) < 1e-12 && flitFade(-1, 6) === 0 && flitFade(9, 6) === 0);
  let okAim = true;
  for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) { const a = flitAim(i / 10, j / 10, 1 - j / 10); if (!(a[0] >= 3 && a[0] <= 9 && Math.abs(a[1]) <= 0.45 * a[0] + 1e-12 && Math.abs(a[2]) <= 0.3 * a[0] + 1e-12)) okAim = false; }
  expect("a sprite arrives ahead of the camera and inside the view", okAim);
  expect("a turned heading is one unit long, and a push that cancels it leaves it alone", near(flitTurn([0, 0, 1], 1, 0, 0), [Math.SQRT1_2, 0, Math.SQRT1_2]) && near(flitTurn([0, 0, 1], 0, 0, -1), [0, 0, 1]));
  expect("a heading into a surface slides along it, and one away from it is left alone", near(flitSlide([0.6, -0.8, 0], [0, 1, 0]), [1, 0, 0]) && near(flitSlide([0.6, 0.8, 0], [0, 1, 0]), [0.6, 0.8, 0]));
  const { fragSource } = await import("../js/shaders.js"), { WORLDS } = await import("../js/worlds.js");
  const src = fragSource(WORLDS[0]);
  expect("the scene shader has a line for each sprite, and no more", src.includes("uniform vec4 uFl[" + NFLIT + "];uniform float uFlA[" + NFLIT + "];") && src.includes("uFl[" + (NFLIT - 1) + "].w>0.0") && !src.includes("uFl[" + NFLIT + "].w"));
  // twenty seconds of flight in several worlds, from an open place: a sprite must never be inside a surface, and must keep moving
  let bad = [];
  for (const id of ["sponge", "citadel", "julia", "foam", "thicket", "cell"]) {
    const w = WORLDS.find(x => x.id === id), m = 0.3, per = w.period(m), de = (x, y, z, mm) => w.de(x, y, z, mm);
    for (let trial = 0; trial < 4; trial++) {
      let p = null, best = -1;
      for (let k = 0; k < 200; k++) { const q = [0, 1, 2].map(i => (Math.random() - 0.5) * per[i]), d = de(q[0], q[1], q[2], m); if (d > best) { best = d; p = q; } }
      const s = Math.max(0.01, Math.min(0.6, best * (0.3 + 0.7 * Math.random())));
      const f = { p: p.slice(), h: [0, 0, 1], wob: [0, 0, 0], r: 0.07 * s, age: 0, life: 99, zig: 1, burst: 0, wait: 0 };
      let moved = 0, worst = 1e9;
      for (let n = 0; n < 1200; n++) {
        const b = f.p.slice(); flitMove(f, de, m, s, w.speed, per, 1 / 60);
        let st = 0; for (let i = 0; i < 3; i++) { let q = f.p[i] - b[i]; q -= per[i] * Math.floor(q / per[i] + 0.5); st += q * q; }
        moved += Math.sqrt(st); worst = Math.min(worst, de(f.p[0], f.p[1], f.p[2], m) / f.r);
      }
      if (!(worst > 1) || !(moved > 2 * s)) bad.push(id + " nearest " + worst.toFixed(2) + " sizes, went " + (moved / s).toFixed(1));
    }
  }
  expect("a sprite keeps clear of the surfaces and keeps moving, in six worlds", bad.length === 0, bad.join("; "));
  // a flock: two followers and a leader, thirty seconds in three worlds. The followers must stay near the leader, apart from each other, and clear of the surfaces.
  {
    const { flitFollow, flitGap, flitPerch } = flitsM; let badF = [], badP = [];
    for (const id of ["foam", "thicket", "julia"]) {
      const w = WORLDS.find(x => x.id === id), m = 0.3, per = w.period(m), de = (x, y, z, mm) => w.de(x, y, z, mm);
      let p = null, best = -1;
      for (let k = 0; k < 300; k++) { const q = [0, 1, 2].map(i => (Math.random() - 0.5) * per[i]), d = de(q[0], q[1], q[2], m); if (d > best) { best = d; p = q; } }
      const s = Math.max(0.01, Math.min(0.6, best * 0.6)), mk = (off, zig) => ({ p: p.map((x, i) => x + off[i] * 0.07 * s), h: [0, 0, 1], wob: [0, 0, 0], r: 0.07 * s, age: 0, life: 99, zig, burst: 0, wait: 0, pace: 1, perch: 0 });
      const lead = mk([0, 0, 0], 2), fs = [mk([4, 0, 0], 1e9), mk([0, 4, 0], 1e9)];
      let far = 0, close = 1e9, wall = 1e9, farLate = 0;
      for (let n = 0; n < 1800; n++) {
        flitMove(lead, de, m, s, w.speed, per, 1 / 60);
        for (const f of fs) { flitFollow(f, lead, fs.filter(g => g !== f), per, 1 / 60); flitMove(f, de, m, s, w.speed, per, 1 / 60); }
        for (const f of fs) { const g = flitGap(f.p, lead.p, per), L = Math.hypot(g[0], g[1], g[2]) / f.r; far = Math.max(far, L); if (n > 600) farLate = Math.max(farLate, L); wall = Math.min(wall, de(f.p[0], f.p[1], f.p[2], m) / f.r); }
        const g2 = flitGap(fs[0].p, fs[1].p, per); close = Math.min(close, Math.hypot(g2[0], g2[1], g2[2]) / fs[0].r);
      }
      if (!(far < 60 && wall > 1)) badF.push(id + " furthest " + far.toFixed(1) + " sizes from the leader, nearest a surface " + wall.toFixed(2) + ", nearest each other " + close.toFixed(2));
      // one that settles: started in the open, it must reach a surface, sit without moving while the camera is far, and go when the camera comes
      const f = mk([0, 0, 0], 3); f.role = 2; const farCam = p.map((x, i) => x + per[i] / 2);
      let sat = -1, wallP = 1e9;
      for (let n = 0; n < 3600 && sat < 0; n++) { if (!flitPerch(f, de, m, s, w.speed, farCam, per, 1 / 60)) flitMove(f, de, m, s, w.speed, per, 1 / 60); wallP = Math.min(wallP, de(f.p[0], f.p[1], f.p[2], m) / f.r); if (f.perch === 1) sat = n; }
      if (sat < 0) { badP.push(id + " never settled"); continue; }
      const at = f.p.slice(); for (let n = 0; n < 300; n++) flitPerch(f, de, m, s, w.speed, farCam, per, 1 / 60);
      const drift = Math.hypot(...flitGap(at, f.p, per)) / f.r, dSit = de(f.p[0], f.p[1], f.p[2], m) / f.r;
      flitPerch(f, de, m, s, w.speed, f.p.map(x => x + 0.5 * s), per, 1 / 60);
      const went = f.perch === 2 && f.burst === 1;
      for (let n = 0; n < 600; n++) { if (!flitPerch(f, de, m, s, w.speed, farCam, per, 1 / 60)) flitMove(f, de, m, s, w.speed, per, 1 / 60); wallP = Math.min(wallP, de(f.p[0], f.p[1], f.p[2], m) / f.r); }
      if (!(wallP > 1 && drift < 0.5 && dSit > 1.8 && dSit < 2.6 && went)) badP.push(id + " nearest " + wallP.toFixed(2) + " sizes, moved " + drift.toFixed(2) + " while sitting at " + dSit.toFixed(2) + ", scattered " + went);
    }
    expect("followers stay with their leader and clear of the surfaces, in three worlds", badF.length === 0, badF.join("; "));
    expect("a sprite that settles reaches a surface, sits still just off it, and goes when the camera comes", badP.length === 0, badP.join("; "));
  }
}

// ---- Throw a light: bouncing
{
  const { bounce, facing } = sparkM, near = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
  expect("a light heading into a floor comes back up, slower", near(bounce([1, -2, 0], [0, 1, 0], 0.8), [0.8, 1.6, 0]));
  expect("a light already heading away is left alone", near(bounce([1, 2, 0], [0, 1, 0], 0.8), [1, 2, 0]));
  expect("a bounce never adds speed", [[3, -1, 2], [-1, -1, -1], [0, -5, 0]].every(v => { const n = [0.6, 0.8, 0], b = bounce(v, n, 0.8); return Math.hypot(...b) <= Math.hypot(...v) + 1e-12; }));
  const sphere = (x, y, z) => Math.hypot(x, y, z) - 1;
  expect("the way a surface faces is found from the distances round a point", near(facing(sphere, 0, 2, 0, 0, 0.01), [0, 1, 0]) && near(facing(sphere, -3, 0, 0, 0, 0.01), [-1, 0, 0]));
  let p = [0, 3, 0], v = [0.3, -1, 0.1], inside = 0;
  for (let i = 0; i < 4000; i++) { p = p.map((x, k) => x + v[k] * 0.01); const d = sphere(...p); if (d < 0.05) { const n = facing(sphere, ...p, 0, 0.01); p = p.map((x, k) => x + n[k] * (0.05 - d)); v = bounce(v, n, 0.8); } if (sphere(...p) < 0.049) inside++; }
  expect("a light thrown at a ball never ends a step inside it", inside === 0, inside + " steps inside");
}

// ---- Knobs: reading MIDI
{
  const { midiRead, knobSlot, knobRate, KNOBS } = midiM;
  expect("a controller message is read as a knob from 0 to 1, on any channel", midiRead([0xb3, 21, 127]).knob === 21 && midiRead([0xb3, 21, 127]).v === 1 && midiRead([0xb0, 7, 0]).v === 0);
  expect("a note pressed is a pad; a note let go, or pressed with no force, is nothing", midiRead([0x91, 36, 90]).pad === 36 && midiRead([0x81, 36, 0]) === null && midiRead([0x90, 36, 0]) === null);
  expect("other messages and short ones are nothing", midiRead([0xe0, 0, 64]) === null && midiRead([0xb0, 7]) === null && midiRead(null) === null);
  const list = [];
  expect("the first four knobs turned get the four jobs in order, and keep them", [21, 22, 21, 5, 70, 22, 99].map(c => knobSlot(list, c)).join() === "0,1,0,2,3,1,-1" && list.length === KNOBS.length);
  expect("a look knob near the middle does not turn the view", knobRate(0.5) === 0 && knobRate(0.55) === 0 && knobRate(0.45) === 0);
  expect("a look knob at either end turns at full rate, and the rate grows smoothly", Math.abs(knobRate(1) - 1) < 1e-9 && Math.abs(knobRate(0) + 1) < 1e-9 && knobRate(0.8) > knobRate(0.7) && knobRate(0.7) > 0);
}

// ---- the choosers' pictures: every built-in world, palette, motion, filter, overlay, mirror setting, FX setting and landscape has one
{
  const { existsSync } = await import("node:fs"), root = new URL("../", import.meta.url);
  const { thumbName, palStripe } = (await import("../js/picker.js")).__dbg;
  const { WORLDS } = await import("../js/worlds.js"), { PALETTES } = await import("../js/palettes.js");
  const { MOTIONS, LOOKS, OVERLAYS, FX, SURFACES, mirrors } = await import("../js/state.js"), land = await import("../js/landscapes.js");
  land.init(); // the list of landscapes is made at start-up, and needs no page
  const want = [].concat(WORLDS.map(w => thumbName("world", w.id)), PALETTES.map(p => thumbName("palette", p.name)), MOTIONS.map(m => thumbName("motion", m.name)),
    LOOKS.map(f => thumbName("filter", f.name)), OVERLAYS.map(o => thumbName("overlay", o.name)), mirrors.map(m => thumbName("mirrors", m)),
    FX.map(f => thumbName("fx", f.name)), SURFACES.map(f => thumbName("surface", f.name)), land.LK.map(k => thumbName("land", k.id)),
    (await import("../js/packing.js")).PACKINGS.map(k => thumbName("packing", k.name)));
  const missing = want.filter(f => !existsSync(new URL(f, root)));
  expect("a picture's file name is made of small letters, digits and hyphens only", thumbName("filter", "Two-tone") === "thumbs/filter-two-tone.jpg" && thumbName("world", "../x y") === "thumbs/world-x-y.jpg");
  expect("no two built-ins share a picture", new Set(want).size === want.length);
  expect("every built-in has its picture in thumbs/ (run python3 tools/thumbs.py)", missing.length === 0, missing.join(", "));
  expect("a pack palette's stripe is a gradient of plain colour numbers", /^linear-gradient\(90deg(,rgb\(\d+,\d+,\d+\)){9}\)$/.test(palStripe({ a: [.5, .5, .5], b: [.5, 9, -9], c: [1, 1, 1], d: [0, .3, .6] })));
}

// ---- the lessons: every step has its words in every language, its drawing, and a voice made from those same words
{
  const { existsSync, readFileSync } = await import("node:fs"), root = new URL("../", import.meta.url);
  const { LANGS, cleanLang, fill, pickLang } = await import("../js/lang.js");
  const { TRACKS, PARTS, partKey, narration, voiceName, sayHash } = await import("../js/lessons.js");
  const { FIGS: FIGS1, hopsOut, visits, sqr2, num } = await import("../js/figures.js");
  const SP = await import("../js/figures-space.js"), MO = await import("../js/figures-more.js"), LK = await import("../js/figures-look.js");
  const FIGS = Object.assign({}, FIGS1, SP.SPACE_FIGS, MO.MORE_FIGS, LK.LOOK_FIGS), { chaptersOf } = await import("../js/lessons.js");
  const bad = [];
  for (const lg of LANGS) {
    const raw = JSON.parse(readFileSync(new URL("lang/" + lg + ".json", root), "utf8")), words = cleanLang(raw);
    if (Object.keys(words).length !== Object.keys(raw).length) bad.push("lang/" + lg + ".json holds something that is not text");
    let marks = {};
    try { marks = JSON.parse(readFileSync(new URL("voice/" + lg + "/index.json", root), "utf8")); } catch (_) { }
    for (const T of TRACKS) {
      for (const C of chaptersOf(T)) if (!words["learn.chapter." + T.id + "." + C.id]) bad.push(lg + ": no name for the chapter " + T.id + "." + C.id);
      if (!words["learn.track." + T.id]) bad.push(lg + ": no name for the track " + T.id);
      for (const s of T.steps) {
        for (const p of PARTS) if (!words[partKey(T.id, s, p)]) bad.push(lg + ": no text " + partKey(T.id, s, p));
        if (!FIGS[s]) bad.push("no drawing for the step " + s);
        if (!existsSync(new URL(voiceName(lg, T.id, s), root))) bad.push("no voice file " + voiceName(lg, T.id, s));
        else if (marks[T.id + "-" + s] !== sayHash(narration(words, T.id, s).join("\n"))) bad.push("the voice for " + lg + " " + T.id + "-" + s + " was made from other words");
      }
    }
    // every name the drawings and the panel ask for has text
    const src = ["learn.js", "figures.js", "figures-space.js", "figures-more.js", "figures-look.js"].map(f => readFileSync(new URL("js/" + f, root), "utf8")).join("\n");
    for (const m of src.matchAll(/"(learn\.[a-zA-Z0-9.]+)"/g)) if (!m[1].endsWith(".") && !words[m[1]]) bad.push(lg + ": no text " + m[1]);
  }
  expect("every lesson step has its words, its drawing and an up-to-date voice (run tools/voice.py)", bad.length === 0, bad.join("; "));
  expect("a voice file's address is made of the language and the step's names", voiceName("en", "mandel", "square") === "voice/en/mandel-square.mp3");
  expect("text is filled in by position, and a name with no text gives the name", fill({ a: "{0} by {1}, {0}" }, "a", [3, 4]) === "3 by 4, 3" && fill({}, "x.y", []) === "x.y" && fill({}, "constructor", []) === "constructor");
  expect("only text is kept from a language file", JSON.stringify(cleanLang({ a: "x", b: 3, c: { d: "y" }, e: ["z"] })) === '{"a":"x"}' && Object.keys(cleanLang([1])).length === 0);
  expect("the language is the first wanted one we have, else English", pickLang(["fr-CA", "en-GB"]) === "en" && pickLang(["de"]) === "en" && pickLang([]) === "en");
  expect("hops: 0 never leaves the ring, 1 leaves on its third hop, -2 stays, a little past one quarter leaves", hopsOut(0, 0, 200) === 0 && hopsOut(1, 0, 200) === 3 && hopsOut(-2, 0, 200) === 0 && hopsOut(0.26, 0, 200) > 0 && hopsOut(0.25, 0, 200) === 0);
  expect("a path settles on 1 place at c = 0, 2 at -1, 3 at -1.755", visits(0, 0) === 1 && visits(-1, 0) === 2 && visits(-1.755, 0) === 3 && visits(1, 0) === -1);
  const q = sqr2(0, 1);
  expect("the point one unit straight up squares to minus one", q[0] === -1 && q[1] === 0);
  {
    // the lessons' Foam is the app's Foam: the flat sum agrees with the world's own distance function on the sheet through bubble middles
    const foam = (await import("../js/worlds.js")).WORLDS.find(w => w.id === "foam");
    let worst = 0;
    for (let i = 0; i < 400; i++) { const x = Math.sin(i * 1.7) * 3, y = Math.cos(i * 2.3) * 3; worst = Math.max(worst, Math.abs(SP.foam2(x, y, 0, 3, 1.25) - foam.de(x, y, 1, 0))); }
    expect("the lessons' bubble sum on a flat sheet is the Foam world's own, cut through the middle of its bubbles", worst < 1e-9, "worst " + worst);
    const near = () => 0.01, hit = SP.walkLine(SP.flatD, 0, -2.1, 0, 0, 1, 0, near, 8, 80), r = SP.flatRay(0, 9), miss = SP.walkLine(SP.flatD, 0, -2.1, 0, -1, 0, 0, near, 8, 80);
    expect("a walk in safe moves arrives at a pillar, never passes through one, and gives up on a line that hits nothing",
      SP.arrived(hit, near) && hit.every(e => e[1] > -1e-9) && !SP.arrived(miss, near) && Math.abs(Math.hypot(r[0], r[1]) - 1) < 1e-12);
    const L = SP.lampDir(60), V = SP.view();
    expect("the eye's three directions are at right angles and one unit long, and so is the lamp's", Math.abs(Math.hypot(...L) - 1) < 1e-12 && Math.abs(V.f[0] * V.r[0] + V.f[1] * V.r[1] + V.f[2] * V.r[2]) < 1e-12 && Math.abs(Math.hypot(...V.u) - 1) < 1e-12);
  }
  {
    const all = TRACKS.flatMap(T => T.steps);
    expect("no two steps share a name, and every track's chapters add up to its steps", new Set(all).size === all.length && TRACKS.every(T => T.chapters.reduce((a, c) => a + c[1], 0) === T.steps.length));
    const { mirrors } = await import("../js/state.js");
    expect("the kaleidoscope lesson offers the app's own numbers of mirrors", JSON.stringify(MO.KALE) === JSON.stringify(mirrors.filter(m => m > 0)));
    expect("a path from a start: inside one it stays with c = 0, outside it leaves", MO.hopsFrom(0.9, 0, 0, 0, 100) === 0 && MO.hopsFrom(1.1, 0, 0, 0, 100) > 0);
    expect("power 2 of the general rule is the Mandelbrot rule", [[-1, 0], [0.3, 0.5], [1, 1], [-0.75, 0.1]].every(c => MO.hopsPow(c[0], c[1], 2, 100, false) === hopsOut(c[0], c[1], 100)));
    expect("an angle folds into the first wedge and back out", MO.wedgeFold(10, 3) === 10 && MO.wedgeFold(70, 3) === 50 && MO.wedgeFold(130, 3) === 10 && Math.abs(MO.wedgeFold(359, 4) - 1) < 1e-9);
    expect("the carpet: solid block, a hole in the middle, a smaller one in the middle of a ninth", MO.carpetD(0.5, 0.2, 0) < 0 && MO.carpetD(0, 0, 1) > 0 && MO.carpetD(0.5, 0.2, 1) < 0 && MO.carpetD(2 / 3, 2 / 3, 2) > 0 && MO.carpetD(1.5, 0, 4) > 0);
    const A = [.8, .4, .2];
    expect("taking a mixture of three waves apart gives back the three amounts", A.every((a, k) => Math.abs(LK.bandOf(A, k) - a) < 1e-6));
    expect("a palette's colour is three waves held between 0 and 1", LK.palAt({ a: [.5, .5, 2], b: [.5, .5, 0], c: [1, 1, 1], d: [0, .5, 0] }, 0).join() === "1,0,1");
    expect("cutting to levels rounds down, and keeps 0 and 1", LK.cutTo(0, 4) === 0 && LK.cutTo(1, 4) === 1 && Math.abs(LK.cutTo(.63, 4) - 2 / 3) < 1e-12 && LK.cutTo(.49, 2) === 0);
    expect("the bulge at zero strength, and outside its circle, leaves a square where it is", LK.bulgeFrom(100, 60, 0)[0] === 100 && LK.bulgeFrom(5, 5, .5)[2] === 1);
  }
  expect("numbers are written plainly", num(0.5) === "0.50" && num(-0.001) === "-0.0010" && num(-0.0000001, 2) !== "-0.00" && num(65536) === "65536");
}

// ---- the song shapes the world (js/song.js)
{
  const { makeSongTracker, songMorph, morphSteer, denseSide, SONG_HI } = songM, dt = 1 / 30, barLen = 4 * 60 / 126;
  /* the built-in song's energy, bar by bar, as the analyser gives it (measured by rendering the song without playing it):
     a quiet opening, a build, a drop after half a bar of silence, a breakdown, the same again, and a fading end */
  const BARS = [0.379,0.383,0.392,0.386,0.700,0.701,0.714,0.712,0.726,0.715,0.730,0.725,0.739,0.735,0.758,0.519,0.763,0.753,0.759,0.753,0.760,0.748,0.761,0.754,0.760,0.751,0.761,0.754,0.761,0.755,0.760,0.751,0.507,0.318,0.390,0.290,0.495,0.352,0.409,0.336,0.471,0.318,0.396,0.301,0.738,0.734,0.755,0.513,0.778,0.766,0.776,0.772,0.776,0.767,0.775,0.772,0.778,0.773,0.775,0.769,0.777,0.768,0.776,0.773,0.725,0.700,0.704,0.691,0.683,0.666,0.654,0.622];
  const run = (energyAt, secs) => { const tr = makeSongTracker(), lv = [], drops = []; for (let t = 0; t < secs; t += dt) { const o = tr(dt, energyAt(t)); lv.push(o.level); if (o.drop) drops.push(t); } return { lv, drops }; };
  const mean = (lv, a, b) => { let s = 0, n = 0; for (let i = Math.floor(a / dt); i < Math.floor(b / dt); i++) { s += lv[i]; n++; } return s / n; };
  const song = run(t => BARS[Math.min(71, Math.floor(t / barLen))], 72 * barLen), B = barLen;
  expect("the built-in song's quiet opening counts as nearly empty", mean(song.lv, 1 * B, 4 * B) < 0.3, mean(song.lv, 1 * B, 4 * B));
  expect("its drops count as full", mean(song.lv, 20 * B, 32 * B) > 0.9 && mean(song.lv, 50 * B, 64 * B) > 0.9);
  expect("its breakdown counts as nearly empty", mean(song.lv, 34 * B, 44 * B) < 0.15, mean(song.lv, 34 * B, 44 * B));
  expect("a drop is heard where the music comes in full: at bar 4 and at bar 44, and not in the breakdown or the fade",
    song.drops.some(t => Math.abs(t / B - 4) < 0.6) && song.drops.some(t => Math.abs(t / B - 44) < 0.6) && !song.drops.some(t => (t / B > 33 && t / B < 43.5) || t / B > 64), song.drops.map(t => (t / B).toFixed(1)).join(" "));
  expect("drops are at least eight seconds apart", song.drops.every((t, i) => i === 0 || t - song.drops[i - 1] >= 8));
  const flat = run(() => 0.7, 120);
  expect("a song that is equally loud all through counts as full, with no drops", mean(flat.lv, 30, 120) > 0.95 && flat.drops.length === 0);
  const verse = run(t => Math.floor(t / 20) % 2 ? 0.70 : 0.64, 200);
  expect("a verse only a little under its chorus still goes from one end to the other", mean(verse.lv, 172, 179) < 0.2 && mean(verse.lv, 192, 199) > 0.8, mean(verse.lv, 172, 179) + " " + mean(verse.lv, 192, 199));
  const silent = run(() => 0, 30);
  expect("silence is empty and has no drops", silent.lv.every(x => x === 0) && silent.drops.length === 0);
  const start = run(t => t < 10 ? 0 : 0.7, 30);
  expect("music starting after silence is not a drop", start.drops.length === 0, start.drops.join(" "));
  const noisy = run(t => 0.7 + 0.03 * Math.sin(t * 9.1) + 0.02 * Math.sin(t * 23.7), 120);
  expect("the ordinary rise and fall of a steady song is not a drop", noisy.drops.length === 0);
  expect("the level is always between 0 and 1", [song, flat, verse, start, noisy].every(r => r.lv.every(x => x >= 0 && x <= 1)));
  expect("a quiet passage asks for the world's open end and a full one for its dense end, whichever way round the world is",
    songMorph(0, 1, 0) < -0.8 && songMorph(1, 1, 0) > 0.8 && songMorph(0, -1, 0) > 0.8 && songMorph(1, -1, 0) < -0.8);
  expect("the morph asked for never leaves its range", [0, 0.5, 1].every(l => [-1, 1].every(sd => [0, 22, 44, 66].every(tm => Math.abs(songMorph(l, sd, tm)) <= 0.98))));
  /* steering the morph's clock */
  let T = 137.2, worst = 0, prev = T;
  for (let i = 0; i < 60 * 20; i++) { T = morphSteer(T, 0.6, 1 / 60, 3); worst = Math.max(worst, Math.abs(T - prev) * 60); prev = T; }
  expect("the morph's clock is steered to a time that gives the morph asked for", Math.abs(Math.sin(0.09 * T) - 0.6) < 1e-6, Math.sin(0.09 * T));
  expect("and never faster than its limit", worst <= 3 + 1e-9, worst);
  expect("it goes to the nearest such time, not round the long way", Math.abs(T - 137.2) < 2 * Math.PI / 0.09 / 2);
  let T2 = 5, far = 0; for (let i = 0; i < 60 * 60; i++) { const aim = 0.9 * Math.sin(i / 60 * 0.8); const n = morphSteer(T2, aim, 1 / 60, 3); far = Math.max(far, Math.abs(n - T2)); T2 = n; }
  expect("following an aim that keeps moving, it never jumps", far <= 3 / 60 + 1e-9, far);
  expect("once there it stays", morphSteer(T, 0.6, 1 / 60, 3) === T || Math.abs(morphSteer(T, 0.6, 1 / 60, 3) - T) < 1e-9);
  const solid = worldsM.WORLDS.filter(w => !w.volume && !w.flat);
  expect("every solid world has a dense end, found the same way each time", solid.every(w => { const a = denseSide(w); return (a === 1 || a === -1) && a === denseSide(w); }));
  expect("a cloud or zoom world, with no surfaces to measure, gets the high end", worldsM.WORLDS.filter(w => w.volume).every(w => denseSide(w) === 1));
}

// ---- a recorded flight as data (js/flightdata.js)
{
  const { FL_DT, FL_MAX, FL_BYTES, FL_TURN, flSample, flRead, flWrite, flAt, flPack, flUnpack } = flightM;
  const per = [4, 6, 2], unit = v => { const l = Math.hypot(...v); return v.map(x => x / l); }, cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  // a flight round a slanted circle that crosses the world's wrap, rolling as it goes, with a change of world two thirds through
  const N = 40, bytes = new Uint8Array(N * FL_BYTES), truth = [];
  const at = t => { const a = t * 0.35, pos = [1.7 + 1.2 * Math.cos(a), 0.4 * Math.sin(a), 0.8 * Math.sin(a) + 0.9], F = unit([-Math.sin(a), 0.3 * Math.cos(a), Math.cos(a)]);
    const R0 = unit(cross([0, 1, 0], F)), U0 = cross(F, R0), r = 0.4 * Math.sin(t * 0.5), Up = U0.map((x, i) => x * Math.cos(r) + R0[i] * Math.sin(r));
    return { pos: pos.map((x, i) => x - per[i] * Math.floor(x / per[i] + 0.5)), F, Up, mt: 600 + 3 * t }; };
  for (let i = 0; i < N; i++) { const s = at(i * FL_DT); truth.push(s); flWrite(bytes, i, flSample(s.pos, per, s.F, s.Up, s.mt, i < 27 ? 0 : 1)); }
  const fl = { seed: 123456789, worlds: ["sponge", "julia"], ev: [[0, "world", "sponge"], [0, "palette", "Wood"], [13.5, "world", "julia"], [4.2, "surface", "grain"]], n: N, bytes };
  const gap = (a, b) => Math.hypot(...a.map((x, i) => { let d = x - b[i]; return d - per[i] * Math.round(d / per[i]); }));
  let worstS = 0, worstF = 0;
  for (let i = 0; i < N; i++) { const r = flRead(bytes, i), s = truth[i]; worstS = Math.max(worstS, gap(r.q.map((x, k) => x * per[k]), s.pos)); worstF = Math.max(worstF, Math.hypot(...r.F.map((x, k) => x - s.F[k])), Math.hypot(...r.Up.map((x, k) => x - s.Up[k]))); }
  expect("a sample read back is where it was written, to a few ten-thousandths", worstS < 3e-4 && worstF < 1e-3, worstS + " " + worstF);
  let worstP = 0, worstD = 0, worstO = 0, jump = 0, prev = null;
  for (let t = 0.5; t < 12.5; t += 1 / 60) {
    const r = flAt(fl, t, 0, () => per), s = at(t);
    worstP = Math.max(worstP, gap(r.pos, s.pos)); worstD = Math.max(worstD, Math.hypot(...r.F.map((x, k) => x - s.F[k])), Math.hypot(...r.Up.map((x, k) => x - s.Up[k])));
    worstO = Math.max(worstO, Math.abs(r.F[0] * r.Up[0] + r.F[1] * r.Up[1] + r.F[2] * r.Up[2]), Math.abs(Math.hypot(...r.F) - 1), Math.abs(Math.hypot(...r.Up) - 1));
    if (prev) jump = Math.max(jump, gap(r.pos, prev)); prev = r.pos;
  }
  expect("between samples the camera is on the path that was flown, across the world's wrap", worstP < 0.004 && worstD < 0.01, worstP + " " + worstD);
  expect("and its directions stay one unit long and square to each other", worstO < 1e-9, worstO);
  expect("and it never jumps", jump < 0.02, jump);
  expect("the morph's clock is carried within one round of it", Math.abs(flAt(fl, 3.2, 0, () => per).mt - ((600 + 3 * 3.2) % FL_TURN)) < 0.02);
  expect("round a change of world the camera is given only to the world the flight is in", flAt(fl, 12, 1, () => per) === null && flAt(fl, 15, 0, () => per) === null && flAt(fl, 13.2, 0, () => per) !== null && flAt(fl, 13.2, 1, () => per) !== null && flAt(fl, 15, 1, () => per) !== null);
  const text = flPack(fl), back = flUnpack(text);
  expect("a flight packed into a link's letters reads back the same", back && back.seed === 123456789 && back.n === N && back.worlds.join() === "sponge,julia" && back.bytes.length === bytes.length && back.bytes.every((x, i) => x === bytes[i]));
  expect("its changes come back in the order of their times", back && back.ev.map(e => e[1] + e[2] + e[0]).join() === "worldsponge0,paletteWood0,surfacegrain4.2,worldjulia13.5", back && JSON.stringify(back.ev));
  expect("a link's letters are only letters, digits, - and _ and one full stop", /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(text));
  expect("four minutes of flight is under eleven thousand letters", Math.ceil((FL_MAX / FL_DT) * FL_BYTES * 4 / 3) < 10000);
  const head = o => Buffer.from(JSON.stringify(o)).toString("base64url"), body = text.split(".")[1];
  const bad = [ "", "abc", "a.b", text + "!", text.replace(".", ".."), "x".repeat(50000) + "." + body,
    head({ v: 2, seed: 1, w: ["sponge"], e: [] }) + "." + body, head({ v: 1, seed: 1, w: [], e: [] }) + "." + body,
    head({ v: 1, seed: 1, w: ["sponge"], e: [] }) + "." + body /* a sample names a second world that is not in the list */,
    head({ v: 1, seed: 1, w: ["a", "b"], e: [[1, 99, "x"]] }) + "." + body, head({ v: 1, seed: 1, w: ["a", "b"], e: [["1", 0, "x"]] }) + "." + body,
    head({ v: 1, seed: 1, w: ["a", "b"], e: [[1, 0, { toString: 1 }]] }) + "." + body, head({ v: 1, seed: 1, w: ["a", 7], e: [] }) + "." + body,
    head({ v: 1, seed: 1, w: ["a", "b"], e: [[1e9, 0, "x"]] }) + "." + body, head({ v: 1, seed: 1, w: ["a", "x".repeat(61)], e: [] }) + "." + body,
    head({ v: 1, seed: 1, w: ["a", "b"], e: [] }) + "." + Buffer.alloc(FL_BYTES).toString("base64url"), head([1, 2]) + "." + body, head(null) + "." + body, 7, null ];
  expect("text that is not a flight is refused, whatever is wrong with it", bad.every(b => flUnpack(b) === null), bad.map((b, i) => flUnpack(b) === null ? "" : i).join(""));
  expect("a seed that is not a number is taken as none", flUnpack(head({ v: 1, seed: "9", w: ["a", "b"], e: [] }) + "." + body).seed === 0);
}

// ---- flying together (js/together.js)
{
  const { tgClean, tgPlace, TG_MAX, TG_TURN, TG_KINDS } = togetherM, J = JSON.stringify, none = { pa: "", lk: "", mi: "", mo: "", ov: "", sf: "", ld: "", pk: "", pu: "", sh: "", io: "" };
  expect("a guest's message comes through as its world and its place", J(tgClean(J({ w: "sponge", q: [0.1, -0.5, 0.5], extra: "<b>" }), false)) === J({ w: "sponge", q: [0.1, -0.5, 0.5] }));
  expect("a host's message comes through as its world, morph clock and the others", J(tgClean(J({ w: "julia", mt: 12.5, o: [[0, "julia", 0, 0.2, -0.2], [2, "sponge", 0.5, 0, 0]] }), true)) === J(Object.assign({ w: "julia", mt: 12.5, o: [[0, "julia", 0, 0.2, -0.2], [2, "sponge", 0.5, 0, 0]] }, none)));
  const all = { pa: "Wood", lk: "Neon", mi: "6", mo: "Melt", ov: "Rings", sf: "marble", ld: "canyon over", pk: "nested", pu: "wave", sh: "one kind", io: "on" };
  expect("and with everything the host's Journey changes, by name", J(tgClean(J(Object.assign({ w: "a", mt: 1, o: [] }, all, { zz: "x" })), true)) === J(Object.assign({ w: "a", mt: 1, o: [] }, all)));
  expect("one of those that is not a short name drops the message", [{ pa: 7 }, { pa: "x".repeat(41) }, { lk: ["Neon"] }, { lk: "" }, { pa: null }, { mi: 6 }, { mo: {} }, { ov: "x".repeat(41) }, { sf: false }, { ld: 0 }, { pk: 2 }, { pu: 1 }, { sh: ["mixed"] }].every(x => tgClean(J(Object.assign({ w: "a", mt: 1, o: [] }, x)), true) === null));
  expect("the host's message names every kind Journey changes but the world, which it names as w", J(TG_KINDS.map(k => k[1]).sort()) === J(flightM.FL_KINDS.filter(k => k !== "world").sort()));
  const spot = [0.1, -0.5, 0.5, 0, 0, 1, 0, 1, 0];
  expect("a word about going to a spot comes through: from the host with who said it, from a guest with who it is for", J(tgClean(J({ c: "come", f: 2, extra: 1 }), true)) === J({ c: "come", f: 2, to: -1, w: "", p: null }) && J(tgClean(J({ c: "no", to: 0, f: 3 }), false)) === J({ c: "no", f: 0, to: 0, w: "", p: null }));
  expect("and a place comes through with its world, three parts and two directions", J(tgClean(J({ c: "here", f: 0, to: 1, w: "sponge", p: spot }), true)) === J({ c: "here", f: 0, to: 1, w: "sponge", p: spot }));
  const badA = [{ c: "jump", f: 0 }, { c: 7, f: 0 }, { c: "come" }, { c: "come", f: 4 }, { c: "come", f: -1 }, { c: "come", f: 0.5 }, { c: "come", f: "0" }, { c: "no", f: 0, to: 9 }, { c: "no", f: 0, to: "1" }, { c: "here", f: 0 }, { c: "here", f: 0, w: "a" }, { c: "here", f: 0, w: "", p: spot }, { c: "here", f: 0, w: "a", p: spot.slice(0, 8) }, { c: "here", f: 0, w: "a", p: [0.6].concat(spot.slice(1)) }, { c: "here", f: 0, w: "a", p: spot.slice(0, 8).concat([2]) }, { c: "here", f: 0, w: "a", p: spot.slice(0, 8).concat(["0"]) }, { c: "here", f: 0, w: "a", p: "x" }];
  expect("a word about a spot with anything wrong in it is dropped", badA.every(b => tgClean(J(b), true) === null), badA.map((b, i) => tgClean(J(b), true) === null ? "" : i).join(","));
  {
    const { tgSpot } = togetherM, c = tgSpot([0.25, -0.5, 0, 0, 0, 2, 0.3, 1, 0.4], [4, 2, 8]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    expect("a place becomes a camera: in the world's units, facing as sent, with up and right square to it", c && J(c.pos) === J([1, -1, 0]) && J(c.F) === J([0, 0, 1]) && Math.abs(dot(c.Up, c.F)) < 1e-12 && Math.abs(dot(c.R, c.F)) < 1e-12 && Math.abs(dot(c.R, c.Up)) < 1e-12 && Math.abs(Math.hypot(...c.Up) - 1) < 1e-12 && c.Up[1] > 0.9 && c.R[0] > 0.9, J(c));
    expect("directions no camera can have give nothing", tgSpot([0, 0, 0, 0, 0, 0, 0, 1, 0], [1, 1, 1]) === null && tgSpot([0, 0, 0, 0, 0, 1, 0, 0, 1], [1, 1, 1]) === null);
  }
  {
    const { tgMusicSdp } = togetherM, sd = "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111 63\r\na=rtpmap:111 opus/48000/2\r\na=fmtp:111 minptime=10;useinbandfec=1\r\na=rtpmap:63 red/48000/2\r\na=fmtp:63 111/111\r\n", out = tgMusicSdp(sd);
    expect("the music line of a session description is set for music, and nothing else is touched", out === sd.replace("useinbandfec=1", "useinbandfec=1;stereo=1;sprop-stereo=1;maxaveragebitrate=128000"), out);
    expect("doing it twice changes nothing more, and a description with no music line is left alone", tgMusicSdp(out) === out && tgMusicSdp("v=0\r\nm=application 9\r\n") === "v=0\r\nm=application 9\r\n");
  }
  const badG = ["", "{", "null", "7", J([1]), J({ w: "", q: [0, 0, 0] }), J({ w: "x".repeat(41), q: [0, 0, 0] }), J({ w: 5, q: [0, 0, 0] }), J({ w: "a", q: [0, 0] }), J({ w: "a", q: [0, 0, 0.6] }), J({ w: "a", q: [0, 0, "0"] }), J({ w: "a", q: [0, 0, null] }), J({ w: "a", q: "000" }), '{"w":"a","q":[0,0,1e999]}', J({ w: "a", q: [0, 0, 0], pad: "x".repeat(2000) })];
  expect("a guest's message with anything wrong in it is dropped", badG.every(b => tgClean(b, false) === null) && tgClean(7, false) === null && tgClean(null, false) === null, badG.map((b, i) => tgClean(b, false) === null ? "" : i).join(","));
  const h = o => J(Object.assign({ w: "a", mt: 1, o: [] }, o));
  const badH = [J({ w: "a", q: [0, 0, 0] }), h({ mt: -1 }), h({ mt: TG_TURN + 2 }), h({ mt: "1" }), h({ o: "x" }), h({ o: [[0, "a", 0, 0, 0], [1, "a", 0, 0, 0], [2, "a", 0, 0, 0], [3, "a", 0, 0, 0]] }), h({ o: [[4, "a", 0, 0, 0]] }), h({ o: [[0.5, "a", 0, 0, 0]] }), h({ o: [[-1, "a", 0, 0, 0]] }), h({ o: [[0, 7, 0, 0, 0]] }), h({ o: [[0, "a", 0, 0]] }), h({ o: [[0, "a", 0, 0, 9]] }), h({ o: [null] })];
  expect("a host's message with anything wrong in it is dropped", badH.every(b => tgClean(b, true) === null), badH.map((b, i) => tgClean(b, true) === null ? "" : i).join(","));
  const per = [4, 4, 4];
  expect("someone first heard of is drawn where they are, at the copy nearest the camera", tgPlace(null, [0.45, 0, -0.25], per, [-1.9, 0.1, 0], 1 / 60).every((x, i) => Math.abs(x - [-2.2, 0, -1][i]) < 1e-9));
  let at = tgPlace(null, [0.45, 0, 0], per, [1.5, 0, 0], 1 / 60), far = 0;
  for (let i = 0; i < 60; i++) { const n = tgPlace(at, [-0.45, 0, 0], per, [1.5, 0, 0], 1 / 60); far = Math.max(far, Math.abs(n[0] - at[0])); at = n; }
  expect("they slide to a new place the short way across the world's wrap, without a jump", far < 0.08 && Math.abs(at[0] - 2.2) < 0.01, far + " " + at[0]);
  const { tgSignal, tgRoom } = togetherM, sdp = "v=0\r\no=- 4611731400430051336 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\na=candidate:1 1 udp 2113937151 192.0.2.7 51234 typ host\r\n";
  expect("a room's code is read from a link, and anything else is not one", tgRoom("k7f2q9xm") === "k7f2q9xm" && ["", "abc", "K7F2Q9XM", "k7f2q9x1", "k7f2 q9xm", "a".repeat(13), "k7f2q9xm/../x", "k7f2q9xm?x=1", 7, null].every(x => tgRoom(x) === ""));
  expect("the meeting point's word to the host comes through as a guest's name and description", J(tgSignal(J({ t: "o", g: "ab12cd34ef", s: sdp, extra: "<b>" }), true)) === J({ t: "o", g: "ab12cd34ef", s: sdp }));
  expect("and its word to a guest as the host's description, no room left, or the host gone", J(tgSignal(J({ t: "a", s: sdp, g: "x" }), false)) === J({ t: "a", s: sdp }) && J(tgSignal(J({ t: "n", s: 7 }), false)) === J({ t: "n" }) && J(tgSignal(J({ t: "e" }), false)) === J({ t: "e" }) && J(tgSignal(J({ t: "h", s: "x" }), false)) === J({ t: "h" }));
  const badToHost = ["", "{", "null", "7", "q", J([1]), J({ t: "h" }), J({ t: "a", g: "ab", s: sdp }), J({ t: "o", s: sdp }), J({ t: "o", g: 7, s: sdp }), J({ t: "o", g: "", s: sdp }), J({ t: "o", g: "AB", s: sdp }), J({ t: "o", g: "a/b", s: sdp }), J({ t: "o", g: "a".repeat(17), s: sdp }), J({ t: "o", g: "ab", s: 7 }), J({ t: "o", g: "ab", s: "hello" }), J({ t: "o", g: "ab", s: "v=0" + "x".repeat(10000) }), J({ t: "o", g: "ab", s: sdp, pad: "x".repeat(12000) })];
  const badToGuest = ["", "{", "null", J([1]), J({ t: "o", g: "ab", s: sdp }), J({ t: "x" }), J({ t: "a" }), J({ t: "a", s: 7 }), J({ t: "a", s: "<script>" }), J({ t: "a", s: "v=0" + "x".repeat(10000) })];
  expect("a word from the meeting point with anything wrong in it is dropped", badToHost.every(b => tgSignal(b, true) === null) && badToGuest.every(b => tgSignal(b, false) === null) && tgSignal(7, true) === null && tgSignal(null, false) === null, badToHost.map((b, i) => tgSignal(b, true) === null ? "" : "h" + i).join("") + badToGuest.map((b, i) => tgSignal(b, false) === null ? "" : "g" + i).join(""));
  {
    const fs = await import("node:fs"), srv = fs.readFileSync(new URL("../server/rooms.js", import.meta.url), "utf8"), page = fs.readFileSync(new URL("../js/together.js", import.meta.url), "utf8");
    expect("the meeting point and the page agree on what a room's code is", srv.includes("/^\\/room\\/([a-z2-9]{6,12})$/") && page.includes("/^[a-z2-9]{6,12}$/"));
  }
  const src = (await import("node:fs")).readFileSync(new URL("../js/shaders.js", import.meta.url), "utf8");
  expect("the scene shader has a line for each friend, and no more", src.includes("uniform vec4 uPe[" + TG_MAX + "];") && src.includes("uPe[" + (TG_MAX - 1) + "].w>0.0") && !src.includes("uPe[" + TG_MAX + "].w"));
}

// ---- doorways (js/doors.js)
{
  const { doorAhead, doorSpot, doorCross, doorBox, doorWrap, doorWorld } = doorsM, J = JSON.stringify;
  /* a made-up world: open space between two walls two units apart, at x = -1 and x = 1 */
  const slab = (x, y, z) => 1 - Math.abs(x);
  const F = [0, 0, 1], R = [1, 0, 0], Up = [0, 1, 0];
  const a = doorAhead(slab, [0, 0, 0], F, R, Up, 20);
  expect("a doorway is put ahead of the camera, facing it, in the clear", a && a.p[2] > 1 && Math.abs(a.p[0]) < 1e-9 && J(a.n) === J([-0, -0, -1]) && a.r > 0.2 && a.r <= 0.45 * slab(...a.p) + 1e-9 && a.r <= 0.3 * a.p[2] + 1e-9, J(a));
  expect("the ring is never bigger than the space round it allows", [[0.5, 0, 0], [-0.8, 3, 1], [0, 0, 7]].every(p => { const d = doorAhead(slab, p, F, R, Up, 20); return d && d.r <= 0.45 * slab(...d.p) + 1e-9; }));
  expect("facing a wall close to, it goes to one side where there is room, or nowhere", (() => { const d = doorAhead(slab, [0.9, 0, 0], [1, 0, 0], [0, 0, -1], Up, 20); return d === null || slab(...d.p) >= d.r / 0.45 - 1e-9; })());
  expect("inside something solid there is no doorway", doorAhead((x, y, z) => -1, [0, 0, 0], F, R, Up, 20) === null);
  expect("the way to a ring is clear along the open slab", doorsM.doorClear(slab, [0, 0, 0], [0, 0, 5], 0.2) === true);
  expect("and not clear through the slab's wall", doorsM.doorClear(slab, [0, 0, 0], [5, 0, 0], 0.2) === false);
  let sd = 5; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  const sp = doorSpot(slab, [8, 8, 8], rnd);
  expect("the far end is the most open place found, with a ring that fits it", sp && Math.abs(sp.q[0]) < 0.2 && Math.abs(sp.r - 0.45 * slab(...sp.q)) < 1e-12 && sp.q.every(x => Math.abs(x) <= 4), J(sp));
  expect("a world with no open space has no far end", doorSpot(() => -0.1, [8, 8, 8], rnd) === null);
  const n = [0, 0, -1];
  expect("flying through the ring is seen, either way", doorCross([0.1, 0, -0.2], [0.1, 0, 0.2], n, 0.5) && doorCross([0, 0.3, 0.1], [0, 0.3, -0.1], n, 0.5));
  expect("passing beside it, stopping short of it, or resting on it is not going through", !doorCross([0.6, 0, -0.2], [0.6, 0, 0.2], n, 0.5) && !doorCross([0, 0, -0.3], [0, 0, -0.1], n, 0.5) && !doorCross([0, 0, 0], [0, 0, 0], n, 0.5));
  expect("a place is taken to its nearest copy round the repeat", J(doorWrap([2.6, -2.6, 0.4], [5, 5, 1])) === J([-2.4, 2.4, 0.4]));
  const b = doorBox([0, 0, 4], 0.5, 1.15, 800, 600), S = Math.sqrt(800 * 600);
  expect("the part of the picture a ring ahead can show in is round the middle and holds all of it", Array.isArray(b) && b[0] < 400 - 0.55 * 1.15 / 4 * S / 2 && b[0] + b[2] > 400 + 0.55 * 1.15 / 4 * S / 2 && b[1] < 300 && b[1] + b[3] > 300 && b[2] < 400 && b[3] < 400, J(b));
  expect("it is the whole picture when the camera is at the ring, and nothing when the ring is behind or off to one side", doorBox([0, 0, 0.3], 0.5, 1.15, 800, 600) === "all" && doorBox([0, 0, -4], 0.5, 1.15, 800, 600) === null && doorBox([40, 0, 4], 0.5, 1.15, 800, 600) === null);
  expect("the part is kept inside the picture", (() => { const c = doorBox([1.2, -0.9, 3], 0.5, 1.15, 800, 600); return Array.isArray(c) && c[0] >= 0 && c[1] >= 0 && c[0] + c[2] <= 800 && c[1] + c[3] <= 600; })());
  expect("only a world with surfaces and a distance worked out here can have a doorway", doorWorld({ de() {} }) && !doorWorld({ de() {}, flat: true }) && !doorWorld({ de() {}, volume: true }) && !doorWorld({ de() {}, pack: true }) && !doorWorld({}) && !doorWorld(null));
  const fs = await import("node:fs"), sh = fs.readFileSync(new URL("../js/shaders.js", import.meta.url), "utf8"), pr = fs.readFileSync(new URL("../js/programs.js", import.meta.url), "utf8");
  expect("the scene shader's doorway uniforms are all asked for by name", ["uDoor", "uDoorN", "uDoorT", "uDoorC"].every(u => pr.includes('"' + u + '"')) && sh.includes("uniform vec4 uDoor,uDoorC;uniform vec3 uDoorN;uniform sampler2D uDoorT;"));
}

// ---- packing: how the worlds made of one shape repeated set their copies out (js/packing.js)
{
  const pk = await import("../js/packing.js"), { WORLDS } = await import("../js/worlds.js"), { tile } = await import("../js/dom.js"), sh = await import("../js/shaders.js"), { fragSource } = sh;
  const { pkBox } = pk.__dbg, packed = WORLDS.filter(w => w.packs), names = pk.PACKINGS.map(k => k.name);
  let sd = 5; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  expect("eight worlds are made of one shape repeated, and each has its shape both ways, its radius, its grid and two other kinds to be mixed with",
    packed.length === 8 && packed.every(w => typeof w.de === "function" && typeof w.sde === "function" && Array.isArray(w.shape) && w.rad > 0 && w.grid > 0 && !w.volume && !w.flat &&
      w.mix.length === 2 && w.mix.every(id => id !== w.id && packed.some(x => x.id === id)) && w.mix[0] !== w.mix[1]));
  expect("only those worlds' shaders carry the packing", WORLDS.every(w => (fragSource(w).indexOf("uniform float uPk,") >= 0) === !!w.packs));
  expect("the packings are these seven, the descent last", names.join() === "grid,scattered,nested,sponge,helix,shells,descent" && pk.PK_DEEP === 6);
  const g = pk.pkP(7.3, -2.1, 0.4, 3.4, 1.42);
  expect("the grid is the old one: a copy every P, each the mirror of its neighbour", pk.packing === 0 && g[3] === 0 && g[0] === tile(7.3, 3.4) && g[1] === tile(-2.1, 3.4) && g[2] === tile(0.4, 3.4) && pk.pkD(0.37) === 0.37);
  const pers = names.map((_, i) => (pk.setPackingNow(i), pk.pkPer(1).map(v => Math.round(v * 100) / 100).join()));
  expect("each packing's period, for a grid of 1", pers.join(" ") === "2,2,2 8,8,8 8,8,8 9,9,9 4,4,3 3.2,3.2,3.2 12,12,12", pers.join(" "));
  expect("what is sized by the period is sized alike in every packing", names.every((_, i) => (pk.setPackingNow(i), Math.abs(Math.min(...packed[0].period(0)) / 2 / pk.pkMul(packed[0]) - packed[0].grid) < 1e-9)) && pk.pkMul(WORLDS[0]) === 1);
  const bad = [];
  // the three packings worked out from boxes: what a box holds stays inside it, clear of its walls by the gap, and the boxes come in the sizes the packing has
  for (let mode = 1; mode < 4; mode++) {
    pk.setPackingNow(mode);
    const o = new Array(14), sizes = {}; let out = 0, empty = 0;
    for (let i = 0; i < 3000; i++) {
      const P = 3.4; pkBox(rnd() * 80 - 40, rnd() * 80 - 40, rnd() * 80 - 40, P, o);
      sizes[o[11] / P] = 1; empty += o[5];
      for (let k = 0; k < 3; k++) if (Math.abs(o[k] - o[8 + k]) + o[3] > 0.5 * o[11] - pk.PK_GAP * P + 1e-9) out++;
    }
    if (out) bad.push(names[mode] + ": " + out + " copies reach their box's walls");
    if (Object.keys(sizes).sort().join() !== ["1", "0.5,1,2", "1,3"][mode - 1]) bad.push(names[mode] + ": box sizes " + Object.keys(sizes).sort().join());
    if (!(mode === 3 ? empty > 900 && empty < 1500 : empty > 150 && empty < 750)) bad.push(names[mode] + ": " + empty + " of 3000 boxes empty");
  }
  // every packing, with the shapes of one kind and together, then mixed and in a wave
  for (const opt of [[false, false], [true, true]]) {
    pk.setPkWave(opt[0]); pk.setPkMix(opt[1]); pk.pkTick(123.4);
    for (let mode = 1; mode < names.length; mode++) {
      pk.setPackingNow(mode);
      for (const w of packed) {
        const per = w.period(0), tag = names[mode] + (opt[1] ? " mixed, wave " : " ") + w.id; let np = 0, over = 0, low = 0, thru = 0, kinds = {};
        for (let i = 0; i < 300; i++) {
          const x = rnd() * 60 - 30, y = rnd() * 60 - 30, z = rnd() * 60 - 30, m = rnd() * 2 - 1;
          pk.setPkPlain(false); const a = w.de(x, y, z, m);
          pk.setPkPlain(true); const p = w.de(x, y, z, m);
          kinds[pk.pkP(x, y, z, w.grid, 1, 1, 1, m)[4]] = 1;
          if (mode < pk.PK_DEEP) { // it repeats exactly
            pk.setPkPlain(false); const b = w.de(x + per[0], y - 2 * per[1], z + 3 * per[2], m);
            pk.setPkPlain(true); const p2 = w.de(x - per[0], y + per[1], z, m);
            if (Math.abs(a - b) > 1e-6 || Math.abs(p - p2) > 1e-6) np++;
          } else if (Math.abs(w.de(3 * x, 3 * y, 3 * z, m) - 3 * p) > 1e-6 * (1 + Math.abs(p)) || Math.abs(w.de(x / 9, y / 9, z / 9, m) - p / 9) > 1e-6 * (1 + Math.abs(p))) np++; // the descent is the same three times larger
          if (mode < 4 && p > a + 1e-9 && a < 0.5 * w.grid - 1e-9) over++; // the shader's answer may pass JavaScript's only where JavaScript stops at half a grid step
          if (mode > 3 && Math.abs(p - a) > 1e-12) over++; // where there are no boxes the two answer alike
          if (a > 0 && p <= 0) low++;
          // a step as long as the shader's distance, any way, must not end inside a shape
          if (p > 0.02) for (let t = 0; t < 3; t++) {
            let u = rnd() * 2 - 1, f = rnd() * 6.2831853, r = Math.sqrt(1 - u * u), q = w.de(x + p * r * Math.cos(f), y + p * r * Math.sin(f), z + p * u, m);
            if (q < -0.03 * Math.max(1, p)) thru++;
          }
        }
        if (np || over || low || thru) bad.push(tag + ": " + np + " not repeating, " + over + " where the shader's distance and the open space disagree, " + low + " where it is inside and the open space is not, " + thru + " steps that end inside a shape");
        if (opt[1] && Object.keys(kinds).sort().join() !== "0,1,2") bad.push(tag + ": kinds " + Object.keys(kinds).join());
        if (!opt[1] && Object.keys(kinds).join() !== "0") bad.push(tag + ": kinds " + Object.keys(kinds).join());
      }
    }
  }
  pk.setPkPlain(false); pk.setPkWave(false); pk.setPkMix(false); pk.setPackingNow(0);
  expect("in each packing every copy keeps inside its box, the worlds repeat exactly (the descent three times larger), a step as long as the shader's distance never ends in a shape, and mixed shapes are of three kinds", bad.length === 0, bad.join("; "));
  expect("a packing that is not in the list is the grid", (pk.setPackingNow(9), pk.packing) === 0 && (pk.setPackingNow(-1), pk.packing) === 0);
  // the wave: together, a copy's morph is the morph; in a wave it is the morph of some seconds ago
  const T = 77.7, mAt = t => Math.sin(t * 0.09) + 0.15 * Math.sin(t * 0.31);
  pk.pkTick(T);
  expect("together, every copy is at the morph's own point", pk.pkMo(0.321, 12) === 0.321);
  pk.setPkWave(true);
  expect("in a wave, a copy is where the morph was that many seconds ago", [0, 3.3, 17.5, 35].every(f => Math.abs(pk.pkMo(9, f) - mAt(T - f)) < 1e-12));
  pk.setPkWave(false);
  // the descent: the camera is kept between two distances from the centre, and its surroundings measured by one number
  const cp = [0.3, -0.2, 0.1];
  expect("a camera near the centre of the descent is moved three times as far out, one far out a third as far, and one between is left", pk.pkJump(cp, 2) === 3 && Math.abs(cp[0] - 0.9) < 1e-12 &&
    (cp[0] = 0, cp[1] = 9.5, cp[2] = 0, Math.abs(pk.pkJump(cp, 2) - 1 / 3) < 1e-12) && Math.abs(cp[1] - 9.5 / 3) < 1e-12 && pk.pkJump(cp, 2) === 1 && pk.pkJump([0, 0, 0], 2) === 1);
  expect("and the stretch runs from 1 to 3 across that range", Math.abs(pk.pkZoom([0, 3, 0], 2) - 1) < 1e-12 && Math.abs(pk.pkZoom([0, 0, 8.999], 2) - 2.99967) < 1e-4);
  // the programs: mixed shapes put three shapes in a world's shader, and chrome is in it only when asked for
  const jl = packed.find(w => w.id === "julia"), plain = fragSource(jl);
  pk.setPkMix(true); const mixed = fragSource(jl); pk.setPkMix(false);
  sh.setChrome(true); const chr = fragSource(jl), chrCloud = fragSource(WORLDS.find(w => w.volume && !w.flat)); sh.setChrome(false);
  expect("a mixed world's shader holds its own shape and two others, a plain one only its own", plain.indexOf("float sh0(") > 0 && plain.indexOf("float sh1(") < 0 && mixed.indexOf("float sh2(") > 0 && mixed.indexOf("SHAPE") < 0);
  expect("the chrome surface is in the shaders only while it is in use, and never in a cloud world's", plain.indexOf("#define CHROME") < 0 && chr.indexOf("#define CHROME") > 0 && chrCloud.indexOf("#define CHROME") < 0);
}
// ---- fly together: the connection report
{
  const { tgAddr, tgCand, tgCands, tgCount, tgSplit, tgVerdict } = togetherM;
  const sdp = "v=0\r\na=candidate:1 1 udp 2113937151 abcd-12.local 50000 typ host\r\na=candidate:2 1 UDP 1677729535 203.0.113.7 40001 typ srflx raddr 0.0.0.0 rport 0\r\na=candidate:3 1 udp 1677729535 203.0.113.7 40002 typ srflx raddr 0.0.0.0 rport 0\r\na=candidate:4 1 tcp 1518280447 192.168.1.5 9 typ host tcptype active\r\n";
  const L = tgCands(sdp), one = L.slice(0, 2);
  expect("a description's ways of being reached are read: kind, protocol, address and port", L.length === 4 && L[1].typ === "srflx" && L[1].proto === "udp" && L[1].addr === "203.0.113.7" && L[1].port === 40001 && tgCand("nonsense") === null && tgCands(null).length === 0);
  expect("they are counted by kind", tgCount(L) === "2 host, 2 srflx" && tgCount([]) === "none");
  expect("one outside address with two ports is the sign of a network that cannot be met directly; with one port it is not", tgSplit(L) && !tgSplit(one));
  const c = (typ, port, from) => ({ typ, proto: "udp", addr: typ === "host" ? "x.local" : "136.62.0.1", port, from: from || 0 });
  expect("three ports on the device, each with its own outside port, are not that sign; one port seen as two is", !tgSplit([c("host", 1), c("host", 2), c("host", 3), c("srflx", 1), c("srflx", 2), c("srflx", 3)]) && !tgSplit([c("host", 1), c("host", 2), c("srflx", 1, 1), c("srflx", 2, 2)]) && tgSplit([c("host", 1), c("host", 2), c("srflx", 7, 1), c("srflx", 8, 1)]) && tgCand("candidate:2 1 udp 1 203.0.113.7 40001 typ srflx raddr 10.0.0.2 rport 5555").from === 5555);
  expect("addresses in the report are shortened and named by kind", tgAddr("203.0.113.7") === "203.0.x.x (public)" && tgAddr("192.168.1.5") === "192.168.x.x (private)" && tgAddr("100.72.3.4") === "100.72.x.x (carrier's shared range)" && tgAddr("abcd-12.local") === "hidden name" && tgAddr("2001:db8:1:2::3").indexOf("2001:db8:x") === 0 && tgAddr("") === "none");
  expect("a failure is put down to the side with no outside address, or to the network that splits its ports", /^This side never/.test(tgVerdict([L[0]], one)) && /^The other side never learned/.test(tgVerdict(one, [L[0]])) && /the other network gives a different outside port/.test(tgVerdict(one, L)) && /this network gives a different outside port/.test(tgVerdict(L, one)) && /never arrived/.test(tgVerdict(one, [])) && /^Both sides learned an outside address and neither/.test(tgVerdict(one, one)));
}
// ---- strange doorways, ribbons, lens blur and loops
{
  const { doorLieTurn, doorTurn, doorUnturn, doorSmall, DOOR_SMALL, DOOR_LIES } = doorsM, { __dbg: rb } = await import("../js/ribbons.js"), { __dbg: lp } = await import("../js/lap.js");
  const { fragSource } = await import("../js/shaders.js"), { WORLDS } = worldsM;
  const near = (a, b, e) => a.every((x, i) => Math.abs(x - b[i]) < (e || 1e-9)), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const n = [0.6, 0, 0.8], right = [0.8, 0.3, -0.6], v = [0.3, -0.7, 0.2];
  const det = T => T[0] * (T[4] * T[8] - T[5] * T[7]) - T[1] * (T[3] * T[8] - T[5] * T[6]) + T[2] * (T[3] * T[7] - T[4] * T[6]);
  const over = doorLieTurn("over", n, right), mir = doorLieTurn("mirror", n, right);
  expect("a strange doorway's turn leaves the way the ring faces as it is, whichever kind", near(doorTurn(over, n), n) && near(doorTurn(mir, n), n) && doorLieTurn("small", n, right) === null && near(doorTurn(null, v), v));
  expect("upside down is half a turn (twice is nothing, no mirroring), and mirrored swaps the hands", near(doorTurn(over, doorTurn(over, v)), v) && Math.abs(det(over) - 1) < 1e-9 && Math.abs(det(mir) + 1) < 1e-9 && near(doorTurn(mir, doorTurn(mir, v)), v));
  expect("a turn and the turn that undoes it give the place back, and lengths are kept", near(doorTurn(doorUnturn(over), doorTurn(over, v)), v) && Math.abs(Math.hypot(...doorTurn(mir, v)) - Math.hypot(...v)) < 1e-9 && doorUnturn(null) === null);
  // a wall across the way ahead: z = -3 (the ring faces +z, so onward is -z)
  const wall = (x, y, z) => z + 3, far = doorSmall(wall, [0, 0, 0], [0, 0, 1], 0.5, 6);
  expect("a small doorway's far end is straight on, close to the surface, with room for a ring about " + DOOR_SMALL + " of the size", !!far && Math.abs(far.q[0]) < 1e-9 && far.q[2] < -2.7 && wall(...far.q) > 0 && far.s > 0.05 && far.s < 0.2 && Math.abs(0.45 * wall(...far.q) / 0.5 - far.s) < 1e-9);
  expect("with nothing within reach there is none", doorSmall(wall, [0, 0, 0], [0, 0, 1], 0.5, 2) === null && DOOR_LIES.length === 3);
  // ribbons
  const list = [], per = [4, 4, 4];
  rb.rbAdd(list, [0, 0, 0], 0.5, 4, per); rb.rbAdd(list, [0.2, 0, 0], 0.5, 4, per); rb.rbAdd(list, [0.6, 0, 0], 0.5, 4, per);
  expect("a ribbon takes a new point only when the camera has gone a step, newest first", list.length === 2 && list[0].p[0] === 0.6 && Math.abs(list[0].d - 0.6) < 1e-9);
  rb.rbAdd(list, [1.2, 0, 0], 0.5, 4, per); rb.rbAdd(list, [1.8, 0, 0], 0.5, 4, per); rb.rbAdd(list, [-1.7, 0, 0], 0.5, 4, per);
  expect("it keeps no more points than it may, and a step across the world's edge is the short step it is", list.length === 4 && list[0].p[0] === -1.7 && Math.abs(list[0].d - 0.5) < 1e-9);
  const out = new Float32Array(4 * 6); rb.rbFill(out, 1, 5, list, null, [-1.6, 0, 0], per, 45);
  expect("each point is drawn at its copy nearest the camera, and the line runs on through the world's edge", Math.abs(out[4] + 1.7) < 1e-6 && Math.abs(out[8] + 2.2) < 1e-6 && out[7] > 0 && out[11] > 0 && out[0] === 0 && out[3] === 0);
  expect("the last point ends the line, and the brightness falls along it", out[4 * 4 + 3] < 0 && out[7] > out[11] && out[11] > -out[19] && out[23] === 0);
  rb.rbFill(out, 1, 5, list, null, [0.1, 0, 0], per, 45); // from here the newest point's nearest copy is across the world from the next one's
  expect("where two points' nearest copies are different copies of the world, no line joins them", out[7] < 0 && Math.abs(out[4] + 1.7) < 1e-6 && Math.abs(out[8] - 1.8) < 1e-6 && out[11] > 0);
  rb.rbAdd(list, [0.5, 1.9, 0], 0.2, 4, per);
  expect("a jump is not a flight: the ribbon starts again", list.length === 1);
  const src = fragSource(WORLDS[0]);
  expect("the scene shader has room for every ribbon point, and a friend's ribbon for each friend", src.includes("uniform vec4 uRb[" + rb.RB_N + "];") && rb.RB_PEERS === togetherM.TG_MAX && rb.RB_N === rb.RB_OWN + rb.RB_PEERS * rb.RB_PEER);
  // lens blur
  const ball = (x, y, z) => Math.hypot(x, y, z - 5) - 1;
  expect("the lens is sharp at the depth of what is straight ahead, and has no depth to give when nothing is", Math.abs(stillM.lensFocus(ball, [0, 0, 0], [0, 0, 1], 20) - 4) < 0.02 && stillM.lensFocus(ball, [0, 0, 0], [0, 1, 0], 20) === 0);
  expect("the scene shader takes the lens, and lens blur starts off", src.includes("uniform vec3 uLens;") && stillM.LENS[0].a === 0 && stillM.LENS.length === 3);
  // loops: a world of balls on a grid of 2, with clear ways between them
  const balls = (x, y, z) => { const f = c => c - 2 * Math.round(c / 2); return Math.hypot(f(x), f(y), f(z)) - 0.6; };
  let sd = 3; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  expect("a straight way that meets a shape is not clear, and one between the shapes is, by the room it has", lp.lapClear(balls, [0, 0, -1], [0, 0, 2], 0.01) === null && Math.abs(lp.lapClear(balls, [1, 1, 0], [0, 0, 2], 0.01).min - (Math.SQRT2 - 0.6)) < 1e-6);
  const ln = lp.lapLine(balls, [2, 2, 2], [0.1, 0.1, 0.3], [0.2, -0.1, -0.9], rnd, 0.02, 24);
  expect("the loop found is a clear way one whole repeat long, along the axis the camera faces most", !!ln && ln.k[2] === -1 && ln.k[0] === 0 && ln.min > 0.5 && !!lp.lapClear(balls, ln.a, [0, 0, -2], ln.min - 1e-9));
  expect("and where every way is blocked there is none", lp.lapLine((x, y, z) => 0.001, [2, 2, 2], [0, 0, 0], [0, 0, 1], rnd, 0.02, 8) === null);
  const P = [2, 3, 4], line = { kind: "line", a: [0.1, -0.2, 0.3], k: [0, 0, 1], up: [0, 1, 0], rolls: 1, sway: 1 }, a0 = lp.lapPose(line, 0, P), a1 = lp.lapPose(line, 1, P), ah = lp.lapPose(line, 0.5, P);
  const wrapd = (a, b) => a.map((x, i) => { const d = x - b[i]; return d - P[i] * Math.round(d / P[i]); });
  expect("a straight loop ends at a copy of its start, facing and rolled as it began, and is half a repeat on halfway", near(wrapd(a0.pos, a1.pos), [0, 0, 0], 1e-9) && near(a0.F, a1.F, 1e-6) && near(a0.Up, a1.Up, 1e-6) && Math.abs(Math.abs(wrapd(ah.pos, a0.pos)[2]) - 2) < 1e-9 && near(ah.Up, [0, -1, 0], 1e-6));
  const ring = { kind: "ring", c: [1, 2, 3], rad: 0.5, e1: [1, 0, 0], e2: [0, 0, 1] }, r0 = lp.lapPose(ring, 0, P), rq = lp.lapPose(ring, 0.25, P), r1 = lp.lapPose(ring, 1, P);
  expect("a circle comes round to its start, always the same way from its middle and facing along itself", near(r0.pos, [1.5, 2, 3], 1e-6) && near(rq.pos, [1, 2, 3.5], 1e-6) && near(rq.F, [-1, 0, 0], 1e-6) && near(r0.pos, r1.pos, 1e-6) && near(r0.F, r1.F, 1e-6) && Math.abs(dot(rq.F, rq.Up)) < 1e-6);
  const deep = { kind: "deep", e: [0.048, 0.032, 1], grid: 3, F0: [0, 0, -1], up: [0, 1, 0], rolls: 1, sway: 0 }, d0 = lp.lapPose(deep, 0, P), d1 = lp.lapPose(deep, 1, P);
  expect("the descent's loop ends a third as far from the centre as it began, facing the same way", near(d1.pos.map(x => 3 * x), d0.pos, 1e-9) && near(d0.F, d1.F, 1e-6) && near(d0.Up, d1.Up, 1e-6) && Math.abs(d0.pos[2] - 13.5) < 1e-9);
  expect("the pulse that stands in for the music is soft, the same at a lap's end as at its start, and absent when asked", Math.abs(lp.lapBeat(0, 8) - lp.lapBeat(1, 8)) < 1e-9 && lp.lapBeat(0, 8) <= 0.5 && lp.lapBeat(0.0625, 8) < 1e-9 && lp.lapBeat(0.3, 0) === 0);
}
// ---- inside out, the light wave, light shafts, photo mode, postcards and the QR code
{
  const { __dbg: wd } = await import("../js/worlds.js"), { __dbg: lw } = await import("../js/lightwave.js"), { __dbg: ph } = await import("../js/photo.js"), { __dbg: qr } = await import("../js/qr.js");
  const sh = await import("../js/shaders.js"), { WORLDS } = wd;
  // inside out: a made-up world of balls of radius 0.5 on a grid of 2, whose most open place is sqrt(3) - 0.5 from a ball
  const f = c => c - 2 * Math.round(c / 2), toy = { id: "toytest", period: () => [2, 2, 2], de0: (x, y, z) => Math.hypot(f(x), f(y), f(z)) - 0.5 };
  expect("with inside out off a world's distance is its own", wd.inShell(toy) === 0 && Math.abs(wd.inDe(toy, 1, 1, 1, 0) - (Math.sqrt(3) - 0.5)) < 1e-12);
  wd.setInOutNow(true);
  const c = wd.inShell(toy);
  expect("the shell is a fixed part of the most open space the world has", c > 0.2 && c <= wd.IN_PART * (Math.sqrt(3) - 0.5) + 1e-12 && wd.inShell(toy) === c);
  expect("inside out, the old shapes are open, the old open space is wall, and the wall stands the shell's width from the shapes", wd.inDe(toy, 0, 0, 0, 0) === c * wd.IN_STEP && wd.inDe(toy, 1, 1, 1, 0) === 0 && Math.abs(wd.inDe(toy, 0.5 + c / 2, 0, 0, 0) - (c / 2) * wd.IN_STEP) < 1e-12);
  expect("it is not made in a cloud, zoom or pack world", wd.inShell({ id: "v", volume: true, de0: () => 1, period: () => [2, 2, 2] }) === 0 && wd.inShell({ id: "p", pack: true, de0: () => 1, period: () => [2, 2, 2] }) === 0 && wd.inShell({ id: "n", period: () => [2, 2, 2] }) === 0);
  wd.setInOutNow(false);
  const surf = WORLDS.find(w => !w.volume && !w.flat && !w.packs), cloud = WORLDS.find(w => w.volume && !w.flat), plain = sh.fragSource(surf);
  expect("a world with surfaces is drawn through the swap, taken short by the same part as the script's, and a cloud world is not", plain.includes("#define map map0") && plain.includes("(uInv-max(d,0.0))*" + wd.IN_STEP.toFixed(2)) && !sh.fragSource(cloud).includes("map0"));
  sh.setShafts(true); const beams = sh.fragSource(surf), beamsCloud = sh.fragSource(cloud); sh.setShafts(false);
  expect("the light shafts are in the shaders only while in use, and never in a cloud world's", !plain.includes("#define SHAFTS") && beams.includes("#define SHAFTS") && !beamsCloud.includes("#define SHAFTS") && plain.includes("uniform vec3 uLwR,uLwA;") && plain.includes("uniform float uExp;"));
  // the light wave
  const r = [0, 0, 0], st = { since: 9, was: 0 };
  expect("a wave starts when the beat rises, and not again while the beat stays up or too soon after", lw.lwStep(r, st, 0.9, 0.05, 10) && r[0] > 0 && !lw.lwStep(r, st, 0.9, 0.05, 10) && (st.was = 0, !lw.lwStep(r, st, 0.9, 0.05, 10)) && r[1] === 0);
  st.was = 0; st.since = lw.LW_GAP;
  expect("a second starts once the gap has passed, and each runs out and ends at the limit of sight", lw.lwStep(r, st, 0.9, 0.05, 10) && r[1] > 0 && r[0] > r[1] && (lw.lwStep(r, st, 0, lw.LW_TIME, 10), r[0] === 0 && r[1] === 0));
  expect("a quiet beat starts none, and at most three are out at once", (st.was = 0, st.since = 9, !lw.lwStep(r, st, lw.LW_BEAT - 0.01, 0.05, 10)) && [0, 1, 2, 3].map(() => { st.was = 0; st.since = 9; return lw.lwStep(r, st, 1, 0.01, 10); }).join() === "true,true,true,false");
  expect("a wave shows nothing at the camera or at the end, and most part of the way out", lw.lwBright(0) === 0 && lw.lwBright(0.02) === 0 && lw.lwBright(1) === 0 && lw.lwBright(0.3) > 0.6 && lw.lwBright(0.3) > lw.lwBright(0.1) && lw.lwBright(0.3) > lw.lwBright(0.8) && lw.LW_GAP >= 0.5);
  // photo mode
  expect("a slider in the middle changes nothing, and its ends are a number and one over it", ph.photoGain(0, 4) === 1 && Math.abs(ph.photoGain(100, 4) - 4) < 1e-12 && Math.abs(ph.photoGain(-100, 4) - 0.25) < 1e-12 && ph.photoGain(999, 4) === ph.photoGain(100, 4));
  expect("outside photo mode the picture is as it was", ph.photoFov() === 1 && ph.photoExp() === 1 && ph.photoFocus() === 1 && ph.photoKey() === "");
  // postcards
  expect("a spot's code is set out in fours for reading, and read back with spaces and capitals as typed", ph.cardSpaced("julia-0123456789abcdefgh") === "julia-0123 4567 89ab cdef gh" && ph.cardCode(" Julia-0123 4567 89AB cdef gh ") === "julia-0123456789abcdefgh" && ph.cardCode("https://example.org/x/#julia-0123456789abcdef") === "julia-0123456789abcdef");
  expect("anything that is not a world's name, a hyphen and 16 to 18 letters and digits is no code", ["", "julia", "julia-0123", "julia-0123456789abcdefghi", "ju1ia-0123456789abcdef", "julia-0123456789abcde!", "<b>-0123456789abcdef", "flight=abc", 7, null].every(t => ph.cardCode(t) === ""));
  // the QR code
  const q = qr.qrMake("https://example.org/MirrorFold/#julia-0123456789abcdefgh"), at = (x, y) => q.m[y * q.n + x];
  expect("the check bytes are the standard's (its own worked example)", qr.qrCheck([32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17], 10).join() === "196,35,39,119,235,215,231,226,93,23");
  expect("a link to a spot fits a code of size 4 or 5, and a code holds what the standard says it does", (q.n === 33 || q.n === 37) && [1, 2, 3, 4, 5, 6, 7, 8, 9].map(qr.qrRoom).join() === "14,26,42,62,84,106,122,152,180");
  expect("it has the three corner squares, the dotted lines and the one dark square that is always there", [[0, 0], [q.n - 7, 0], [0, q.n - 7]].every(([x, y]) => at(x, y) && at(x + 6, y + 6) && !at(x + 1, y + 1) && at(x + 3, y + 3) && at(x + 2, y + 2)) && at(8, 6) && !at(9, 6) && at(6, 8) && at(8, q.n - 8) === 1);
  expect("text too long for the largest size, or with a letter that does not fit a byte, gives no code", qr.qrMake("x".repeat(181)) === null && qr.qrMake("世") === null && qr.qrMake(7) === null && qr.qrMake("x".repeat(180)).n === 53 && qr.qrMake("").n === 21);
}
// ---- what was playing, and passing things on
{
  const { __dbg: md } = await import("../js/media.js"), { __dbg: sn } = await import("../js/send.js"), { cleanMedia, cleanScene, mediaLine } = packs, J = JSON.stringify;
  expect("what was playing is kept as a kind, a line of text and numbers in range", J(cleanMedia({ kind: "file", title: " Weird\nFishes\u0000 ", at: 134.26, extra: "<b>" })) === J({ kind: "file", title: "Weird Fishes", at: 134.3 }) && J(cleanMedia({ kind: "built", seed: 77, at: 3 })) === J({ kind: "built", at: 3, seed: 77 }) && J(cleanMedia({ kind: "tap", bpm: 96.4 })) === J({ kind: "tap", bpm: 96 }) && J(cleanMedia({ kind: "file", title: "a", at: 1, video: { title: "v.mp4", at: 2 } }).video) === J({ at: 2, title: "v.mp4" }));
  expect("anything else in it is refused", [null, 7, [], {}, { kind: "radio" }, { kind: "file", at: -1 }, { kind: "file", at: "12" }, { kind: "file", at: 1e9 }, { kind: "built", seed: 0 }, { kind: "built", seed: 1.5 }, { kind: "built", seed: 5e9 }, { kind: "tap", bpm: 5 }, { kind: "file", video: 7 }, { kind: "file", video: { at: -3 } }].every(x => cleanMedia(x) === null));
  expect("a name is one line of at most 80 letters, and a name that is not text is none", mediaLine("x".repeat(200)).length === 80 && mediaLine(7) === "" && cleanMedia({ kind: "note", title: 7 }).title === undefined);
  const spot = "julia-0123456789abcdefgh";
  expect("a scene keeps what was playing, and a scene whose note of it is wrong is kept without it", J(cleanScene({ spot, media: { kind: "note", title: "A song", at: 5 } }).media) === J({ kind: "note", title: "A song", at: 5 }) && cleanScene({ spot, media: { kind: "<script>" } }).media === undefined && cleanScene({ spot, media: "x" }).spot === spot);
  expect("it reads as a name and a time, the built-in music by its number, a tapped tempo by its beats", md.mediaText({ kind: "note", title: "Weird Fishes", at: 134 }) === "Weird Fishes at 2:14" && md.mediaText({ kind: "built", seed: 77, at: 61 }) === "the built-in music, song 77 at 1:01" && md.mediaText({ kind: "tap", bpm: 96 }) === "music at 96 beats a minute" && md.mediaText({ kind: "tap", title: "A", at: 5, bpm: 96 }) === "A at 0:05, 96 beats a minute" && md.mediaText(null) === "" && md.mediaText({ kind: "file" }) === "");
  expect("a video playing beside the music is named too", md.mediaText({ kind: "file", title: "A", at: 5, video: { title: "clip", at: 70 } }) === "A at 0:05, with the video clip at 1:10");
  expect("in a file's name it is letters, digits and hyphens with the time, and nothing if there is nothing", md.mediaSlug({ kind: "note", title: "Radiohead: Weird Fishes / Arpeggi!", at: 134 }) === "radiohead-weird-fishes-arpeggi-2m14s" && md.mediaSlug({ kind: "built", seed: 77, at: 5 }) === "song-77-0m05s" && md.mediaSlug(null) === "" && md.mediaSlug({ kind: "file", title: "../../etc", at: 0 }) === "etc-0m00s" && /^[a-z0-9-]*$/.test(md.mediaSlug({ kind: "file", title: "\u00e9\u4e16 <x> " + "y".repeat(90), at: 9 })));
  expect("a file's name is shown without its folder or ending", md.mediaTitle("C:\\Music\\07 Weird Fishes.mp3") === "07 Weird Fishes" && md.mediaTitle("/a/b/song.final.flac") === "song.final" && md.mediaTitle("") === "");
  expect("Reddit's page is opened with the title and link as plain parts of the address", sn.sendReddit("A & B = <C>", "https://example.org/x/#julia-01") === "https://www.reddit.com/submit?title=A%20%26%20B%20%3D%20%3CC%3E&url=https%3A%2F%2Fexample.org%2Fx%2F%23julia-01" && sn.sendReddit("t", "") === "https://www.reddit.com/submit?title=t" && sn.sendReddit("x".repeat(500), "").length < 320);
}
// ---- the dancers: the count of beats, the figures' bodies, the moves, and that nothing jumps
{
  const { __dbg: dn } = await import("../js/dance.js"), { __dbg: mv } = await import("../js/moves.js");
  const hit = (t, per) => Math.exp(-5 * (t % per)), dt = 1 / 60, TAU = 2 * Math.PI;
  let bc = dn.makeBeatClock(), o, t, back = false, lastU = 0, errs = [];
  for (t = 0; t < 30; t += dt) { o = bc(dt, hit(t, 0.47)); if (o.u < lastU) back = true; lastU = o.u; if (t > 15 && (t % 0.47) < dt) errs.push(Math.abs(o.u - Math.round(o.u))); }
  expect("a steady pulse is counted at its own speed, each beat on a whole count, and the count never goes back", Math.abs(o.per - 0.47) < 0.012 && Math.max(...errs) < 0.12 && !back, o.per + " " + Math.max(...errs));
  bc = dn.makeBeatClock(); for (t = 0; t < 20; t += dt) o = bc(dt, hit(t, 0.94));
  const slow = o.per; bc = dn.makeBeatClock(); for (t = 0; t < 20; t += dt) o = bc(dt, hit(t, 0.25));
  expect("a pulse slower or quicker than a dance is counted as half or double", Math.abs(slow - 0.47) < 0.012 && Math.abs(o.per - 0.5) < 0.012, slow + " " + o.per);
  bc = dn.makeBeatClock(); for (t = 0; t < 10; t += dt) o = bc(dt, hit(t, 0.47)); const u0 = o.u; for (t = 0; t < 4.7; t += dt) o = bc(dt, 0);
  expect("with no hits the count runs on as it was", Math.abs(o.u - u0 - 10) < 0.2, String(o.u - u0));
  // every bone keeps its length whatever the pose, and no foot goes under the floor
  const J = new Array(51), F = new Array(35), len = (a, b) => Math.hypot(J[3 * a] - J[3 * b], J[3 * a + 1] - J[3 * b + 1], J[3 * a + 2] - J[3 * b + 2]); let sd = 5, worst = 0, under = 0, k, i;
  const rnd = () => (sd = sd * 16807 % 2147483647) / 2147483647;
  const bones = [[0, 1, dn.DN_SPINE], [0, 2, dn.DN_SHO], [0, 3, dn.DN_SHO], [2, 4, dn.DN_ARM], [4, 5, dn.DN_FORE], [3, 6, dn.DN_ARM], [6, 7, dn.DN_FORE], [1, 8, dn.DN_HIPW], [1, 9, dn.DN_HIPW], [8, 10, dn.DN_LEG], [10, 11, dn.DN_LEG], [9, 12, dn.DN_LEG], [12, 13, dn.DN_LEG], [11, 14, dn.DN_FOOT], [13, 15, dn.DN_FOOT], [0, 16, dn.DN_HEAD + dn.DN_NECK]];
  const check = p => { dn.danceBody(p, J); for (const [a, b, l] of bones) worst = Math.max(worst, Math.abs(len(a, b) - l)); under = Math.min(under, J[34], J[40], J[31], J[37], J[43], J[46]); };
  // (hands anywhere; feet anywhere a dancer's could be: with the hips at their lowest and a foot far behind, the knee would have to go through the floor)
  for (k = 0; k < 600; k++) check(mv.MV_REST.map((x, n) => n === 4 ? 7 * rnd() : n < 12 ? rnd() - 0.5 : n % 4 === 3 ? 2 * rnd() - 0.7 : n < 20 ? 1.4 * rnd() - 0.7 : n % 4 === 1 ? 0.6 * rnd() - 0.1 : 0.7 * rnd() - 0.35));
  const P = new Array(mv.MV_N); for (const m of mv.MOVES) for (k = 0; k < 20 * m.len; k++) { mv.movePose(m, k / 20, P); check(P); }
  expect("a figure's bones keep their length in every pose, and nothing goes under the floor", worst < 1e-9 && under > -1e-9, worst + " " + under);
  expect("there are more than a hundred moves, each with its own name, and each can be chosen at some fullness of the music", mv.MOVES.length > 100 && new Set(mv.MOVES.map(m => m.name)).size === mv.MOVES.length && mv.MOVES.every(m => m.lo || m.mid || m.hi) && ["lo", "mid", "hi"].every(q => mv.MOVES.filter(m => m[q]).length >= 10));
  const round = mv.MOVES.filter(m => { const a = [], b = []; mv.movePose(m, 0.3, a); mv.movePose(m, m.len + 0.3, b); return !(m.keys[0].t === 0 && [1, 2, 4, 8, 16].includes(m.len) && a.every((x, j) => Math.abs(x - b[j]) < 1e-6)); });
  expect("every move begins on a beat and comes round in its own length, a power of two up to sixteen beats", round.length === 0, round.map(m => m.name).join());
  // within a move, on its own at full size, no joint is asked to go faster than a person could at a quick tempo
  { let top = 0, who = ""; for (const m of mv.MOVES) { let prev = null; const mem = [0, 0, 0, 0, 0, 0]; for (k = 0; k <= 60 * 0.4 * m.len * 2; k++) { mv.movePose(m, k / (60 * 0.4), P); dn.danceBody(P, J, mem, 1 / 6); if (prev) for (i = 0; i < 51; i++) { const v = Math.abs(J[i] - prev[i]) * 60; if (v > top) { top = v; who = m.name; } } prev = J.slice(); } }
    expect("no move asks a joint to go faster than seven figure heights a second at 150 beats a minute", top < 7, top.toFixed(1) + " in " + who); }
  const fl = mv.MV_REST.slice(); fl[0] = 0.1; fl[12] = 0.4; fl[21] = 0.2; mv.flipPose(fl); dn.danceBody(fl, J); const jl = J.slice(); mv.flipPose(fl); dn.danceBody(fl, J);
  expect("a pose turned to face the other way is the same body with left and right exchanged", [[2, 3], [5, 7], [11, 13], [1, 1], [16, 16]].every(([a, b]) => Math.abs(J[3 * a] + jl[3 * b]) < 1e-9 && Math.abs(J[3 * a + 1] - jl[3 * b + 1]) < 1e-9 && Math.abs(J[3 * a + 2] - jl[3 * b + 2]) < 1e-9));
  const near = mv.MV_REST.slice(); near[14] = 0.3; near[12] = 0.1; near[13] = 0; dn.danceFlat(dn.danceBody(near, J), F);
  expect("the figure faces the viewer, its left on the viewer's right, and a hand held out toward the viewer looks larger", J[6] > 0 && J[9] < 0 && J[17] > 0.25 && Math.abs(F[10]) > Math.abs(J[15]) && F[34] > 0.99);
  expect("a move is chosen from those fit for the music, and never the one in hand", [0.2, 0.7, 1.2].every((e, n) => [0, 0.3, 0.6, 0.999].every(r => { const j = dn.pickMove(e, 1, r); return j !== 1 && mv.MOVES[j][["lo", "mid", "hi"][n]]; })));
  // a whole night out: silence, music, a great change, a drop, quiet again. No joint may move faster than a dancer could.
  const { sel, OVERLAYS } = await import("../js/state.js"), was = sel.ovi, rand = Math.random; let fast = 0, still0 = 0, moved = 0, high = 0, prev = null;
  dn.danceTick = dn.makeBeatClock();
  const run = (secs, f) => { for (let n = 0; n < secs * 60; n++) { f(n / 60); for (i = 0; i < dn.crowd.length; i++) { J.splice(0, 51, ...dn.crowd[i].b); if (prev && prev[i]) for (k = 0; k < 51; k++) fast = Math.max(fast, Math.abs(J[k] - prev[i][k]) * 60); (prev = prev || [])[i] = J.slice(); } } };
  sel.ovi = OVERLAYS.findIndex(v => v.dance === 3); Math.random = rnd;
  dn.stepDance({ dt, bt: 0, mp: 0 }); // sets the five up
  expect("a crowd has all three manners and several kinds of head, and a figure's number tells its head", dn.DN_MANNERS.every(mn => dn.crowd.some(d => d.ch === mn)) && new Set(dn.crowd.map(d => d.id % dn.DN_LOOKS)).size >= 6 && new Set(dn.crowd.map(d => d.id)).size === dn.crowd.length && (await import("../js/shaders.js")).FS_TRAIL.includes("const int DN=" + dn.DN_MAX + ";uniform vec4 uD0[DN]") && (await import("../js/shaders.js")).FS_TRAIL.includes("mod(id," + dn.DN_LOOKS + ".0)"));
  { const seen = [new Set(), new Set(), new Set()]; for (let n = 0; n < 600; n++) dn.DN_MANNERS.forEach((mn, q) => seen[q].add(dn.pickFace(mn, (n + 0.5) / 600)));
    const face = [dn.dnU[9][1], dn.dnU[9][2]];
    expect("every manner can make every face, a face has a mouth of some width, and the shader is handed whole steps and a part", seen.every(s2 => s2.size === dn.DN_FACES.length) && dn.DN_FACES.every(f => f.w >= 0.05 && f.w <= 0.5 && f.c >= 0 && f.c < 1 && f.p.length === 3) && face.every(v => v >= 0 && v < 256), JSON.stringify(face)); }
  expect("the dance floor has a crowd of eight to twelve figures, the chorus line four and the dancer one, all inside the picture, the party has twenty places, and the shader has room for twenty, or for as few as twelve on a chip with less room", dn.crowd.length >= 8 && dn.crowd.length <= 12 && dn.DN_MAX === 20 && (await import("../js/shaders.js")).FS_TRAIL.includes("uD8[DN]") && (await import("../js/shaders.js")).trailFor(12).includes("const int DN=12;") && (await import("../js/shaders.js")).trailSource("ln=1.0;", 17).includes("const int DN=17;") && (dn.setDanceRoom(3), dn.dnRoom === 12) && (dn.setDanceRoom(17.9), dn.dnRoom === 17) && (dn.setDanceRoom(400), dn.dnRoom === 20) && [1, 2, 3, 4].every(kd => [0.46, 1, 1.78, 2.4].every(asp => { const sp = dn.danceSpots(kd, asp); return sp.length === [0, 1, 4, 12, 20][kd] && sp.every(q => Math.abs(q[0]) + 0.3 * q[2] <= 0.5 * Math.max(1, asp) + 1e-9 && q[1] + q[2] < 0.5); })));
  const hand = () => { dn.danceBody(dn.crowd[0].p, J); return [J[15], J[16], J[17]]; };
  run(4, tt => dn.danceStep(dt, 0, 0, 0, false, false, false, tt)); const quiet = hand(); still0 = Math.abs(quiet[1] - (dn.DN_HIP + dn.DN_SPINE - 0.31)) + Math.abs(J[4] - dn.DN_HIP);
  run(60, tt => { dn.danceStep(dt, hit(tt, 0.47), 0, 0.8, false, tt > 6 && tt < 6 + dt, false, 4 + tt); const h = hand(); moved = Math.max(moved, Math.hypot(h[0] - quiet[0], h[1] - quiet[1], h[2] - quiet[2])); });
  run(3, tt => { dn.danceStep(dt, hit(tt, 0.47), 0, 1, tt < dt, false, false, 64 + tt); dn.danceBody(dn.crowd[0].p, J); high = Math.max(high, Math.min(J[34], J[40])); });
  run(8, tt => dn.danceStep(dt, 0, 0, 0.1, false, false, false, 67 + tt)); const after = hand();
  expect("in silence a figure stands with its arms down, and with a beat it dances", still0 < 0.05 && moved > 0.15, still0 + " " + moved);
  expect("at a drop the figures leave the floor, and come down again", high > 0.08 && Math.min(J[34], J[40]) < 0.01 && Math.max(J[34], J[40]) < 0.07, String(high)); // afterward a foot is on the floor, and the other no higher than a step lifts it
  expect("when the music goes quiet they stop dancing, and their arms hang again", dn.crowd.every(d => d.a < 0.05) && Math.abs(after[1] - quiet[1]) < 0.06, String(after[1] - quiet[1]));
  { // a voice talking: sound that comes and goes, but not evenly. The clock is not sure of it, and nobody dances; they wait or walk about.
    const talk = []; let at = 0.3; while (at < 90) { talk.push(at); at += 0.26 + 0.7 * rnd(); }
    const say = tt => { let v = 0; for (const h of talk) if (tt >= h && tt < h + 0.5) v = Math.max(v, Math.exp(-7 * (tt - h))); return v; };
    let bc2 = dn.makeBeatClock(), sum = 0, cnt = 0, top = 0, o2;
    for (let tt = 0; tt < 90; tt += dt) { o2 = bc2(dt, say(tt)); sum += o2.sure; cnt++; }
    bc2 = dn.makeBeatClock(); for (let tt = 0; tt < 12; tt += dt) o2 = bc2(dt, hit(tt, 0.47)); const sureBeat = o2.sure;
    for (let tt = 0; tt < 6; tt += dt) o2 = bc2(dt, 0);
    { // bass lines that leave the beat: the clock keeps a beat it has found
      const line = (steps, T) => { const h = []; for (let b = 0; b < T / 0.5 / 4; b++) for (const st2 of steps) h.push((b * 4 + st2) * 0.5 + (rnd() - 0.5) * 0.02); return h; };
      const share = h => { const bc3 = dn.makeBeatClock(); let j = 0, on = 0, n = 0, o3; for (let tt = 0; tt < 90; tt += dt) { while (j < h.length - 1 && h[j + 1] <= tt) j++; o3 = bc3(dt, tt >= h[j] ? Math.exp(-7 * (tt - h[j])) : 0); if (tt > 10) { n++; if (o3.sure >= 0.95) on++; } } return on / n; };
      const got = [[0, 1, 2, 3], [0, 2], [0, 1.5, 2, 3.75], [0, 0.75, 1.5, 2.25, 3, 3.5], [0, 1.5, 3]].map(st2 => share(line(st2, 90)));
      expect("a bass line that is off the beat part of the time (hip-hop, funk, a dotted line) is still a beat to the clock", got.every(v => v > 0.7), got.map(v => v.toFixed(2)).join(" ")); }
    { // the music stops and another track starts at another speed (a file chosen in place of the built-in track): the beat is found again at once
      const after = (p1, gap, p2) => { const bc4 = dn.makeBeatClock(); let o4, tt = 0, t0 = -1; for (; tt < 14; tt += dt) o4 = bc4(dt, hit(tt, p1)); for (let g = 0; g < gap; g += dt) o4 = bc4(dt, 0); const low4 = o4.sure; for (let t2 = 0; t2 < 20; t2 += dt) { o4 = bc4(dt, hit(t2, p2)); if (t0 < 0 && o4.sure >= 0.95) t0 = t2; } return [low4, t0, o4.per, o4.sure]; };
      const a1 = after(0.47, 6, 0.4), a2 = after(0.5, 6, 0.375), a3 = after(0.5, 0, 0.375), a4 = after(0.5, 0, 0.625);
      expect("after a gap in the sound the clock is sure of the new beat within three and a half seconds, at the new speed", a1[0] < 0.2 && a1[1] >= 0 && a1[1] < 3.5 && Math.abs(a1[2] - 0.4) < 0.02 && a2[1] >= 0 && a2[1] < 3.5 && Math.abs(a2[2] - 0.375) < 0.02, a1.concat(a2).map(v => v.toFixed(2)).join(" "));
      expect("a beat that changes speed with no gap, even to three quarters or five quarters of what it was, has been taken up at the new speed twenty seconds on", a3[3] >= 0.95 && Math.abs(a3[2] - 0.375) < 0.02 && a4[3] >= 0.95 && Math.abs(a4[2] - 0.625) < 0.02, a3.concat(a4).map(v => v.toFixed(2)).join(" ")); }
    { // slow frames (a doorway open, with two worlds to draw) and a frame that takes a second (a world's program being made): the count keeps real time
      const slowRun = (frameSecs, hitchAt) => { dn.danceTick = dn.makeBeatClock(); let tt = 0, n = 0; while (tt < 24) { const real = hitchAt && Math.abs(tt - hitchAt) < frameSecs / 2 ? 1 : frameSecs; tt += real; dn.danceStep(Math.min(0.05, real), hit(tt, 0.47), 0, 0.8, false, false, false, tt, real); n++; } return [Math.min(...dn.crowd.map(d => d.a)), dn.danceSt.sure, Math.abs(dn.danceSt.u - Math.round(dn.danceSt.u) - ((tt % 0.47) / 0.47 > 0.5 ? (tt % 0.47) / 0.47 - 1 : (tt % 0.47) / 0.47))]; };
      const s12 = slowRun(0.08), s8 = slowRun(0.125), hitch = slowRun(1 / 60, 18);
      expect("at twelve and at eight frames a second the figures still find the beat and dance on it, and a frame that takes a whole second does not stop them", s12[0] > 0.9 && s12[1] > 0.95 && s8[0] > 0.9 && s8[1] > 0.95 && hitch[0] > 0.9 && hitch[1] > 0.95, [s12, s8, hitch].map(v => v.map(x => x.toFixed(2)).join("/")).join(" ")); prev = null; }
    { // one loud moment, or a quieter track put on: the same beat comes through as much smaller pulses, and the figures go on
      dn.danceTick = dn.makeBeatClock(); let tt = 0, low = 1, sum = 0, cnt = 0; const sec = (secs, size) => { for (let n = 0; n < secs * 60; n++, tt += dt) { dn.danceStep(dt, size * hit(tt, 0.47), 0.5 * size * hit(tt + 0.2, 0.47), 0.8, false, false, false, tt, dt); if (size < 1 && n > 360) { low = Math.min(low, dn.crowd[0].a); sum += dn.danceSt.sure; cnt++; } } };
      sec(12, 1); sec(20, 0.12);
      expect("a beat whose pulses have become eight times smaller is still danced to, six seconds on", low > 0.9 && sum / cnt > 0.95, low + " " + sum / cnt);
      for (let n = 0; n < 600; n++, tt += dt) dn.danceStep(dt, 0, 0, 0.8, false, false, false, tt, dt);
      expect("and with no sound at all they stop, and Stats is told so in a line", dn.crowd.every(d => d.a < 0.05) && /^dancers: 0% dancing, beat 0% sure/.test(dn.danceSays()), dn.danceSays()); prev = null; }
    { // music whose bass rolls on with no clear kick and whose beat is in the hi-hats (found in a user's recording of a live set): the four clocks hear it
      const ls = await import("../js/listen.js"), bins = new Uint8Array(512), was = new Uint8Array(512), on4 = new Float32Array(4); let tt = 0, sum = 0, cnt = 0, lead = {}, sd = 77; const noise = () => (sd = sd * 16807 % 2147483647) / 2147483647;
      dn.danceBank = dn.makeBeatBank(); for (const d of dn.crowd) d.a = 0;
      for (let n = 0; n < 60 * 30; n++, tt += dt) {
        for (let i = 0; i < 512; i++) bins[i] = i < 6 ? 170 + 12 * noise() : i < 160 ? 110 + 14 * noise() : 60 + 6 * noise() + 45 * Math.exp(-14 * (tt % 0.438)); // a loud bass that wavers, mids that waver, and a hat on every beat in the top
        ls.onsetStep(bins, was, on4, dt); dn.danceStep(dt, 0.05 * noise(), 0.05 * noise(), 0.7, false, false, false, tt, dt, on4);
        if (tt > 8) { sum += Math.min(...dn.crowd.map(d => d.a)); cnt++; lead[dn.danceSt.lead] = 1; } }
      expect("a beat that is only in the top of the sound, under a bass that only wavers, is danced to, at its own speed, led by the top", sum / cnt > 0.95 && Object.keys(lead).join() === "3" && Math.abs(dn.danceSt.per - 0.438) < 0.01 && /by the top of the sound/.test(dn.danceSays()), sum / cnt + " " + Object.keys(lead) + " " + dn.danceSt.per + " | " + dn.danceSays());
      on4.fill(0); was.fill(0); bins.fill(100); ls.onsetStep(bins, was, on4, dt); const up = Array.from(on4); bins.fill(100); ls.onsetStep(bins, was, on4, dt);
      expect("an onset is how much the bins of its part rose since the last frame, and dies away when they stop rising", up.every(v => Math.abs(v - 100 / 255) < 1e-6) && Array.from(on4).every((v, k) => v < up[k] && v > 0.8 * up[k]), up.join(" ")); prev = null; }
    { // changing from one overlay of figures to another while the music plays does not stop the dance
      dn.danceTick = dn.makeBeatClock(); let tt = 0, low = 1; const go = (kd, secs) => { sel.ovi = OVERLAYS.findIndex(v => v.dance === kd); for (let n = 0; n < secs * 60; n++, tt += dt) { dn.stepDance({ dt, bt: hit(tt, 0.47), mp: 0 }); if (secs < 9) low = Math.min(low, ...dn.crowd.map(d => d.a)); } };
      go(1, 10); go(2, 3); go(3, 3); go(1, 3); go(2, 3);
      expect("figures newly set up while the others were dancing are dancing from their first frame", low > 0.9, String(low)); sel.ovi = OVERLAYS.findIndex(v => v.dance === 3); dn.stepDance({ dt, bt: 0, mp: 0 }); prev = null; } // new figures: the speeds below are not measured against the old ones
    expect("the clock is sure of a steady beat within a few seconds, not of uneven hits, and stops being sure when the beat has gone", sureBeat > 0.9 && sum / cnt < 0.3 && o2.sure < 0.2, sureBeat + " " + sum / cnt + " " + o2.sure);
    dn.danceTick = dn.makeBeatClock(); let danced = 0, walked = 0, out = 0, turned = 0; const tx0 = dn.crowd.map(d => d.tx);
    run(90, tt => { dn.danceStep(dt, say(tt), 0.5 * say(tt + 0.1), 0.8, false, false, false, 80 + tt); dn.crowd.forEach((d, n) => { danced += d.a * dt; walked = Math.max(walked, Math.abs(d.tx - tx0[n])); out = Math.max(out, Math.abs(d.tx)); turned = Math.max(turned, Math.abs(Math.sin(d.p[4]))); }); });
    expect("to a voice talking the figures do not dance: they wait, facing any way, or walk about within their room", danced / 90 / dn.crowd.length < 0.12 && walked > 0.2 && out < 0.76 && turned > 0.9, danced / 90 / dn.crowd.length + " " + walked + " " + out + " " + turned);
    expect("waiting and walking move no joint faster than seven figure heights a second either", fast < 7, String(fast));
    dn.danceTick = dn.makeBeatClock(); run(20, tt => dn.danceStep(dt, hit(tt, 0.47), 0, 0.8, false, false, false, 170 + tt));
    expect("when a beat comes they go back to the room they dance in, and dance", dn.crowd.every(d => d.a > 0.9 && Math.abs(d.tx) < 0.46 && Math.abs(d.tz) < 0.36), dn.crowd.map(d => d.a.toFixed(2) + "/" + d.tx.toFixed(2)).join(" "));
  }
  expect("through a minute of dancing no joint is moved faster than seven figure heights a second: a pose is gone toward, never jumped to", fast < 7, String(fast));
  // routines, the kick, and travelling
  { const r = dn.makeRoutine(0.7, rnd), sizes = new Set(); for (k = 0; k < 200; k++) sizes.add(dn.makeRoutine(0.7, rnd).mv.length);
    expect("a routine is three to ten different moves fit for the music", Math.min(...sizes) === 3 && Math.max(...sizes) === 10 && new Set(r.mv).size === r.mv.length && r.mv.every(j => mv.MOVES[j].mid) && r.mir.length === r.mv.length && dn.moveTier(0.2) === "lo" && dn.moveTier(1.2) === "hi");
    for (let n = 0; n < 600; n++) dn.danceStep(dt, hit(n * dt, 0.47), 0, 0.5, false, false, false, n * dt); // the music is under way before the figure is chosen, so its routine is made for it
    sel.ovi = 0; dn.stepDance({ dt, bt: 0, mp: 0 }); sel.ovi = OVERLAYS.findIndex(v => v.dance === 1); dn.stepDance({ dt, bt: 1, mp: 0 }); const seen = []; let last = -1, rt0 = dn.crowd[0].rt;
    for (let n = 0; n < 60 * 300 && dn.crowd[0].rt === rt0; n++) { dn.danceStep(dt, hit(n * dt, 0.47), 0, 0.5, false, false, false, n * dt); if (dn.crowd[0].mv !== last) seen.push(last = dn.crowd[0].mv); }
    const nr = rt0.mv.length;
    expect("a figure dances its routine through in order twice, and then takes a new one", seen.length >= 2 * nr && seen.slice(0, 2 * nr).every((x, j) => x === rt0.mv[j % nr]), seen.join() + " / " + rt0.mv.join());
    sel.ovi = OVERLAYS.findIndex(v => v.dance === 2); dn.stepDance({ dt, bt: 0, mp: 0 }); let together = true;
    for (let n = 0; n < 60 * 60; n++) { dn.danceStep(dt, hit(n * dt, 0.47), 0, 0.5, false, n === 900, false, n * dt); if (!dn.crowd.every(d => d.mv === dn.crowd[0].mv && d.u0 === dn.crowd[0].u0 && Math.abs(d.tx - dn.crowd[0].tx) < 1e-9)) together = false; }
    expect("the chorus line dances the same move from the same beat, and travels together", together && dn.crowd.length === 4);
    // the kinds of dancing
    const names = mv.MOVES.map(m => m.name), listed = Object.values(mv.MV_STYLES).flat();
    expect("every move is in exactly one kind of dancing, and every name listed is a move", listed.length === names.length && new Set(listed).size === listed.length && listed.every(n => names.includes(n)) && mv.MOVES.every(m => mv.moveStyle(m) !== ""), names.filter(n => !listed.includes(n)).concat(listed.filter(n => !names.includes(n))).join());
    expect("a routine made for one kind keeps to it, at any fullness of the music, and has three moves at least", Object.keys(mv.MV_STYLES).every(sty => [0.2, 0.7, 1.2].every(e => { const r2 = dn.makeRoutine(e, rnd, sty); return r2.mv.length >= 3 && r2.mv.every(j => mv.moveStyle(mv.MOVES[j]) === sty); })) && dn.makeRoutine(0.7, rnd, "<b>").style === "");
    dn.setDanceStyle("sixties"); for (let n = 0; n < 60 * 12; n++) dn.danceStep(dt, hit(n * dt, 0.47), 0, 0.5, false, false, false, n * dt);
    expect("choosing a kind gives every figure a routine of it at its next move, and a name that is not a kind means any", dn.crowd.every(d => d.rt.style === "sixties" && mv.moveStyle(mv.MOVES[d.mv]) === "sixties") && (dn.setDanceStyle("nonsense"), dn.danceStyle === "any"));
    // no two times through a move are alike: the same beat of the same move, two times round, is carried differently
    { sel.ovi = OVERLAYS.findIndex(v => v.dance === 1); dn.stepDance({ dt, bt: 0, mp: 0 }); const d0 = dn.crowd[0], shots = []; d0.rt = { mv: [1, 1, 1], mir: [false, false, false], tier: "mid", style: "" }; d0.ri = 0; d0.mv = 1;
      for (let n = 0; n < 60 * 40; n++) { dn.danceStep(dt, hit(n * dt, 0.47), 0, 0.5, false, false, false, n * dt); if (d0.bl >= 1 && Math.abs(dn.danceSt.u - d0.u0 - 2.5) < 0.02) shots.push(d0.p.slice(0, 28)); }
      const dif = shots.length > 2 ? Math.max(...shots[0].map((x, j) => Math.abs(x - shots[2][j]))) : 0;
      expect("a figure carries the same move differently each time it comes to it", dif > 0.01, shots.length + " " + dif); }
    // the kick itself bends the knees: the same moment of the same move, with and without one
    sel.ovi = OVERLAYS.findIndex(v => v.dance === 1); dn.stepDance({ dt, bt: 0, mp: 0 });
    const hips = loud => { dn.danceTick = dn.makeBeatClock(); const s0 = dn.danceSt; s0.u = 0; s0.kick = 0; s0.jump = -1; const d = dn.crowd[0]; d.rt = { mv: [0], mir: [false], tier: "lo" }; d.ri = 0; d.mv = 0; d.mir = false; d.u0 = 0; d.bl = 1; d.next = 1e9; d.tx = 0; s0.en = 1; s0.pa = 1;
      for (let n = 0; n < 30; n++) dn.danceStep(dt, 0.3, 0, 1, false, false, false, 0); for (let n = 0; n < 6; n++) dn.danceStep(dt, loud ? 1 : 0.3, 0, 1, false, false, false, 0); return dn.crowd[0].b[4]; };
    const soft = hips(false), hard = hips(true);
    expect("a kick bends the knees as it lands: the hips are lower just after a hard one than a soft one", soft - hard > 0.004, soft + " " + hard);
    // the moonwalk glides backward, and stops short of the end of its room
    const mw = mv.MOVES.findIndex(m => m.name === "moonwalk"), dd = dn.crowd[0]; dd.rt = { mv: [mw], mir: [false], tier: "mid" }; dd.mv = mw; dd.mir = false; dd.next = 1e9; dd.go = true; dd.sp = 0; dd.fa = 0; let far = 0, early = 0;
    for (let n = 0; n < 480; n++) dn.danceStep(dt, hit(n * dt, 0.47), 0, 0.5, false, false, false, n * dt); dd.tx = 0; // the beat is under way and the figure dancing before it is put on its place
    for (let n = 480; n < 60 * 48; n++) { dn.danceStep(dt, hit(n * dt, 0.47), 0, 0.5, false, false, false, n * dt); far = Math.min(far, dd.tx); if (n === 720) early = dd.tx; }
    dn.danceBody(dd.p, J);
    expect("the moonwalk carries the figure backward from its place, and never past the end of its room", early < -0.15 && far > -(0.89 * (1 + dn.DN_DEEP * dn.DN_FLOOR) / dn.danceSpots(1, 1.78)[0][2] - 0.4) && far < -0.6 && J[42] - J[33] > 0 && mv.moveGo(mv.MOVES[mw], 3) < 0 && mv.moveGo(mv.MOVES[0], 3) === 0, early + " " + far);
    const ht = mv.MOVES.find(m => m.name === "hammer time"); expect("a move that sways goes one way and then back", mv.moveGo(ht, 1) > 0 && mv.moveGo(ht, 5) < 0 && mv.moveGo(ht, 9) > 0);
    // a flowing move does not stop at its keys; one with a hold does
    const flow = mv.MOVES.find(m => m.name === "grapevine"), held = mv.MOVES.find(m => m.name === "robot"), sp = (m, u) => { const a = [], b = []; mv.movePose(m, u - 0.01, a); mv.movePose(m, u + 0.01, b); return Math.max(...a.map((x, j) => Math.abs(x - b[j]))) / 0.02; };
    expect("a flowing move passes through its keys without stopping, and a move with a hold stops at each", sp(flow, 2) > 0.03 && sp(held, 2) < 1e-3 && sp(held, 1.8) > 0.03, sp(flow, 2) + " " + sp(held, 2)); }
  sel.ovi = OVERLAYS.findIndex(v => v.dance === 3); dn.stepDance({ dt, bt: 0, mp: 0 });
  { const nn = dn.danceFill(3, 1.78), U = dn.dnU, deep = [...dn.crowd].sort((a, b) => b.hz + b.tz - a.hz - a.tz), ys = []; for (let n = 0; n < nn; n++) ys.push(Math.min(U[5][4 * n + 3], U[6][4 * n + 3]));
    expect("the shader is handed the crowd furthest first, each with its own number, the further ones smaller and higher up, and none for an overlay that is not theirs", nn === dn.crowd.length && deep.every((d, n) => Math.floor(U[8][4 * n + 3]) === d.id && U[8][4 * n + 3] % 1 > 0.2) && (nn === 12 || U[8][4 * nn + 3] === 0) && ys[0] > ys[nn - 1] + 0.05 && U[8][2] < 0.75 * U[8][4 * (nn - 1) + 2] && dn.danceSpots(1, 1.78)[0][2] < 0.45 && (dn.danceFill(1, 1.78), U[8][3] === 0)); }
  { // the party: figures walk on and off at the sides, four to twenty of them while there is music, and all leave when it stops
    sel.ovi = OVERLAYS.findIndex(v => v.dance === 4); dn.danceTick = dn.makeBeatClock(); dn.stepDance({ dt, bt: 0, mp: 0 });
    const empty = dn.crowd.length, was = new Map(), sides = new Set(), F0 = 0.54 * dn.DN_SIZE, hw = 0.89; let tt = 0, lo = 99, hi = 0, most = 0, speed = 0, ballUp = 0, ballDown = 0, shown = true, first = true, onAt = 0;
    const step = (bt, level) => { dn.danceStep(dt, bt, 0, level, false, false, false, tt); tt += dt;
      for (const d of dn.crowd) { const b = was.get(d); if (b) for (k = 0; k < 51; k++) speed = Math.max(speed, Math.abs(d.b[k] - b[k]) * 60); was.set(d, d.b.slice()); if (d.ent === 1) sides.add(d.side); }
      most = Math.max(most, dn.crowd.length); };
    dn.danceFill(4, 1.78); ballUp = dn.dnB[2];
    for (let n = 0; n < 60 * 200; n++) { step(hit(tt, 0.47), 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(tt / 9)));
      if (first && dn.crowd.length) { first = false; dn.danceFill(4, 1.78); shown = Math.abs(dn.dnU[8][0]) > hw + dn.dnU[8][2]; } // the first to come begins out of sight
      if (n === 600) { dn.danceFill(4, 1.78); ballDown = dn.dnB[2]; }
      if (n > 60 * 40) { const on = dn.crowd.filter(d => d.ent !== 2).length; lo = Math.min(lo, on); hi = Math.max(hi, on); } }
    expect("the party begins with nobody, its figures walk on from both sides beginning out of sight, and while there is music there are four to twenty of them, more at some times than others", empty === 0 && sides.size === 2 && shown && lo >= dn.DN_LEAST && hi <= dn.DN_MAX && hi >= lo + 4 && most <= dn.dnRoom, [lo, hi, most].join(" "));
    expect("the party's ball begins above the picture and comes down to hang under its top, and its lights are on with the music", ballUp > 0.5 && ballDown < 0.42 && ballDown > 0.2 && dn.dnB[4] > 0.5 && dn.dnB[0] > 0, ballUp + " " + ballDown + " " + dn.dnB[4]);
    onAt = dn.crowd.length; const groups = new Map(), byes = new Set(); let gone = -1, turned = 0;
    for (let n = 0; n < 60 * 150 && gone < 0; n++) { step(0, 0.1);
      for (const d of dn.crowd) if (d.ent === 2 && d.grp) { groups.set(d.grp, (groups.get(d.grp) || new Set()).add(d)); byes.add(d.bye); if (d.bye === 0) turned = Math.max(turned, Math.abs(d.hy)); }
      if (!dn.crowd.length) gone = n / 60; }
    dn.danceFill(4, 1.78);
    expect("when the music has stopped they wait a while and then leave in groups of one to four, each group by one side, waving, nodding or talking, until the floor is empty; the ball stays with its lights low", onAt >= 4 && gone > dn.DN_LINGER && groups.size >= 2 && [...groups.values()].every(g => g.size >= 1 && g.size <= 4 && new Set([...g].map(d => d.side)).size === 1) && [...byes].every(b => b >= 0 && b < dn.DN_BYES.length) && byes.size >= 2 && turned > 0.2 && dn.dnB[2] < 0.42 && dn.dnB[4] < 0.4 && dn.dnB[4] > 0.1, gone + " " + groups.size + " " + [...byes].join(","));
    for (let n = 0; n < 60 * 30; n++) step(hit(tt, 0.47), 0.6);
    expect("they come back when the music does, and no joint of a figure coming, going, waving or dancing moves faster than seven figure heights a second", dn.crowd.filter(d => d.ent !== 2).length >= dn.DN_LEAST && speed < 7, dn.crowd.length + " " + speed);
    dn.setDanceRoom(12); for (let n = 0; n < 60 * 120; n++) step(hit(tt, 0.47), 1); const few = Math.max(...[dn.crowd.length]); dn.setDanceRoom(20);
    expect("on a chip with room for twelve the party is never more than twelve", few <= 12 && dn.danceFill(4, 1.78) <= 12, few);
    sel.ovi = OVERLAYS.findIndex(v => v.dance === 3); dn.stepDance({ dt, bt: 0, mp: 0 }); dn.danceFill(3, 1.78);
    expect("another overlay of figures has no ball", dn.dnB[2] === 99 && dn.dnB[4] === 0); }
  { // a frame's time below zero, or a pulse far out of range, must not throw the figures about
    for (let n = 0; n < 240; n++) dn.danceStep(dt, hit(n * dt, 0.47), 0, 0.8, false, false, false, n * dt);
    dn.danceStep(-0.4, 30, 30, 0.8, false, false, false, 4); dn.danceStep(NaN, NaN, -5, 0.8, false, false, false, 4); dn.danceStep(dt, 1, 0, 0.8, false, false, false, 4);
    expect("a frame handed a time below zero or a pulse far out of range leaves every figure's pose and body where a body can be", dn.crowd.every(d => d.p.every((v, j) => j === 4 || Math.abs(v) < (j % 4 === 3 && j > 11 ? 2 : 0.8)) && d.b.every(v => Math.abs(v) < 1.3) && Math.abs(dn.danceSt.kick) <= 1.5)); }
  { // the dancer alone has a floor that goes away from the viewer: it goes all over it, never nearer than the front edge, and turns to face every way
    sel.ovi = OVERLAYS.findIndex(v => v.dance === 1); dn.stepDance({ dt, bt: 0, mp: 0 }); dn.danceTick = dn.makeBeatClock(); const d = dn.crowd[0]; let x0 = 9, x1 = -9, z0 = 9, z1 = -9, back = 0, big = 0, off = 0, front = dn.danceSpots(1, 1.78)[0][2];
    for (let n = 0; n < 60 * 240; n++) { dn.danceStep(dt, hit(n * dt, 0.47), 0, 0.6, false, false, false, n * dt); x0 = Math.min(x0, d.tx); x1 = Math.max(x1, d.tx); z0 = Math.min(z0, d.tz); z1 = Math.max(z1, d.tz); back = Math.max(back, Math.abs(Math.sin(d.p[4] / 2)));
      if (n % 60 === 0) { dn.danceFill(1, 1.78); big = Math.max(big, dn.dnU[8][2] / (front * dn.DN_HEAD)); off = Math.max(off, Math.abs(dn.dnU[0][2])); } }
    expect("the dancer alone goes all over a deep floor, never nearer than its front edge nor out of the picture, and is seen from every side", x1 - x0 > 2 && z1 - z0 > 2 && z0 > -0.02 && z1 < dn.DN_FLOOR + 0.02 && big < 1.25 && off < 0.89 && back > 0.95, [x0, x1, z0, z1, big, off, back].map(v => v.toFixed(2)).join(" "));
    const jsrc = (await import("node:fs")).readFileSync(new URL("../js/journey.js", import.meta.url), "utf8"), party = jsrc.slice(jsrc.indexOf('{name:"Dance party"'), jsrc.indexOf('{name:"Kaleidoscope"'));
    expect("the Dance party journey leaves out the Echo filter, which lays a second, larger, upside-down picture of the figures over them", party.includes('overlay:{mode:"random",every:40,set:["Dancer","Chorus line","Dance floor","Disco"]}') && !party.includes("Echo")); }
  sel.ovi = was; Math.random = rand;
}
// ---- the eye's blink: it shuts and opens along a gentle curve, once, and then waits
{
  const { blinkStep, BLINK_GAP, BLINK_SHUT, BLINK_HELD, BLINK_OPEN, EYES, IRIS, BLINKS, eyeRadius, eyeFill, eyePupil, EYE_STEPS, EYE_FAR } = await import("../js/eye.js");
  for (const slow of [false, true]) {
    const s = { ph: 0, t: 0, next: 1, b: 0 }, dt = 1 / 60; let hits = 0, most = 0, top = 0, range = true, shutFor = 0, n = 0, was = 0;
    for (; n < 60 * 4; n++) { was = s.b; if (blinkStep(s, dt, slow, 0.5)) hits++; most = Math.max(most, Math.abs(s.b - was)); top = Math.max(top, s.b); if (!(s.b >= 0 && s.b <= 1)) range = false; if (s.b > 0.5) shutFor += dt; }
    const k = slow ? 2 : 1;
    expect("a blink" + (slow ? " with reduced motion asked for" : "") + " shuts the lids once, never moves them more than a sixth of the way in one frame, and ends open with the next one at least five seconds off",
      hits === 1 && top === 1 && range && most < 1 / 6 && s.ph === 0 && s.b === 0 && s.next >= BLINK_GAP[0] && s.next <= BLINK_GAP[1] * k && shutFor < (BLINK_SHUT + BLINK_HELD + BLINK_OPEN) * k, [hits, top, most.toFixed(3), s.ph, s.next, shutFor.toFixed(2)].join(" "));
  }
  { const s = { ph: 0, t: 0, next: 0.1, b: 0 }; let hits = 0; for (let n = 0; n < 200; n++) if (blinkStep(s, 0.05, false, 0)) hits++;
    expect("at the slowest frames a blink still shuts once and opens, and the shortest wait is kept", hits >= 1 && hits <= 2 && s.next === BLINK_GAP[0], hits + " " + s.next); }
  { let ok = true, why = "";
    for (const asp of [0.46, 0.6, 1, 1.78, 2.4]) {
      const hw = 0.5 * Math.max(asp, 1) / Math.min(asp, 1) * Math.min(asp, 1) / Math.min(asp, 1), l = 0.5 * Math.max(asp, 1 / asp), corner = Math.hypot(0.5, l), top = eyeRadius(EYE_STEPS, asp);
      let grows = true; for (let k = 0; k < EYE_STEPS; k++) if (!(eyeRadius(k + 1, asp) > eyeRadius(k, asp) * 1.15)) grows = false;
      /* at the nearest step the iris reaches past the corner, and the lids, which stand 0.96 of the radius or more above and below the middle, are out of the picture */
      if (!(top > corner && 0.96 * top > 0.5 && grows && Math.abs(eyeRadius(0, asp) - EYE_FAR) < 1e-9 && eyeRadius(99, asp) === top && eyeRadius(-5, asp) === EYE_FAR)) { ok = false; why += asp + ":" + top.toFixed(3) + "/" + corner.toFixed(3) + " "; }
    }
    expect("the eye's nearest step has the iris past every corner of the picture, wide or tall, each step is nearer than the last, and a step out of range is held in", ok, why); }
  expect("seen from far the pupil is the size the sound asks for, and seen from nearest it leaves the iris more than half of the picture's shorter side", eyePupil(0.6, 0.3) === 0.6 && [0.46, 1, 1.78].every(a => { const r = eyeRadius(EYE_STEPS, a); return eyePupil(0.72, r) * r < 0.46 && eyePupil(0.72, r) > eyePupil(0.5, r); }));
  expect("the eye starts off, the iris can keep a colour of its own, and a blink can be off", EYES[0].name === "off" && !IRIS[0].c && IRIS.slice(1).every(i => i.c.length === 3 && i.c.every(c => c.length === 3 && c.every(v => v >= 0 && v <= 1))) && BLINKS[0] === "off");
}
// ---- the Fabric: its waves, and the camera kept above the cloth
{
  const F = (await import("../js/fabric.js")).__dbg, w = worldsM.WORLDS.find(v => v.id === "fabric");
  let sd = 4242; const rnd = () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return sd / 4294967296; };
  F.fbSet(1234.5, 0.3, 0.6, 0.2, 1, false); const a = Array.from(F.fb);
  F.fbSet(7, 1, 1, 1, 1, false); F.fbSet(1234.5, 0.3, 0.6, 0.2, 1, false);
  expect("the same time and sound give the same cloth, whatever came before", Array.from(F.fb).every((v, i) => v === a[i]));
  expect("the waves' angles are kept within one turn", a.slice(5).every(v => v >= 0 && v < 6.2832));
  F.fbSet(1e6, 9, -3, NaN, 2, false);
  expect("sound out of range is held to 0 to 1", Array.from(F.fb).slice(0, 5).every((v, i) => v >= F.FB_BASE[i] - 1e-6 && v <= F.FB_BASE[i] + F.FB_SND[i] + 1e-6));
  F.fbSet(50, 1, 1, 1, 1, true); const calmH = F.fb[0]; F.fbSet(50, 1, 1, 1, 1, false);
  expect("with reduced motion the waves are half as high", Math.abs(calmH * 2 - F.fb[0]) < 1e-6);
  let per = true, clear = true, held = true, safe = true, least = 9;
  for (let n = 0; n < 400; n++) {
    F.fbSet(n * 0.37, rnd(), rnd(), rnd(), rnd(), false);
    const x = (rnd() - 0.5) * 40, z = (rnd() - 0.5) * 40, y = (rnd() - 0.5) * 14;
    if (Math.abs(F.fbH(x, z) - F.fbH(x + 12, z - 24)) > 1e-5 || Math.abs(w.de(x, y, z, 0) - w.de(x + 12, y, z - 24, 0)) > 1e-5) per = false; // the shader's pi has eight figures, so not to the last place
    const p = [x, y, z], v = [0, y < 0 ? -1 : 1, 0]; for (let k = 0; k < 4; k++) F.fbHold(p, v, w.de); // the cloth has not moved between these, so it is only brought clear
    const d = w.de(p[0], p[1], p[2], 0); least = Math.min(least, d);
    if (!(d > 0.03)) clear = false;
    if (p[1] - F.fbH(x, z) > F.FB_CEIL + 1e-9 || Math.abs(p[1] - y) > F.FB_TOP + F.FB_CLEAR + 0.27 && y - F.fbH(x, z) < F.FB_CEIL) held = false; // moved no further than out of a thread
    { const deep = [x, F.fbH(x, z) - F.FB_GAP * (F.FB_DEEP + 1) - 1.5, z]; F.fbHold(deep, [0, 0, 0], w.de); if (deep[1] - F.fbH(x, z) < -(F.FB_GAP * F.FB_DEEP + 1.5) - 0.2 || deep[1] - F.fbH(x, z) > -(F.FB_GAP * F.FB_DEEP - 1.5) + 0.2) held = false; }
    // a ray from above the cloth, stepped by the world's own distance, never ends inside a thread
    const q = [x, F.fbH(x, z) + 0.6 + 2 * rnd(), z], dir = [rnd() - 0.5, -0.3 - rnd(), rnd() - 0.5], dl = Math.hypot(dir[0], dir[1], dir[2]);
    for (let i = 0, t = 0; i < 60; i++) { const e = w.de(q[0] + dir[0] / dl * t, q[1] + dir[1] / dl * t, q[2] + dir[2] / dl * t, 0); if (e < -0.004) safe = false; if (e < 0.002) break; t += e; }
  }
  expect("the Fabric and its waves repeat every 12 across the cloth", per);
  expect("a place anywhere above or below the cloth is brought clear of the threads by fbHold, moved no further than that needs, kept under the ceiling, and moved up a cloth when it is too deep", clear && held, "least " + least.toFixed(3));
  expect("a step as long as the Fabric's distance never ends inside a thread", safe);
  { // a camera left in the weave, then one flying across just under the cloth, each through a minute of loud waves: never in a thread
    let low = 9, kept = true;
    for (const fly of [0, 1]) { // one after the other: fbHold remembers one camera's cloth
      const b = fly ? [0.5, -1.2, 0.5] : [0.5, 0, 0.5], vb = [0, 0, 0]; F.fbSet(0, 1, 1, 1, 1, false); if (!fly) b[1] = F.fbH(0.5, 0.5);
      for (let k = 0; k < 4; k++) F.fbHold(b, vb, w.de); const rel = b[1] - F.fbH(b[0], b[2]);
      for (let n = 1; n < 3600; n++) { F.fbSet(n / 60, 1, 1, 1, 0.5 + 0.5 * Math.sin(n / 7), false); if (fly) { b[0] += 0.9 / 60; b[2] += 0.4 / 60; } F.fbHold(b, vb, w.de);
        low = Math.min(low, w.de(b[0], b[1], b[2], 0)); if (fly && Math.abs(b[1] - F.fbH(b[0], b[2]) - rel) > 0.3) kept = false; } }
    expect("in and under the Fabric the camera rides the cloth as it waves: it is never in a thread, and one flying under keeps its depth", low > 0.02 && kept, String(low)); }
  worldsM.setInOutNow(true); const shell = worldsM.inShell(w); worldsM.setInOutNow(false);
  expect("the Fabric has no inside out, and no doorways", shell === 0 && w.sheet === true);
  F.fbSet(0, 0, 0, 0, 0, false);
}

// ---- window.MF: main.js merges every module's __dbg into one object, so a name used by two modules hides one of them
{
  const { readdirSync } = await import("node:fs"), dir = new URL("../js/", import.meta.url), seen = {}, twice = [];
  for (const f of readdirSync(dir).filter(f => f.endsWith(".js") && f !== "main.js")) {
    const m = await import(new URL(f, dir));
    for (const k of Object.keys(m.__dbg || {})) { if (seen[k]) twice.push(k + " (" + seen[k] + ", " + f + ")"); seen[k] = f; }
  }
  expect("no name is listed for the test tools by two modules", twice.length === 0, twice.join("; "));
}

// ---- a score: a journey made for a piece of music (js/scoredata.js)
{
  const { cleanScore, cleanTrack, scOrder, scChase, scSeek, scMatch, scAt, scLen, SC_LEAD, SC_CUES } = scoreM;
  const good = { name: "Album", tracks: [
    { name: "One", len: 200, marks: [30, 10], cues: [[12, "palette", "Sunset"], [0, "world", "julia"], [0, "journey", "Calm"], [40, "world", "temple"], [40.2, "mirrors", "6"], [41, "filter", "Neon"], [90, "journey", ""]] },
    { name: "Two", len: 300.004, cues: [] } ] };
  const sc = cleanScore(good);
  expect("score: a good one passes, cues in order of time", !!sc && sc.tracks.length === 2 && sc.tracks[0].cues[0][0] === 0 && sc.tracks[0].cues[2][0] === 12);
  expect("score: marks are sorted", sc.tracks[0].marks.join() === "10,30");
  expect("score: cleaning twice changes nothing", JSON.stringify(cleanScore(sc)) === JSON.stringify(sc));
  expect("score: a change of the picture too soon after another is dropped", !sc.tracks[0].cues.some(c => c[1] === "mirrors") && sc.tracks[0].cues.some(c => c[1] === "filter"));
  expect("score: a template of no name is allowed, and means none", sc.tracks[0].cues.some(c => c[1] === "journey" && c[2] === ""));
  const bad = [null, 3, "x", [], {}, { tracks: 3 }, { tracks: [] }, { tracks: [{ len: "9" }] }, { tracks: [{ len: NaN }] }, { tracks: [null, 4, []] }];
  expect("score: broken ones are refused", bad.every(b => cleanScore(b) === null));
  const odd = cleanTrack({ len: 100, name: 7, marks: "no", cues: [[5, "world"], [5, "nope", "x"], ["5", "world", "x"], [5, "world", ""], [5, "world", 9], [1e9, "world", "far"], [-4, "world", "early"], [7, "__proto__", "x"], [8, "palette", "x".repeat(61)], { 0: 1 }, [50, "palette", "ok\u0000name"]] });
  expect("score: broken cues are dropped, times are held in the track, names are made plain",
    odd.cues.length === 3 && odd.cues[0][0] === 0 && odd.cues[0][2] === "early" && odd.cues[1][2] === "ok name" && odd.cues[2][0] === 100 && odd.name === "", JSON.stringify(odd));
  const many = cleanTrack({ len: 9000, cues: Array.from({ length: 9000 }, (_, i) => [i, "palette", "p" + i]) });
  expect("score: a track holds no more cues than SC_CUES", many.cues.length === SC_CUES);
  const fast = cleanTrack({ len: 60, cues: Array.from({ length: 600 }, (_, i) => [i / 10, i % 2 ? "filter" : "overlay", "n" + i]) });
  let nearest = 9; for (let i = 1; i < fast.cues.length; i++) nearest = Math.min(nearest, fast.cues[i][0] - fast.cues[i - 1][0]);
  expect("score: nothing may strobe: cues written ten a second come out no nearer than 0.4 s", nearest >= 0.4 - 1e-9, String(nearest));
  const cut = cleanTrack({ len: 100, cues: [[10, "world", "julia", "door"], [20, "world", "temple", "nope"], [30, "palette", "Sunset", "door"], [40, "world", "gates", 7]] });
  expect("score: a doorway is kept on a change of world only, and any other fourth thing is dropped", JSON.stringify(cut.cues) === '[[10,"world","julia","door"],[20,"world","temple"],[30,"palette","Sunset"],[40,"world","gates"]]', JSON.stringify(cut.cues));
  expect("score: a doorway is asked for on its moment, not early", scOrder(cut.cues)[0].at === 10 && scOrder(cut.cues)[0].cut === "door" && scOrder(cut.cues)[1].at === 20 - SC_LEAD);
  {
    const { cleanTake, takeLen, takeAt } = scoreM, { flB64, flWrite, flSample, FL_BYTES } = flightM;
    const bytes = new Uint8Array(6 * FL_BYTES);
    for (let i = 0; i < 6; i++) flWrite(bytes, i, flSample([i * 0.1, 0, 0], [4, 4, 4], [0, 0, 1], [0, 1, 0], 10, i < 3 ? 0 : 1));
    const d = flB64(bytes), tk = { t: 20, w: ["julia", "temple"], d };
    expect("score: a camera take passes, and lasts its samples less one, half a second each", JSON.stringify(cleanTake(tk, 100)) === JSON.stringify(tk) && takeLen(tk) === 2.5);
    const badTakes = [null, [], { t: 20, w: ["julia"], d }, { t: 20, w: [], d }, { t: "20", w: ["julia", "temple"], d }, { t: 20, w: ["julia", 7], d }, { t: 20, w: ["julia", "tem\u0000ple"], d },
      { t: 20, w: ["julia", "temple"], d: d + "!" }, { t: 20, w: ["julia", "temple"], d: d.slice(0, 20) }, { t: 20, w: ["julia", "temple"], d: "" }, { t: 20, w: ["julia", "temple"], d: 5 },
      { t: 99, w: ["julia", "temple"], d }, { t: 20, w: new Array(17).fill("julia"), d }, { t: 20, w: ["julia", "temple"], d: "A".repeat(40000) }];
    expect("score: broken takes are refused (a world not in its list, letters that are not a flight's, one that runs past the track's end)", badTakes.every(b => cleanTake(b, 100) === null), badTakes.map(b => cleanTake(b, 100) === null ? 1 : 0).join(""));
    const tr = cleanTrack({ len: 100, takes: [{ t: 21, w: ["julia", "temple"], d }, tk, { t: 40, w: ["julia", "temple"], d }, "x"] });
    expect("score: takes come out in order, and one that begins inside another is dropped", tr.takes.length === 2 && tr.takes[0].t === 20 && tr.takes[1].t === 40);
    expect("score: the take over a moment", takeAt(tr, 21) === tr.takes[0] && takeAt(tr, 22.6) === null && takeAt(tr, 41) === tr.takes[1] && takeAt({}, 3) === null);
    expect("score: a track with no takes has no list of them", !("takes" in cleanTrack({ len: 100, takes: [] })) && !("takes" in cleanTrack({ len: 100 })));
  }
  {
    const { cleanCurve, curveAt, SC_CURVE_PTS } = scoreM;
    const c = cleanCurve([[30, 0.5], [10, 0], [10.02, 1], [20, 2], [-5, 0.25], ["x", 1], [40, NaN], 7, [50, 0.33333]], 100);
    expect("score: a drawn line comes out in order, held to the track and to 0..1, with no two points at one moment and broken ones dropped", JSON.stringify(c) === "[[0,0.25],[10,0],[20,1],[30,0.5],[50,0.333]]", JSON.stringify(c));
    expect("score: a line is straight between points and level outside them", curveAt(c, 5) === 0.125 && curveAt(c, 15) === 0.5 && curveAt(c, -3) === 0.25 && curveAt(c, 99) === 0.333 && curveAt([], 5) === null && curveAt(undefined, 5) === null);
    expect("score: a line holds no more points than SC_CURVE_PTS", cleanCurve(Array.from({ length: 900 }, (_, i) => [i / 5, 0.5]), 500).length === SC_CURVE_PTS);
    const tr = cleanTrack({ len: 100, curves: { morph: [[10, 0.2], [20, 0.9]], speed: "no", bogus: [[1, 1]], __proto__: { x: 1 } } });
    expect("score: a track keeps the lines it knows, and one with none has no list of them", JSON.stringify(tr.curves) === '{"morph":[[10,0.2],[20,0.9]]}' && !("curves" in cleanTrack({ len: 100, curves: { morph: [] } })) && !("curves" in cleanTrack({ len: 100, curves: [1] })));
  }
  const ord = scOrder(sc.tracks[0].cues);
  expect("score: a change behind a transition is asked for early", ord.find(o => o.t === 40 && o.k === "world").at === 40 - SC_LEAD && ord.find(o => o.k === "palette").at === 12 && ord[0].at === 0);
  const ch = scChase(sc.tracks[0].cues, 60);
  expect("score: what is asked for at a moment is each kind's last cue", ch.world === "temple" && ch.palette === "Sunset" && ch.journey === "Calm" && ch.filter === "Neon" && scChase(sc.tracks[0].cues, 95).journey === "");
  expect("score: going on after a jump starts with the first cue after it", ord[scSeek(ord, 39.8)].t === 40 && scSeek(ord, 500) === ord.length && scSeek(ord, -1) === 0);
  expect("score: a file is matched to the track of its length", scMatch(sc, 200.9, "", -1) === 0 && scMatch(sc, 299, "", -1) === 1 && scMatch(sc, 250, "One", 0) === -1);
  const twins = cleanScore({ tracks: [{ name: "A", len: 100 }, { name: "B", len: 100 }, { name: "C", len: 100 }] });
  expect("score: among tracks of one length, the name decides, then the place in the album", scMatch(twins, 100, "B", 0) === 1 && scMatch(twins, 100, "", 2) === 2 && scMatch(twins, 100, "", -1) === 0);
  expect("score: a second of the album is a track and a time in it", scAt(sc, 250).i === 1 && Math.abs(scAt(sc, 250).t - 50) < 1e-9 && scAt(sc, 1e6).i === 1 && scLen(sc) === 500);
}

// ---- hearing a whole piece ahead of playing it, and the draft made from it (js/scoreanalyse.js)
{
  const { analyse, anFft, anLevel, scDraft, draftTier, AN_N, DRAFT_GAP } = hearM, { cleanTrack } = scoreM;
  const re = new Float32Array(AN_N), im = new Float32Array(AN_N);
  for (let i = 0; i < AN_N; i++) re[i] = Math.cos(2 * Math.PI * 37 * i / AN_N);
  anFft(re, im);
  let top = 0; for (let i = 1; i < AN_N / 2; i++) if (Math.hypot(re[i], im[i]) > Math.hypot(re[top], im[top])) top = i;
  expect("hearing: the spectrum of a pure tone is at that tone", top === 37 && Math.abs(Math.hypot(re[37], im[37]) - AN_N / 2) < 0.01);
  // ninety seconds: a quiet pad, then thirty seconds with a kick drum on the beat at 120 a minute, then quiet again
  const rate = 44100, len = 90, x = new Float32Array(rate * len);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < x.length; i++) {
    const t = i / rate, full = t >= 30 && t < 60, ph = t % 0.5, hp = (t + 0.25) % 0.5;
    let s = 0.03 * Math.sin(2 * Math.PI * 220 * t) * (1 + 0.5 * Math.sin(t * 0.7));
    if (full) s += 0.6 * Math.exp(-ph * 14) * Math.sin(2 * Math.PI * (50 + 100 * Math.exp(-ph * 30)) * ph) + 0.12 * Math.sin(2 * Math.PI * 110 * t) + 0.1 * Math.sin(2 * Math.PI * 440 * t);
    x[i] = s + (full ? 0.15 : 0.02) * Math.exp(-hp * 60) * (rnd() * 2 - 1);
  }
  const an = analyse(x, rate), mk = an.marks;
  expect("hearing: the drop and the breakdown are marked where they happen, to a quarter of a second", mk.length === 2 && Math.abs(mk[0].t - 30) < 0.25 && mk[0].drop && Math.abs(mk[1].t - 60) < 0.25, JSON.stringify(mk));
  expect("hearing: the quiet parts are heard as quiet and the full part as full", anLevel(an, 5, 25) < 0.1 && anLevel(an, 35, 55) > 0.9 && anLevel(an, 65, 85) < 0.1);
  const gaps = an.beats.slice(1).map((b, i) => b - an.beats[i]).sort((a, b) => a - b);
  expect("hearing: the beat is counted at its tempo", an.beats.length > 40 && Math.abs(gaps[gaps.length >> 1] - 0.5) < 0.03, String(gaps[gaps.length >> 1]));
  expect("hearing: the curves have five numbers a second", an.en.length === 450 && an.lv.length === 450 && Math.abs(an.len - 90) < 0.01);
  const pool = tier => tier === "quiet" ? ["coral", "julia", "aurora"] : ["lattice", "temple", "gates"];
  const d = scDraft(an, { quiet: "Calm", mid: "Classic", full: "MilkDrop" }, pool, rnd, ["coral"]);
  const tr = cleanTrack({ len: an.len, marks: d.marks, cues: d.cues }), wc = tr.cues.filter(c => c[1] === "world"), jc = tr.cues.filter(c => c[1] === "journey");
  expect("draft: a section for each part of the music, each in a world of its tier's and under its tier's template",
    wc.length === 3 && jc.length === 3 && jc.map(c => c[2]).join() === "Calm,MilkDrop,Calm" && pool("quiet").includes(wc[0][2]) && pool("full").includes(wc[1][2]) && pool("quiet").includes(wc[2][2]), JSON.stringify(tr.cues));
  expect("draft: it does not begin in the world the last track ended in, nor go straight back to one", wc[0][2] !== "coral" && wc[2][2] !== wc[0][2]);
  expect("draft: the cleaner changes nothing in it", JSON.stringify(tr.cues) === JSON.stringify(d.cues));
  const busy = { len: 100, hz: 5, en: new Uint8Array(500), lv: new Uint8Array(500).fill(200), marks: Array.from({ length: 60 }, (_, i) => ({ t: 5 + i * 1.5, drop: i % 7 === 3 })), beats: [] };
  const db = scDraft(busy, { quiet: "", mid: "", full: "" }, () => ["a", "b", "c", "d"], rnd, []);
  let near = 1e9; for (let i = 1; i < db.marks.length; i++) near = Math.min(near, db.marks[i] - db.marks[i - 1]);
  expect("draft: music that changes every moment still gets sections no shorter than DRAFT_GAP, less one move to a drop", db.marks.length >= 3 && near >= DRAFT_GAP - 12, String(near));
  expect("draft: the tiers", draftTier(0.1) === "quiet" && draftTier(0.5) === "mid" && draftTier(0.9) === "full");
}

// ---- the composing screen's arithmetic (js/studio.js)
{
  const { stStep, stClock, stZoom, stSnap, stPut, stLanes } = (await import("../js/studio.js")).__dbg, { cleanTrack, SC_NEAR } = scoreM;
  expect("studio: the ruler's ticks are a round step at least 70 pixels apart", stStep(100) === 1 && stStep(10) === 10 && stStep(3) === 30 && stStep(0.001) === 1200);
  expect("studio: a time as written", stClock(62.46) === "1:02.5" && stClock(0) === "0:00.0" && stClock(-3) === "0:00.0");
  let z = stZoom(0, 200, 200, 50, 0.5);
  expect("studio: zooming keeps the moment under the mouse where it is", Math.abs(z[0] - 25) < 1e-9 && Math.abs(z[1] - 125) < 1e-9);
  z = stZoom(0, 200, 200, 100, 4); const z2 = stZoom(99, 101.5, 200, 100, 0.01), z3 = stZoom(150, 200, 200, 199, 2);
  expect("studio: the view stays inside the track and no closer than two seconds", z[0] === 0 && z[1] === 200 && Math.abs(z2[1] - z2[0] - 2) < 1e-9 && z3[1] <= 200 + 1e-9 && z3[0] >= 0);
  expect("studio: a time catches on a near mark only", stSnap(30.3, [10, 30, 60], 0.5) === 30 && stSnap(31, [10, 30, 60], 0.5) === 31);
  const cues = [[0, "world", "julia"], [20, "world", "temple"], [20.5, "palette", "Sunset"], [40, "filter", "Neon"]];
  let r = stPut(cues, 20.3, "world", "gates", 100, -1);
  expect("studio: a new cue takes the place of one of its kind too near it", r.cues.filter(c => c[1] === "world").length === 2 && r.cues.some(c => c[2] === "gates") && !r.cues.some(c => c[2] === "temple"));
  r = stPut(cues, 40.1, "mirrors", "6", 100, -1);
  expect("studio: a cue too near another kind's is put just after it", Math.abs(r.t - (40 + SC_NEAR)) < 1e-9 && r.cues.length === 5);
  expect("studio: what it writes, the cleaner leaves alone", JSON.stringify(cleanTrack({ len: 100, cues: r.cues }).cues) === JSON.stringify(r.cues));
  r = stPut(cues, 30, "world", "temple", 100, 1);
  expect("studio: a cue moved is not doubled", r.cues.filter(c => c[2] === "temple").length === 1 && r.cues.find(c => c[2] === "temple")[0] === 30 && r.cues.length === 4);
  expect("studio: no room at the very end", stPut([[99.9, "filter", "Neon"]], 99.95, "mirrors", "6", 100, -1) === null);
  expect("studio: a soft kind may sit beside anything", stPut(cues, 40.1, "palette", "Ember", 100, -1).t === 40.1);
  const { stAlbumAt } = (await import("../js/studio.js")).__dbg;
  expect("studio: a place across the album strip is the track that lies there", stAlbumAt([95, 50], 0) === 0 && stAlbumAt([95, 50], 0.65) === 0 && stAlbumAt([95, 50], 0.66) === 1 && stAlbumAt([95, 50], 0.999) === 1 && stAlbumAt([10], 0.5) === 0);
  expect("studio: the lanes are By chance, then those in use", stLanes(cues).join() === "journey,world,palette,filter" && stLanes([]).join() === "journey,world,palette");
}

// ---- the choosers with pictures show their things by name (js/picker.js)
{
  const { pickSort } = (await import("../js/picker.js")).__dbg, by = n => pickSort(n).map(i => n[i]).join();
  expect("choosers: by name, with none first", by(["none", "Echo", "neon", "Solar", "Airbrush"]) === "none,Airbrush,Echo,neon,Solar");
  expect("choosers: numbers count as numbers, and off comes first", by(["Mirrors off", "Mirrors 3", "Mirrors 12", "Mirrors 4"]) === "Mirrors off,Mirrors 3,Mirrors 4,Mirrors 12" && by(["Surface grain", "Surface plain", "Surface chrome"]) === "Surface plain,Surface chrome,Surface grain");
}

// ---- finding a control in the panel by words in its name (js/controls.js)
{
  const { panMatch } = (await import("../js/controls.js")).__dbg;
  expect("panel: a control is found by any words of its name, whatever their case or order", panMatch("Light shafts off Light", "SHAFT") && panMatch("Record a loop Save and share", "loop record") && !panMatch("Eye off", "eye blink") && panMatch("anything", "  "));
}

// ---- the page names every file of the app for fetching at once, and makes a preloaded program ready a little at a time
{
  const { readdirSync, readFileSync } = await import("node:fs"), html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const files = readdirSync(new URL("../js/", import.meta.url)).filter(f => f.endsWith(".js")), lacking = files.filter(f => !html.includes('<link rel="modulepreload" href="js/' + f + '">'));
  const named = [...html.matchAll(/<link rel="modulepreload" href="js\/([^"]+)">/g)].map(m => m[1]).filter(f => !files.includes(f));
  expect("index.html has a modulepreload line for every file in js/, and for no other", lacking.length === 0 && named.length === 0, lacking.concat(named).join(", "));
}

// ---- writing a WebM file (js/webm.js): what is written is read back as a tree of elements
{
  const { webmStart, opusHead, ebml } = (await import("../js/webm.js")).__dbg;
  let file = new Uint8Array(0);
  const sink = { write: b => { const n = new Uint8Array(file.length + b.length); n.set(file); n.set(b, file.length); file = n; }, patch: (at, b) => file.set(b, at) };
  const w = webmStart({ w: 640, h: 360, fps: 30, codec: "V_VP9", audio: { channels: 2, rate: 48000, head: null } }, sink);
  // five seconds: pictures every 33.3 ms with a whole one every two seconds, sound every 20 ms, handed over out of step as two encoders would
  let ai = 0;
  for (let i = 0; i < 150; i++) {
    w.video(new Uint8Array([1, 2, 3, i & 255]), i * 1000 / 30, i % 60 === 0);
    if (i % 7 === 6) for (; ai * 20 < i * 1000 / 30 + 300 && ai < 250; ai++) w.audio(new Uint8Array([9, ai & 255]), ai * 20);
  }
  for (; ai < 250; ai++) w.audio(new Uint8Array([9, ai & 255]), ai * 20);
  const total = w.end(5000);
  // a reader: an element's number, its length, and where its contents begin
  const read = at => {
    let l = 1; while (!(file[at] & (0x80 >> (l - 1)))) l++;
    const id = [...file.slice(at, at + l)].map(x => x.toString(16).padStart(2, "0")).join("");
    let p = at + l, sl = 1; while (!(file[p] & (0x80 >> (sl - 1)))) sl++;
    let size = file[p] & (0xff >> sl); for (let k = 1; k < sl; k++) size = size * 256 + file[p + k];
    return { id, size, body: p + sl, end: p + sl + size };
  };
  const kids = (a, b) => { const o = []; for (let p = a; p < b;) { const e = read(p); o.push(e); p = e.end; } return o; };
  const top = kids(0, file.length), seg = top[1], inSeg = kids(seg.body, seg.end);
  expect("webm: the file is a heading and one Segment whose length is the rest of the file", total === file.length && top.length === 2 && top[0].id === "1a45dfa3" && seg.id === "18538067" && seg.end === file.length, top.map(e => e.id).join());
  const ids = inSeg.map(e => e.id), clusters = inSeg.filter(e => e.id === "1f43b675");
  expect("webm: in it, the list of places, Info, Tracks, the Clusters and Cues, in that order", ids[0] === "114d9b74" && ids[1] === "1549a966" && ids[2] === "1654ae6b" && ids[ids.length - 1] === "1c53bb6b" && clusters.length === ids.length - 4 && clusters.length === 3, ids.join());
  const u64 = at => { let n = 0; for (let k = 0; k < 8; k++) n = n * 256 + file[at + k]; return n; };
  const seeks = kids(inSeg[0].body, inSeg[0].end).map(s => { const k = kids(s.body, s.end); return [[...file.slice(k[0].body, k[0].end)].map(x => x.toString(16).padStart(2, "0")).join(""), u64(k[1].body)]; });
  expect("webm: each place in the list is where that element is", seeks.length === 3 && seeks.every(([id, at]) => read(seg.body + at).id === id), JSON.stringify(seeks));
  const info = kids(inSeg[1].body, inSeg[1].end), dur = info.find(e => e.id === "4489");
  expect("webm: it says how long it lasts", new DataView(file.buffer, dur.body, 8).getFloat64(0) === 5000);
  const tracks = kids(inSeg[2].body, inSeg[2].end);
  expect("webm: a track of pictures and a track of sound", tracks.length === 2 && String.fromCharCode(...file.slice(inSeg[2].body, inSeg[2].end)).includes("V_VP9") && String.fromCharCode(...file.slice(inSeg[2].body, inSeg[2].end)).includes("A_OPUS") && String.fromCharCode(...file.slice(inSeg[2].body, inSeg[2].end)).includes("OpusHead"));
  let order = true, nv = 0, na = 0, firstKey = true, lastT = -1;
  for (const c of clusters) {
    const k = kids(c.body, c.end); let ct = 0; for (let q = k[0].body; q < k[0].end; q++) ct = ct * 256 + file[q];
    k.slice(1).forEach((b, bi) => {
      const track = file[b.body] & 127, t = ct + ((file[b.body + 1] << 8) | file[b.body + 2]), key = !!(file[b.body + 3] & 0x80);
      if (t < lastT) order = false; lastT = t;
      if (track === 1) { nv++; if (bi === 0 && !key) firstKey = false; } else na++;
    });
    if ((file[k[1].body] & 127) !== 1) firstKey = false;
  }
  expect("webm: every picture and every piece of sound is there, in order of time, and each Cluster begins with a whole picture", nv === 150 && na === 250 && order && firstKey, nv + "/" + na + "/" + order + "/" + firstKey);
  const cues = kids(inSeg[inSeg.length - 1].body, inSeg[inSeg.length - 1].end);
  expect("webm: Cues has a place for each Cluster, and each is a Cluster", cues.length === 3 && cues.every(c => { const k = kids(c.body, c.end), tp = kids(k[1].body, k[1].end); return read(seg.body + u64(tp[1].body)).id === "1f43b675"; }));
  const oh = opusHead(2, 312);
  expect("webm: an OpusHead says two channels, 312 samples to pass over, 48000 a second", oh.length === 19 && oh[9] === 2 && (oh[10] | oh[11] << 8) === 312 && (oh[12] | oh[13] << 8 | oh[14] << 16) === 48000);
  expect("webm: a long element's length is written in eight bytes", ebml([0xA3], new Uint8Array(300)).length === 1 + 8 + 300 && ebml([0xA3], new Uint8Array(5)).length === 7);
}

// ---- filming a score (js/film.js): the arithmetic, and the file held in memory
{
  const { filmCodec, filmBitrate, filmLine, filmMemSink, FILM_SIZES } = (await import("../js/film.js")).__dbg;
  expect("film: the VP9 level is high enough for the size and rate", filmCodec(1280, 720, 30) === "vp09.00.31.08" && filmCodec(1920, 1080, 60) === "vp09.00.41.08" && filmCodec(3840, 2160, 60) === "vp09.00.52.08" && filmCodec(2560, 1440, 60) === "vp09.00.51.08");
  expect("film: the bits a second grow with the size and are held between 2 and 80 million", filmBitrate(1920, 1080, 60) > filmBitrate(1280, 720, 30) && filmBitrate(160, 90, 30) === 2e6 && filmBitrate(3840, 2160, 60) <= 80e6);
  expect("film: every size has even sides, as the encoders need", FILM_SIZES.every(s => s[1] % 2 === 0 && s[2] % 2 === 0));
  expect("film: what is said while filming", filmLine(1, 3, 75, 200, 2.04).startsWith("Filming track 2 of 3: 1:15 of 3:20, 2 times as fast as the music.") && filmLine(0, 1, 5, 60, 0.4).startsWith("Filming: 0:05 of 1:00, at 40 hundredths of the music's speed."), filmLine(1, 3, 75, 200, 2.04));
  const m = filmMemSink("x.webm");
  m.write(new Uint8Array([1, 2, 3, 4]));m.write(new Uint8Array([5, 6, 7, 8, 9]));m.patch(5, new Uint8Array([60, 70]));m.patch(0, new Uint8Array([10]));
  expect("film: held in memory, a file's bytes can be written over once their true values are known", m.size() === 9 && m.waiting() === 0 && m.failed() === null);
}

// ---- fly together: a privacy relay is told from a network that splits its ports (the report of 17 November 2026: an iPhone whose two servers saw 146.75.x.x and 104.28.x.x)
{
  const { tgMasked, tgSplit, tgVerdict } = togetherM, c = (typ, addr, port) => ({ typ, proto: "udp", addr, port, from: 0 });
  const relay = [c("host", "x.local", 63346), c("srflx", "146.75.1.2", 26785), c("srflx", "104.28.3.4", 34104)];
  const plain = [c("host", "a.local", 49846), c("host", "b.local", 62633), c("srflx", "73.83.1.2", 49846), c("srflx", "73.83.1.2", 62633)];
  const sym = [c("host", "x.local", 5000), c("srflx", "9.9.9.9", 100), c("srflx", "9.9.9.9", 200)];
  const two = [c("host", "w.local", 1), c("host", "m.local", 2), c("srflx", "1.1.1.1", 1), c("srflx", "2.2.2.2", 2)];
  expect("together: one port seen at two outside addresses is a privacy relay; two ports at one address is not, nor a device on two networks", tgMasked(relay) && !tgMasked(plain) && !tgMasked(sym) && !tgMasked(two));
  expect("together: the report names the relay and how to turn it off, on whichever side has it, before blaming the network", /^This side's two address servers.*Private Relay.*Turn it off on this device/.test(tgVerdict(relay, plain)) && /^The other side's.*Turn it off on that device/.test(tgVerdict(plain, relay)) && /symmetric NAT/.test(tgVerdict(sym, plain)) && tgSplit(sym));
}

// ---- a VR headset (js/xr.js): the numbers the shaders are given, from what a headset says each eye sees
{
  const { xrLensOf, xrSize, xrAxes, xrGovern, XR_SCALE_MIN } = (await import("../js/xr.js")).__dbg, { gyroTurn } = vr;
  const proj = (tl, tr, tu, td) => { const m = new Float32Array(16); m[0] = 2 / (tl + tr); m[5] = 2 / (tu + td); m[8] = (tr - tl) / (tr + tl); m[9] = (tu - td) / (tu + td); m[10] = -1; m[11] = -1; return m; };
  // each eye sees 50 degrees outward, 40 toward the nose, 42 up and 47 down
  const L = xrLensOf(proj(1.19, 0.84, 0.90, 1.07), proj(0.84, 1.19, 0.90, 1.07)), W = 2000, H = 1000;
  // in the left half (0 to W/2), straight ahead must lie where the tangent runs from -1.19 at the left edge to 0.84 at the right
  const tanPx = L.tan / W, cxL = W / 2 - L.off * W;
  expect("headset: the left eye's straight-ahead is where its own projection puts it, and a pixel covers the angle that fills the half", Math.abs(cxL * tanPx - 1.19) < 1e-4 && Math.abs((W / 2 - cxL) * tanPx - 0.84) < 1e-4, cxL + " " + tanPx);
  expect("headset: the right eye mirrors it", Math.abs((W / 2 + L.off * W - W / 2) * tanPx - 0.84) < 1e-4 && Math.abs((W - (W / 2 + L.off * W)) * tanPx - 1.19) < 1e-4);
  const sz = xrSize(1680, 0.4, L.aspect), cy = L.cy * sz[1], tp = L.tan / sz[0];
  expect("headset: straight-ahead is above the middle when the eye sees further down, and up and down a pixel covers the same angle as across", cy > 0 && Math.abs((sz[1] / 2 - cy) * tp - 0.90) < 0.01 && Math.abs((sz[1] / 2 + cy) * tp - 1.07) < 0.01, sz + " " + cy);
  expect("headset: the picture's sides are even numbers, and never tiny", sz[0] % 4 === 0 && sz[1] % 2 === 0 && xrSize(1680, 0.001, 1).join() === "128,64");
  // the head turned a tenth of a radian to its left (about its up axis): the pose's sixteen numbers, column by column
  const c = Math.cos(0.1), s = Math.sin(0.1), w = gyroTurn(xrAxes([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), xrAxes([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]));
  expect("headset: a turn of the head comes out as a turn about the head's own up axis, of the same size", Math.abs(w[0]) < 1e-6 && Math.abs(w[1] - 0.1) < 1e-6 && Math.abs(w[2]) < 1e-6, w.join());
  const g = { scale: 0.4, max: 0.8, good: 0, rose: false };
  for (let i = 0; i < 40; i++) xrGovern(g, 30, 13.9);
  expect("headset: pictures that keep coming late bring the size down to its least and no further", g.scale === XR_SCALE_MIN);
  const g2 = { scale: 0.4, max: 0.8, good: 0, rose: false }; let grew = 0;
  for (let i = 0; i < 200; i++) if (xrGovern(g2, 13.9, 13.9)) grew++;
  expect("headset: pictures on time let it grow, a step every fourth telling, up to its most", g2.scale > 0.79 && g2.scale <= 0.8 && grew > 5 && grew < 20, g2.scale + " " + grew);
  const g3 = { scale: 0.5, max: 0.8, good: 3, rose: false };
  xrGovern(g3, 13.9, 13.9); const up = g3.scale; xrGovern(g3, 20, 13.9);
  expect("headset: a size that proved too much is not tried again", g3.max < up && g3.scale < 0.5, up + " " + g3.max);
}

// ---- the dancers: kinds of dancing that suit the music, partners, and the head's own turn
{
  const { __dbg: dn } = await import("../js/dance.js"), { __dbg: mv } = await import("../js/moves.js"), { sel, OVERLAYS } = await import("../js/state.js");
  const best = (per, lv) => Object.keys(mv.MV_STYLES).sort((a, b) => dn.styleFit(b, per, lv) - dn.styleFit(a, per, lv))[0];
  expect("every kind of dancing has a speed and a fullness it suits; a fast full passage suits the rave best and a slow quiet one the groove", Object.keys(mv.MV_STYLES).every(k => dn.DN_FIT[k] && dn.styleFit(k, 0.5, 0.5) > 0.29 && dn.styleFit(k, 0.5, 0.5) < 3.31) && best(0.38, 0.95) === "rave" && best(0.62, 0.25) === "groove" && dn.styleFit("nothing", 0.5, 0.5) === 1, best(0.38, 0.95) + " " + best(0.62, 0.25));
  const was = sel.ovi, rand = Math.random, dt = 1 / 60, hit = (t, per) => Math.exp(-5 * (t % per)); let sd = 99; Math.random = () => (sd = sd * 16807 % 2147483647) / 2147483647;
  dn.danceTick = dn.makeBeatClock(); sel.ovi = 0; dn.stepDance({ dt, bt: 0, mp: 0 }); sel.ovi = OVERLAYS.findIndex(v => v.dance === 3); dn.stepDance({ dt, bt: 0, mp: 0 });
  { const o = [0, 0, 0], seen = [new Set(), new Set(), new Set()], top = [0, 0, 0]; let round = true, calm2 = true;
    for (const h of dn.DN_HEADS) { const a = [], b = []; for (let u = 0; u < 16; u += 1 / 16) { h.f(u, o); o.forEach((v, j) => top[j] = Math.max(top[j], Math.abs(v))); } h.f(0.3, o); a.push(...o); h.f(16.3, o); b.push(...o); if (a.some((v, j) => Math.abs(v - b[j]) > 1e-6)) round = false;
      let was = null; for (let u = 0; u < 16; u += 1 / 150) { h.f(u, o); if (was && o.some((v, j) => Math.abs(v - was[j]) * 150 * 2.75 > 6)) calm2 = false; was = o.slice(); } }
    for (let n = 0; n < 400; n++) dn.DN_MANNERS.forEach((mn, q) => seen[q].add(dn.pickHead(mn, (n + 0.5) / 400)));
    expect("a head keeps time by turning, nodding (down and up) and tipping, each way coming round in sixteen beats and none faster than a head can go", top[0] > 0.4 && top[1] > 0.3 && top[2] > 0.2 && top.every(v => v < 0.6) && round && calm2 && seen[0].size === dn.DN_HEADS.length && seen[1].size === dn.DN_HEADS.length && seen[2].size >= dn.DN_HEADS.length - 1, top.join(" ")); }
  let pairs = 0, faced = 0, mirrored = 0, turn = 0, one = true, nods = [9, -9], tips = 0;
  for (let n = 0; n < 60 * 150; n++) {
    dn.danceStep(dt, hit(n * dt, 0.47), 0, 0.8, false, false, false, n * dt);
    dn.crowd.forEach((d, i) => {
      turn = Math.max(turn, Math.abs(d.hy)); nods = [Math.min(nods[0], d.hv[1]), Math.max(nods[1], d.hv[1])]; tips = Math.max(tips, Math.abs(d.hv[2]));
      if (d.pw < 0) return;
      const o = dn.crowd[d.pw]; if (!o || o.pw !== i) { one = false; return; }
      if (i < d.pw) { pairs++; if (d.mv === o.mv && d.mir !== o.mir && d.u0 === o.u0) mirrored++; }
    });
  }
  expect("in a crowd two figures now and then dance together, each the other's partner, and the second comes to do the first's move as in a mirror", pairs > 600 && one && mirrored > 0.3 * pairs, pairs + " " + mirrored);
  expect("a head turns on its neck, and never further than a head can", turn > 0.3 && turn < 1.65, String(turn));
  expect("in a crowd some head looks up, some nods down and some tips to the side, and what the shader is told of the nod is a whole number of steps and a part", nods[0] < -0.15 && nods[1] > 0.15 && tips > 0.1 && dn.dnU[9][3] >= 0 && dn.dnU[9][3] < 256, nods.join(" ") + " " + tips);
  Math.random = rand; sel.ovi = was; dn.stepDance({ dt, bt: 0, mp: 0 });
}

console.log(failed ? failed + " failed" : "all passed");
process.exit(failed ? 1 : 0);
