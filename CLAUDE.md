# Mirrorfold

A first-person fly-through of endless fractal worlds in the browser: WebGL 1 raymarching, a MilkDrop-style feedback and filter chain, music reactivity, and a templated autopilot ("Journey"). The whole app is `index.html`. No build step, no dependencies.

Read `docs/ARCHITECTURE.md` before changing anything substantial. It covers the render pipeline, the math of every world, the audio analysis, the journey engine, known weaknesses and a suggested refactor.

## Commands

```
node tools/unit.mjs                     # pure-logic tests (change detector, weighted picker, head-turn math, pack cleaners)
node tools/pack.mjs                     # check every pack in packs/ with the app's own cleaners
python3 tools/check.py                  # headless smoke test: all shaders compile, no script or GL errors
python3 tools/render.py --world julia -o out.png          # screenshot one world
python3 tools/render.py --all -o sheet.jpg                # contact sheet of every world
python3 tools/render.py --world temple --js "setLook(2)" -o neon.png
python3 tools/render.py --world sponge --size 852x393 --js "setStereo(true)" -o vr.png   # VR viewer picture
```

The Python tools need `google-chrome` or `chromium` on PATH (they run it headless with software WebGL). `--all` also needs Pillow. To view the app, open `index.html` directly or serve the folder with `python3 -m http.server`.

## Rules that are easy to break

- **Every world has its distance estimator twice**: GLSL in `glsl` (`map`) and JavaScript in `de`. They must match. JavaScript uses it for flight speed, autopilot steering and orb placement.
- **Every world's field must be exactly periodic** with its `period`. The camera position is wrapped by that period every frame.
- **`tools/harness.py` depends on the first and last lines of the script** (`<script>\n(function(){` and `requestAnimationFrame(frame);\n})();`). It asserts on them. If you restructure the script, update the harness in the same change.
- **`tools/unit.mjs` extracts `makeChangeDetector`, `jPick`, `devMat`, `gyroTurn`, `userActive`, `cleanName`, `cleanPalette`, `cleanMotion`, `cleanCode`, `cleanFilter` and `cleanOverlay` by name** with a regex that expects the function to end with a `}` at the start of a line. `tools/pack.mjs` extracts the cleaners the same way. Extracted functions must not use anything outside themselves and each other.
- **Packs never carry JavaScript.** Everything read from a pack, pasted text or `localStorage["mirrorfold-library"]` goes through `loadPack` and the cleaners. Do not add a field that is evaluated as script, used as HTML, or used as a URL. New numeric fields need a range in the cleaner and in `packs/README.md`.
- **Pack filter and overlay code is GLSL, checked by `cleanCode`.** Filter code has no clock: do not give it any input that changes with time or sound. Overlay code has the clock and the sound. Do not loosen a rule in `cleanCode` without reading why it is there (architecture doc, section 11, Packs). While any code that is not `reviewed` is in use, the flash limiter in pass 4 of `frame()` must be on. Only `loadPack(text, "site")` may mark code reviewed.
- **The editor writes through the cleaners.** A new slider needs a row in `ED`, a range in the cleaner and a line in `packs/README.md`, all agreeing.
- **Palettes, motions, filters and overlays can be added and removed at run time.** Built-ins come first (`NPAL`, `NMOT`, `NLOOK`, `NOV`). Use `palOpen(i)` for whether a palette is usable, and call `refreshLists()` after changing either list.
- **Journey templates are keyed by option name**, not index (`"Melt"`, `"julia"`, `"6"`). Renaming a world id, motion, filter, overlay or palette silently drops it from users' saved templates.
- **Motion parameters are per frame at 60 fps** and are corrected for frame time where they are applied in `frame()`. Keep new ones consistent.
- **The VR viewer draws one picture per eye.** Anything centred on the screen (a feedback warp, an overlay, a filter that moves pixels, zoom blur, fringing) shows each eye something different and must be switched off while `stereo` is true. `frame()` does this in one place per pass; new effects need the same treatment.
- **User look input goes through `userLook(dx, dy)`**, not straight into `lookX`/`lookY`. That is how the autopilot knows to stand back while the user steers. The autopilot itself still writes `lookX`/`lookY` directly.
- **Nothing may strobe.** Pulses are soft and slow by design (tap tempo above about 165 BPM is halved). Respect `calm` (`prefers-reduced-motion`).

## Conventions

- ES5 style throughout: `var`, function declarations, one IIFE, closure state. Match it unless you are doing the module split described in the architecture doc.
- Shaders are arrays of strings joined with newlines. GLSL ES 1.00 only: constant loop bounds, no dynamic indexing of uniform arrays, float literals need a decimal point.
- Comments say what a block is for in plain words. Keep that.
- User-facing text is plain and literal: a control says exactly what it does.
- After any shader change run `python3 tools/check.py`, and render the affected world or effect and look at it. Several bugs in this project's history compiled cleanly and looked wrong.

## Verified and unverified

Everything was developed against headless Chrome with software rendering. Real-device frame rate, multi-touch gestures, how the audio sounds, and several iOS behaviours have never been tested by the author. The list is in the architecture doc, section 14. Treat user reports from a real phone as more reliable than the harness.

## Deploying

GitHub Pages serves `index.html` as is. `.nojekyll` is there so Pages does not run Jekyll.
