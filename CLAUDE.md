# Mirrorfold

A first-person fly-through of endless fractal worlds in the browser: WebGL 1 raymarching, a MilkDrop-style feedback and filter chain, music reactivity, and a templated autopilot ("Journey"). The app is `index.html` (markup), `css/app.css` and ES modules in `js/`. No build step, no dependencies.

Read `docs/ARCHITECTURE.md` before changing anything substantial. It covers the render pipeline, the math of every world, the audio analysis, the journey engine, known weaknesses and a suggested refactor.

## Commands

```
node tools/unit.mjs                     # pure-logic tests (change detector, weighted picker, head-turn math, pack cleaners)
node tools/pack.mjs                     # check every pack in packs/ with the app's own cleaners, and that packs/index.json is up to date
node tools/gallery.mjs                  # write packs/index.json from the pack files (never edit it by hand)
python3 tools/check.py                  # headless smoke test: all shaders compile, no script or GL errors
python3 tools/probe.py                  # every world's GLSL map against its JavaScript de, through the distance probe
python3 tools/render.py --world julia -o out.png          # screenshot one world
python3 tools/render.py --all -o sheet.jpg                # contact sheet of every world
python3 tools/render.py --world temple --js "setLook(2)" -o neon.png
python3 tools/render.py --world sponge --js "setLand(2);setLandFx(1)" -o land.png   # the land over a world; setLand(1) is the land alone; setLandKind(1) canyon, (2) strange planet, (3) steel ball, (4) city
python3 tools/render.py --world sponge --size 852x393 --js "setStereo(true)" -o vr.png   # VR viewer picture
```

The Python tools need `google-chrome` or `chromium` on PATH (they run it headless with software WebGL). `--all` also needs Pillow. To view the app, serve the folder with `python3 -m http.server` (modules do not load from `file://`).

## Rules that are easy to break

