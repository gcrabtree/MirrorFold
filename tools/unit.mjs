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
import { __dbg as pictureM } from "../js/picture.js";
import { __dbg as galleryM } from "../js/gallery.js";
import { __dbg as recordM } from "../js/record.js";
import { __dbg as sparkM } from "../js/spark.js";
import { __dbg as midiM } from "../js/midi.js";
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

// ---- window.MF: main.js merges every module's __dbg into one object, so a name used by two modules hides one of them
{
  const { readdirSync } = await import("node:fs"), dir = new URL("../js/", import.meta.url), seen = {}, twice = [];
  for (const f of readdirSync(dir).filter(f => f.endsWith(".js") && f !== "main.js")) {
    const m = await import(new URL(f, dir));
    for (const k of Object.keys(m.__dbg || {})) { if (seen[k]) twice.push(k + " (" + seen[k] + ", " + f + ")"); seen[k] = f; }
  }
  expect("no name is listed for the test tools by two modules", twice.length === 0, twice.join("; "));
}

console.log(failed ? failed + " failed" : "all passed");
process.exit(failed ? 1 : 0);
