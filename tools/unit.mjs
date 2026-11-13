// Unit tests for the pieces of pure logic, extracted from index.html by name:
//   makeChangeDetector  decides when the music has changed enough to trigger a world change
//   jPick               picks a journey's next option, including the weighted mirror choice
//   devMat, gyroTurn    turn the phone's orientation angles into a head turn for the VR viewer
//
//   node tools/unit.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "index.html"), "utf8");
function grab(name) {
  const m = src.match(new RegExp("function " + name + "\\([^)]*\\)\\{[\\s\\S]*?\\n\\}"));
  if (!m) throw new Error("could not find function " + name + " in index.html");
  return m[0];
}
const { makeChangeDetector, jPick, devMat, gyroTurn } = new Function(
  grab("makeChangeDetector") + "\n" + grab("jPick") + "\n" + grab("devMat") + "\n" + grab("gyroTurn") +
  "\nreturn {makeChangeDetector,jPick,devMat,gyroTurn};")();

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

console.log(failed ? failed + " failed" : "all passed");
process.exit(failed ? 1 : 0);
