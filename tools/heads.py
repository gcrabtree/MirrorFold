#!/usr/bin/env python3
"""Pictures of every one of the dancers' heads at eight turns round, drawn large by the shader's own code.

  python3 tools/heads.py out          # writes out-0.png and out-8.png (eight heads each), upright
  python3 tools/heads.py out 0.35     # the same with every head leant on its neck by 0.35 radians

Rows are the heads, columns the turns 0, 45, ... 315 degrees: 0 faces the viewer, at 90 the face is to the picture's
right, at 180 the back of the head is seen. Look for: the face and the hair's edge keeping their places against
each other; nothing on the far side of the head showing through it; nothing over the eyes; hair on the back of a
head that is turned away. Needs node, and google-chrome or chromium on PATH (tools/heads.mjs makes the page)."""
import os, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import chrome
here = os.path.dirname(os.path.abspath(__file__))
out = sys.argv[1] if len(sys.argv) > 1 else "heads"
tilt = sys.argv[2] if len(sys.argv) > 2 else "0"
for part in (0, 8):
    with tempfile.TemporaryDirectory() as d:
        page = os.path.join(d, "heads.html")
        subprocess.run(["node", os.path.join(here, "heads.mjs"), page, tilt, str(part), "8"], check=True)
        png = f"{out}-{part}.png"
        subprocess.run([chrome(), "--headless", "--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
                        "--hide-scrollbars", f"--screenshot={os.path.abspath(png)}", "--window-size=1200,1400", "file://" + page],
                       check=True, capture_output=True)
        try:  # some Chrome builds count the window's frame in its size, so the window is asked for taller and the picture cut back
            from PIL import Image
            Image.open(png).crop((0, 0, 1200, 1200)).save(png)
        except ImportError:
            pass
        print("wrote", png)