- **Every world has its distance estimator twice**: GLSL in `glsl` (`map`) and JavaScript in `de`. They must match. JavaScript uses it for flight speed, autopilot steering and orb placement.
- **The land has its height twice too**: the noise sum in `terrL`/`terrM` (in `LAND_T`) and in `landH`, both reading the table `LTAB`, and each landscape's `shape` in its GLSL and in its `LK` entry. They must match. A landscape's free-standing shapes are twice too: `extra` in GLSL and in JavaScript. So are the city's blocks (`block` in `citySrc`, `cityBlock` in JavaScript). `shapeU` must never be below `shape` over a range of 0.047 either side. Its layers use the whole-number matrix `[2 -1; 1 2]` so that it repeats exactly every `LPERIOD`; do not replace it with an arbitrary rotation.
- **The land shader measures from the camera.** World positions go in through `uCi`/`uCf` and the like, worked out in doubles in `landPass`. Do not add a pattern finer than about 1/50 unit that is computed from `uPos` in the shader: it will shake.
- **Every world's field must be exactly periodic** with its `period`. The camera position is wrapped by that period every frame.
- **Start-up code goes in a file's `init()`, not at its top level.** `js/main.js` calls the `init()`s in a fixed order. A module's top level may hold only function declarations, `let` declarations, and constants built from literals and other constants of the same file. That keeps load order irrelevant and lets the Node tools import modules without a page.
- **Every value has one owning file.** A module cannot assign to a variable it imports, so a value is set only by its own file: `export let` there, read by import elsewhere, changed from outside only through that file's functions. State that a frame changes in many places lives in five objects: `cam` (camera.js), `tr` (warp.js), `clock` (clock.js), `scene` (choose.js), `sel` (state.js). Do not add a catch-all shared object.
- **`frame()` in `js/loop.js` is a list of steps.** A new per-frame behaviour is a new step, or part of an existing one, in the file that owns what it changes. Steps hand values on through the frame's notes (`fr`); add a new field to the comment above it in `loop.js`.
- **A name in `__dbg` must not be used by another file's `__dbg`.** `main.js` merges them all into `window.MF`, so the later one hides the earlier and a test calls the wrong thing. `tools/unit.mjs` fails on a repeat.
- **Every file ends with `__dbg`**, a getter (and setter, if it changes) for each of its names; `main.js` merges them into `window.MF` (and offers the fields of the five state objects by bare name), which is how `tools/harness.py` and `--js` reach internals. A new name that a test or `--js` uses must be added to its file's `__dbg`. The harness asserts on the exact `<script type="module" src="js/main.js">` tag.
- **`tools/unit.mjs` and `tools/pack.mjs` import functions from the modules.** Those functions must stay free of the page: no `document`, no `gl`, none of the state objects.
- **Packs never carry JavaScript.** Everything read from a pack, pasted text or `localStorage["mirrorfold-library"]` goes through `loadPack` and the cleaners. Do not add a field that is evaluated as script, used as HTML, or used as a URL. New numeric fields need a range in the cleaner and in `packs/README.md`.
- **The gallery is the `packs/` folder, and merging into it is the review.** `tools/offer.mjs` and `.github/workflows/offer.yml` turn an issue from a stranger into a pull request. Keep the issue as data: nothing from it may reach a shell command, a file path or a workflow expression except the issue number and the file name `slug()` makes.
- **A pack world has no JavaScript `de`.** Anything that needs a distance from `world` must work when `world.pack` is true: use `deMany` for many points and `packD` (filled by `packFrame`) inside `frame()`. `world.de` on a pack world is one probe, which makes the page wait for the graphics chip, so do not call it in a loop. Pack worlds are added and removed at run time after the built-ins (`NWORLD`); call `refreshLists()` afterwards.
- **Pack filter, overlay and world code is GLSL, checked by `cleanCode`.** World code has no clock and no sound either, and is folded into its period before it runs. Filter code has no clock: do not give it any input that changes with time or sound. Overlay code has the clock and the sound. Do not loosen a rule in `cleanCode` without reading why it is there (architecture doc, section 11, Packs). While any code that is not `reviewed` is in use, the flash limiter in pass 4 of `frame()` must be on. Only `loadPack(text, "site")` may mark code reviewed.
- **The editor writes through the cleaners.** A new slider needs a row in `ED` (with its help sentence, which the Help button shows), a range in the cleaner and a line in `packs/README.md`, all agreeing.
- **Palettes, motions, filters and overlays can be added and removed at run time.** Built-ins come first (`NPAL`, `NMOT`, `NLOOK`, `NOV`). Use `palOpen(i)` for whether a palette is usable, and call `refreshLists()` after changing either list.
- **Journey templates are keyed by option name**, not index (`"Melt"`, `"julia"`, `"6"`). Renaming a world id, motion, filter, overlay or palette silently drops it from users' saved templates.
- **Motion parameters are per frame at 60 fps** and are corrected for frame time where they are applied in `frame()`. Keep new ones consistent. A motion's drivers go through `driven()`, which holds the result inside `MOTION_LIM`; do not let `decay`, `kick` or any filter number be driven by the sound.
- **The VR viewer draws one picture per eye.** Anything centred on the screen (a feedback warp, an overlay, a filter that moves pixels, zoom blur, fringing) shows each eye something different and must be switched off while `stereo` is true. `frame()` does this in one place per pass; new effects need the same treatment.
- **Shaders read the video only through `tV` in `js/video.js`**, the copy whose brightness is rate-limited by `videoFrame`. Never bind the raw video texture in a drawing pass: a user's video may strobe. Ways of showing it that are flat on the screen are off in the VR viewer (`d3` in `VMODES`).
- **Hold still averages frames of a scene that must not change.** While `stillN` is not zero the scene shader gets no sound and no clock runs. Anything new that changes the scene from frame to frame must either stop while `still` is true or be added to what `stillAim` compares.
- **User look input goes through `userLook(dx, dy)`**, not straight into `lookX`/`lookY`. That is how the autopilot knows to stand back while the user steers. The autopilot itself still writes `lookX`/`lookY` directly.
- **Nothing may strobe.** Pulses are soft and slow by design (tap tempo above about 165 BPM is halved). Respect `calm` (`prefers-reduced-motion`).

## Conventions

- Inside the files the style is still ES5: `var`, function declarations, no classes. Module syntax (`import`, `export`, `const`, `let`) is used only at the top level of a file.
- Shaders are arrays of strings joined with newlines. GLSL ES 1.00 only: constant loop bounds, no dynamic indexing of uniform arrays, float literals need a decimal point.
- Comments say what a block is for in plain words. Keep that.
- User-facing text is plain and literal: a control says exactly what it does.
- After any shader change run `python3 tools/check.py`, and render the affected world or effect and look at it. Several bugs in this project's history compiled cleanly and looked wrong.

## Verified and unverified

Everything was developed against headless Chrome with software rendering. Real-device frame rate, multi-touch gestures, how the audio sounds, and several iOS behaviours have never been tested by the author. The list is in the architecture doc, section 14. Treat user reports from a real phone as more reliable than the harness.

## Deploying

GitHub Pages serves `index.html`, `css/` and `js/` as they are. `.nojekyll` is there so Pages does not run Jekyll.
