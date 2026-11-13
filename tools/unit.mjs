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

console.log(failed ? failed + " failed" : "all passed");
process.exit(failed ? 1 : 0);
