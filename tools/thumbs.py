#!/usr/bin/env python3
"""Make the small pictures the choosers show: one for every built-in world, palette, motion, filter, overlay,
mirror setting, FX setting and landscape. They go in thumbs/ as 240x150 JPEGs named by js/picker.js's thumbName.

  python3 tools/thumbs.py              # all of them (several minutes: software rendering)
  python3 tools/thumbs.py world        # one kind: world, palette, motion, filter, overlay, mirrors, fx, surface, land, packing
  python3 tools/thumbs.py world-foam   # one picture

Run it after adding or changing a world, palette, motion, filter, overlay or landscape. tools/unit.mjs fails
if a built-in has no picture. Needs Pillow, and node to read the lists from the modules.
"""
import json, os, subprocess, sys, tempfile
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness
from PIL import Image

ROOT = harness.ROOT
OUT = os.path.join(ROOT, "thumbs")
REF = "temple"      # the world that palettes, motions, filters, mirrors, FX and surfaces are shown on
DARK = "aurora"     # overlays are light drawn on top, so they are shown on a dark world

LISTS = r'''
import {WORLDS} from "./js/worlds.js"; import {PALETTES} from "./js/palettes.js";
import {MOTIONS,LOOKS,OVERLAYS,FX,SURFACES,mirrors} from "./js/state.js"; import * as land from "./js/landscapes.js";
import {thumbName} from "./js/picker.js"; import {PACKINGS} from "./js/packing.js";
const o=[]; const add=(kind,key,world,js,slow)=>o.push({file:thumbName(kind,key),world,js,slow:!!slow});
WORLDS.forEach(w=>add("world",w.id,w.id,""));
PALETTES.forEach((p,i)=>add("palette",p.name,"REF","unlocked=99;setPalette("+i+")"));
MOTIONS.forEach((m,i)=>add("motion",m.name,"REF","setMotion("+i+")",true));
LOOKS.forEach((f,i)=>add("filter",f.name,"REF","setLook("+i+")"));
OVERLAYS.forEach((v,i)=>add("overlay",v.name,"DARK","setOverlay("+i+");setOvS(4)"+(v.dance?";musicMode='tap';tapInt=0.5;tapAt=0;stepDance({dt:0.016,bt:0,mp:0});for(var q=0;q<340;q++)danceStep(1/60,Math.exp(-5*(q/60%0.5)),0,0.8,false,false,false,q/60)":""))); /* the dancers are shown dancing: some seconds of a beat are danced through first, and a tapped beat keeps them going */
mirrors.forEach((m,i)=>add("mirrors",m,"REF","setMirrors("+i+")"));
FX.forEach((f,i)=>add("fx",f.name,"REF","fi="+i,true));
SURFACES.forEach((f,i)=>add("surface",f.name,"REF","setSurface("+i+")"));
PACKINGS.forEach((f,i)=>add("packing",f.name,"julia","setPacking("+i+")"));
land.init(); /* the list of landscapes is made at start-up */
land.LK.forEach((k,i)=>add("land",k.id,"sponge","setLand(1);setLandKind("+i+")"+(k.id==="ball"?";cam.lookY=0.8":"")));
console.log(JSON.stringify(o));
'''


def jobs():
    out = subprocess.run(["node", "--input-type=module", "-e", LISTS], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def one(j, tmp):
    world = {"REF": REF, "DARK": DARK}.get(j["world"], j["world"])
    png = os.path.join(tmp, os.path.basename(j["file"]) + ".png")
    # motions and trails only show after many frames, so those run longer at half resolution
    # The same picture every run: worlds with no fixed start choose one by chance, so chance is replaced by a fixed
    # run of numbers and the world entered again. The palette is put in place at once; in the app it eases in.
    first = "var sd=11;Math.random=function(){sd=(sd*16807)%2147483647;return sd/2147483647};" \
            "started=true;orbsOn=false;flitsOn=false;setWorldNow(WORLDS.indexOf(scene.world),true);"
    harness.screenshot(png, first + j["js"] + ";easePalette(60);", world, (480, 300),
                       9000 if j["slow"] else 3500, quality="fast" if j["slow"] else "sharp")
    Image.open(png).convert("RGB").resize((240, 150), Image.LANCZOS).save(os.path.join(ROOT, j["file"]), quality=82, optimize=True)
    return j["file"]


if __name__ == "__main__":
    want = sys.argv[1] if len(sys.argv) > 1 else ""
    todo = [j for j in jobs() if os.path.basename(j["file"]).startswith(want)]
    if not todo:
        raise SystemExit("nothing is named " + want)
    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        one(todo[0], tmp)  # the first alone: it measures the window, which the others then share
        print("wrote", todo[0]["file"])
        with ThreadPoolExecutor(max_workers=max(1, (os.cpu_count() or 2) // 2)) as ex:
            for f in ex.map(lambda j: one(j, tmp), todo[1:]):
                print("wrote", f)
