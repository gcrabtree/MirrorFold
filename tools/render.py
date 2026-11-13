#!/usr/bin/env python3
"""Render Mirrorfold worlds to PNG in headless Chrome.

Examples:
  python3 tools/render.py --world julia -o julia.png
  python3 tools/render.py --world temple --palette 1 --js "setLook(2);setMirrors(3)" -o neon.png
  python3 tools/render.py --all -o sheet.jpg            # contact sheet of every world
  python3 tools/render.py --world halls --js "setMotion(3);setOverlay(1);journey=true" --fast --budget 6000 -o trails.png

--js runs inside the page's closure, so it can call any internal function:
  setPalette(i) setMirrors(i) setMotion(i) setLook(i) setOverlay(i)
  trType=n;warp=0.6   (freeze a transition part way through)
"""
import argparse, os, re, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import INDEX, screenshot

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("--world", default="lattice", help="world id, e.g. lattice, julia, gates")
ap.add_argument("--all", action="store_true", help="render every world into one contact sheet")
ap.add_argument("--palette", type=int, default=0)
ap.add_argument("--js", default="", help="extra JavaScript to run in the page")
ap.add_argument("--size", default="420x700")
ap.add_argument("--budget", type=int, default=2500, help="virtual milliseconds to run before the shot")
ap.add_argument("--fast", action="store_true", help="half resolution: more frames in the same budget")
ap.add_argument("-o", "--out", default="render.png")
a = ap.parse_args()
w, h = (int(x) for x in a.size.split("x"))
# started=true skips the start card's slow drift; orbs off keeps shots comparable.
base = f"started=true;orbsOn=false;setPalette({a.palette});{a.js};"
q = "fast" if a.fast else "sharp"

if not a.all:
    screenshot(a.out, base, a.world, (w, h), a.budget, quality=q)
    print("wrote", a.out)
else:
    from PIL import Image
    ids = re.findall(r'\{id:"([a-z]+)",name:', open(INDEX, encoding="utf-8").read())
    tw, th, cols = 300, 500, 6
    rows = (len(ids) + cols - 1) // cols
    sheet = Image.new("RGB", (tw * cols, th * rows))
    with tempfile.TemporaryDirectory() as d:
        for i, wid in enumerate(ids):
            p = screenshot(os.path.join(d, wid + ".png"), base, wid, (tw, th), a.budget, quality=q)
            sheet.paste(Image.open(p).convert("RGB").resize((tw, th)), ((i % cols) * tw, (i // cols) * th))
            print("rendered", wid)
    sheet.save(a.out, quality=88)
    print("wrote", a.out)
