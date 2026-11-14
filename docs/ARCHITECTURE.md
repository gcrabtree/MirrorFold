# Mirrorfold: project, architecture, math and code

This document is written for an engineer (or a Claude Code session) picking the project up cold. It describes what the app does, how the code is laid out, the math behind each part, how to test it, and what is known to be weak.

The app is `index.html` (markup), `css/app.css` and about 35 JavaScript modules in `js/` (about 4,500 lines in all, GLSL included). There is no build step and there are no dependencies apart from two Google Fonts. It began as one file; section 17 describes the split.

## 1. What it is

Mirrorfold is a first-person fly-through of endless fractal worlds, rendered by raymarching in a WebGL 1 fragment shader, with a MilkDrop-style feedback and filter chain on top and music reactivity underneath. It is designed for a phone first (touch controls, adaptive resolution) and also works with mouse and keyboard.

Features, in the order a user meets them:

- **20 worlds.** 16 are surfaces found by sphere tracing a distance estimator; 2 (Nebula, Aurora) are volumetric; 2 (Mandelbrot zoom, Julia zoom) are flat pictures (section 6c).
- **Free flight** with six degrees of freedom. Speed scales with distance to the nearest surface, so you cannot hit a wall.
- **Kaleidoscope mirrors**: off, 3, 4, 6, 8 or 12 segments, applied to the ray direction.
- **13 palettes** (7 available at once, 6 unlocked by finding orbs).
- **Feedback motions** (6), **filters** (17), **overlays** (7) and **transitions** (8).
- **Music**: a built-in generative track, a user's audio file with a scrubber, the sound of another browser tab, the microphone, or tap tempo for music playing in another app. Three frequency bands drive different parts of the picture.
- **Journey**: an autopilot that flies, and changes world, palette, mirrors, motion, filter and overlay on jittered clocks. What it may change is set by templates; sets play several templates in turn. Both are user-editable and stored in the browser.
- **Orbs** to find, **Share spot** links, and a morphing parameter that makes every world breathe.
- **VR viewer**: side-by-side stereo with gyroscope look, for a phone in a Cardboard-style holder (section 13).

## 2. Running and deploying

Serve the folder with any static web server (`python3 -m http.server`) and open it. It no longer works straight from `file://`, because browsers refuse to load modules from there.

For GitHub Pages: put `index.html`, `css/` and `js/` at the root of the published branch (or in `/docs` if Pages is set to that folder). The empty `.nojekyll` file stops Pages from running Jekyll over the repo. No configuration is needed.

### Full screen on iPhone

Safari on iPhone has no Fullscreen API for pages, so the Fullscreen button hides itself there. The `<head>` carries `apple-mobile-web-app-capable` and related tags so that "Add to Home Screen" opens the page as a standalone web app without browser bars, with `apple-touch-icon.png` (a crop of `docs/worlds.jpg`) as its icon. The viewport uses `viewport-fit=cover` and the status bar style is `black-translucent`, so the canvas runs under the status bar and notch; a block at the end of the `<style>` pads `#hud`, `#adv`, `#start` and `#err` by `env(safe-area-inset-*)`. A home-screen web app has its own `localStorage`, separate from Safari's.

### What changed from the Claude artifact version

The app was built as a Claude artifact, which runs in a sandboxed frame with a strict content security policy. The bundled `index.html` differs from the artifact in one place: **Share spot** now builds its link from `location.href` rather than a hard-coded artifact URL.

Several design decisions were forced by the artifact sandbox and are no longer constraints on GitHub Pages. They are listed here because they explain choices in the code that might otherwise look odd, and because they are the obvious next features:

| Artifact constraint | Effect on the current code | Now possible |
|---|---|---|
| Microphone blocked | There was no live audio input. Tap tempo exists as the workaround for Apple Music and other apps. | Done: the Microphone and Listen to a tab sources (section 10). Both need HTTPS, which Pages provides. |
| Device motion blocked | Look was touch or mouse only. | Done for the VR viewer (section 13). Gyroscope look outside that mode is still open. |
| Only `#name` hashes passed through | Share spot packs all state into one token of letters, digits and a hyphen. | Query strings or richer hashes, if wanted. The current encoding still works. |
| Scripts only from a short CDN list | No libraries are used. Apple's MusicKit could not load. | Any script. Note that Apple Music audio still cannot be analysed: it is DRM-protected and never reaches Web Audio. |
| No downloads | Packs can be copied and pasted as JSON text, as well as saved and loaded as files. | Nothing further. |
| `alert`/`confirm` blocked | Delete uses a two-tap button. | Unchanged; the two-tap pattern is fine. |
| Per-viewer `localStorage` only | Templates, orb progress and the orbs toggle live in `localStorage`. | Unchanged on Pages. |

## 3. File map

| File | Contents |
|---|---|
| `index.html` | Markup only: the canvas, the controls, the start card, the setup panel |
| `css/app.css` | All styling |
| `js/main.js` | Loads every file below, runs each one's `init()` in this order, then publishes `window.MF` |
| `js/dom.js` | `$`, the canvas, the WebGL context, touch and reduced-motion detection, `STEPS`, `toast` |
| `js/worlds.js` | `WORLDS`: each world's GLSL `map` beside its JavaScript `de` |
| `js/zoom.js` | The two zoom worlds: where the view is, the reference paths, the targets, the tour, and their share links |
| `js/palettes.js` | `PALETTES`, which are unlocked, `setPalette`, and `palCur`, the palette in use easing toward the chosen one |
| `js/packs.js` | The cleaners: `cleanName`, `cleanPalette`, `cleanMotion`, `cleanCode`, `cleanFilter`, `cleanOverlay`, `cleanWorld` |
| `js/shaders.js` | `fragSource(w)` and the post-processing shaders `FS_TRAIL`, `FS_DOWN`, `FS_BLUR`, `FS_FINAL` |
| `js/programs.js` | `sh`, `link`, `build(w)`, `passTo`, `bindTex`, the effect programs, and the programs for pack filters and overlays |
| `js/probe.js` | The distance probe, and `chipWait`, the once-a-frame wait for the graphics chip |
| `js/pack-worlds.js` | Worlds from packs: `packWorld`, `deMany`, `packFrame` |
| `js/targets.js` | Render targets, `resize`, the detail setting and Detail auto |
| `js/land-shader.js` | `LAND_T`, the land shader template, and the Alps' pieces of it |
| `js/landscapes.js` | Canyon country, the strange planet, the steel ball, the city, and the list `LK` |
| `js/land.js` | The land at run time: `LTAB`, `landH`, `landBuild`, `landPass`, `moveLand`, `setLand` and the other land controls |
| `js/state.js` | The built-in motions, filters, overlays, FX and mirror counts, and `sel`, what is chosen in each list |
| `js/library.js` | What packs have added: `addToLibrary`, `saveLibrary`, removal |
| `js/camera.js` | `cam`, the camera's state; `steering`, `turn`, `move`; `userLook`, `userActive`; vector helpers |
| `js/clock.js` | `clock`: time, the morph's clock, colour drift, mirror spin; `tickClock`, `morphValue` |
| `js/warp.js` | `tr`, the transition's state; `beginWarp`, `warpThen`, `stepWarp` |
| `js/flight.js` | `measure` (distance to the nearest surface and the world's speed), `deAt`, `doBoost` |
| `js/choose.js` | `scene`, what is showing; filling the lists; `setWorldNow`, `requestWorld`; the address hash; mirrors |
| `js/orbs.js` | `spawnOrb`, `collectOrb`, `stepOrb` |
| `js/spark.js` | The thrown light: `throwSpark`, `stepSpark`, `bounce`, `facing` |
| `js/midi.js` | Knobs: a MIDI controller's knobs and pads |
| `js/spots.js` | Share spots: `encodeSpot`, `applySpot`, `fromHash` |
| `js/input.js` | Pointer, wheel and keyboard handlers, gestures, the fading controls |
| `js/taste.js` | The weights behind More like this and Less like this: `taste`, `tasteNudge`, `pickWeighted` |
| `js/journey.js` | `CATS`, built-in templates and sets, their storage, the clocks `J`, `autopilot`, `stepJourney` |
| `js/journey-panel.js` | The setup panel for templates and sets |
| `js/pack-io.js` | `refreshLists`, `packNow`, `loadPack`, scenes (`sceneNow`, `goScene`), the library list |
| `js/gallery.js` | The gallery: the list in `packs/index.json`, **Add**, and offering a pack through GitHub |
| `js/picture.js` | Save picture: a PNG with the scene inside it, and loading a pack or picture file |
| `js/editor.js` | The slider editor for palettes, motions and filters |
| `js/controls.js` | The Orbs, Morph and Drift switches and the wiring of the remaining buttons |
| `js/stats.js` | The Stats readout |
| `js/vr.js` | The VR viewer: stereo, head turning, wake lock |
| `js/audio.js` | The audio graph, the orb chime, the file player and scrubber |
| `js/music.js` | The built-in music: a dance track made up as it plays |
| `js/video.js` | A video file or the camera shown in the picture: the element, the slowed copy the shaders read, its controls |
| `js/listen.js` | Listening to a tab or the microphone, `setMusic`, tap tempo, the bands, the change detector, `soundFrame`, the wave picture |
| `js/still.js` | Hold still: the pause, and averaging shifted frames into a sharp picture while nothing moves |
| `js/record.js` | Record video: the canvas and the app's own sound into a video file |
| `js/render.js` | Drawing a frame: `drawScene`, `drawTrails`, `drawBloom`, `drawFinal` |
| `js/loop.js` | `begin` and `frame(now)`, which calls the steps of a frame in order |

**How the modules fit together.** Each file holds function declarations, constants that need nothing from elsewhere, and its own variables. Anything that has to happen when the app starts (building lists, wiring buttons, reading storage, compiling the effect shaders) is in the file's `init()`, and `main.js` calls the `init()`s in a fixed order. Loading a module therefore does nothing by itself, which is why the Node tools can import the cleaners and other pure functions without a page.

**Who owns a value.** Every value is set by exactly one file. Other files read it by importing it (`export let`: importers always see the current value) and change it only by calling that file's functions (`setDetail`, `setWorldNow`, `setPalette`, `landClimb` and so on). Five groups of values that many parts of a frame must change are small state objects, each defined in the file it belongs to: `cam` (camera.js), `tr` (warp.js), `clock` (clock.js), `scene` (choose.js) and `sel` (state.js). A module may not assign to a variable it imports, so this is enforced by the language, not by convention.

**A frame.** `frame()` in `loop.js` is a list of calls: wait for the chip, read the sound, advance the clocks and the transition, measure the distance to the nearest surface, work out the steering, run the autopilot and Journey's clocks, turn and move the camera, move the land, update the orb and the thrown light, then draw (with Hold still's two steps either side of the scene, and Save picture's after the last) (`drawScene`, `drawTrails`, `drawBloom`, `drawFinal`). Each step lives in the file that owns what it changes. The steps pass what they work out through one reused object, the frame's notes, called `fr` inside them; the comment above it in `loop.js` lists its fields.

**`__dbg` and `window.MF`.** Every file ends with `__dbg`, an object holding every name in the file (with a getter and a setter for the ones that can change). `main.js` merges them into `window.MF`, and also offers each field of the five state objects by its bare name (`MF.pos` for `MF.cam.pos`). The test tools run their code inside `with(window.MF)`, so it can name any internal variable or function, and so can the browser console (`MF.setLand(1)`). When you add a top-level name to a file, add it to that file's `__dbg` if a test needs it.

The code is still ES5 in style inside the files (`var`, function declarations, no classes).

## 4. Render pipeline

Each frame draws five passes. All use one full-screen triangle and the vertex shader `VS`, which passes `v` (0..1 UV).

```
1. scene     world shader          -> tA        (full resolution)
2. feedback  FS_TRAIL (tA, tT[prev]) -> tT[cur]  (full resolution, ping-pong)
3. bloom     FS_DOWN  (tT[cur])    -> tB[0]     (quarter resolution, bright pass)
             FS_BLUR  horizontal   -> tB[1]
             FS_BLUR  vertical     -> tB[0]
4. final     FS_FINAL (tT[cur], tB[0]) -> screen
```

Targets are RGBA8 textures with linear filtering and clamped edges, created by `target(w,h)` and recreated in `resize()` whenever the drawing-buffer size changes (which also clears the feedback history). Bloom passes are skipped when bloom strength is zero.

Scene shaders are compiled lazily, one program per world, by `build(w)`, and cached on the world object as `w.prog` and `w.U` (uniform locations). The four post programs are compiled once at start.

### Resolution and the frame-time governor

`resize()` sets the drawing buffer to `cssSize * min(devicePixelRatio, cap) * q`.

| Detail mode | `q` | DPR cap | Adaptive |
|---|---|---|---|
| auto (default) | starts 0.85, range 0.6–1 | 2 | yes |
| sharp | 1 | 3 | no |
| fast | 0.5 | 2 | no |

In auto mode, every 30 frames the mean frame time is checked: above 36 ms, `q` is multiplied by 0.9; below 22 ms, by 1.06. What changes is decided by `detailStep` (a pure function, tested in `tools/unit.mjs`). With the land on there is a second number, `landQ` (1, 0.7 or 0.5): the size of the land's own picture beside the whole picture. `landLayer()` makes `tL` that size, `landPass` takes its resolution from the picture it is given, and the land alone is drawn into `tL` and copied up to `tA` when `landQ` is below 1. Going down, `q` goes to 0.6, then `landQ` to 0.7 and 0.5, then `q` on to 0.35; going up, `q` first, and `landQ` only when the mean frame time is under 12 ms. The reason: the land costs about three times a world per pixel (measured in software rendering, 61 ms against 23 ms), and a user's Intel laptop chip took 60 to 75 ms a picture for land over a world at `q` 0.35. Whether this is enough there is not yet known. No single part of the land shader stood out when the shadow, the mirrored pass and the step count were each cut in turn, though the timings were too noisy to rule much out. The policy is to give up frame rate before sharpness. An earlier version started at 0.55 and dropped to 0.3, which users found too blurry.

March steps are fixed at compile time: `STEPS` is 96 on touch devices and 120 otherwise; volumetric `VSTEPS` is 44 and 56.

## 5. The scene shader

`fragSource(w)` assembles: a header of `#define`s and uniforms, the world's own GLSL (`w.glsl`, which defines `float map(vec3 p)` or `float dens(vec3 p)`), then a shared `main`.

### Ray setup

```glsl
vec2 uv = (2.0*gl_FragCoord.xy - uRes) / sqrt(uRes.x*uRes.y);
```

Dividing by the geometric mean of width and height keeps the field of view sensible in both portrait and landscape. The ray is `rd = normalize(uCam * vec3(uv, uFov))`, where `uCam` is a 3x3 matrix whose columns are the camera's right, up and forward vectors and `uFov` is nominally 1.15 (smaller is wider). `uFov` narrows the lens slightly with speed, bass and boost.

### Kaleidoscope mirrors

Applied to `uv` before the ray is built, when `uSeg > 0`:

```glsl
float seg = 2.0*PI / uSeg;
float a = mod(atan(uv.y, uv.x) + uSpin, seg);
a = abs(a - 0.5*seg);
uv = length(uv) * vec2(cos(a), sin(a));
```

The angle is folded into one wedge and mirrored about the wedge's centre line, so the image is continuous across every seam. Because the fold is on the ray direction, not the screen image, the result is a true kaleidoscope view of a 3D scene. `uSpin` rotates the wedges slowly.

### Sphere tracing

```glsl
float t = 0.002;
for (int i = 0; i < STEPS; i++) {
  d = map(ro + rd*t);
  if (d < 0.45*uPix*t) { hit = 1.0; break; }
  if (t > MAXD) break;
  t += d;
}
```

`uPix = 2 / (sqrt(w*h) * 1.15)` is the angular size of one pixel, so the hit threshold is 0.45 of a pixel's footprint at distance `t`. This ties level of detail to screen resolution: fractal detail finer than a pixel is not resolved, which removes most aliasing speckle. The normal is a four-tap tetrahedral gradient with epsilon `0.8*uPix*t`.

### Shading

- `orb` is a `vec4` orbit trap that each world's `map` fills: typically the minimum over iterations of `(abs(p), dot(p,p))`. It supplies colour variation.
- Base colour: `pal(uHue + 0.8*orb.w + 0.25*orb.x)`, mixed toward a second palette lookup by `orb.z`.
- Lighting: one directional light fixed relative to the camera (`uCam * (-0.5, 0.7, -0.5)`, normalised), a head-light term `nd*nd` where `nd = |dot(n, rd)|`, and a specular highlight (power 28).
- Ambient occlusion is derived from step count: `ao = (1 - steps/STEPS)^1.5`. It is free and looks good in crevices.
- Animated bands: `smoothstep(0.75, 1, 0.5 + 0.5*sin(24*orb.w - 1.2*uTime))`, brightened by the mid band.
- Fresnel rim, exponential fog (`exp(-FOG*t)`, `FOG` per world), a step-count glow, vignette.
- Tone map `col/(1+0.2*col)` after an exposure of 1.35, saturation 1.4, a full smoothstep S-curve, `pow(col, 1.15)`, then gamma 1/2.2.

### Orb

A glowing sphere drawn analytically after the march. `uOrb` is `(position, radius)`; radius 0 means off. The closest approach of the ray to the orb centre is found in closed form; the orb is visible only if that point is in front of the camera and nearer than the surface hit (`tmax`). It draws a hard core plus two Gaussian halos.

### Volumetric worlds

When `w.volume` is true the shader takes a different branch: a fixed-step march accumulating `pal(...) * VMAP(dens(p))` with a per-step falloff of 0.93 and a hash-jittered start to hide banding. `VMAP` and `VSTEP` are `#define`d by the world.

### The thrown light

`js/spark.js`. **Throw a light** (key G) sets `sparkAsk`; `sparkFrame` throws on the next frame, when the distance to the nearest surface is known. `throwSpark` starts the ball just ahead of the camera with the camera's velocity plus 1.6 times the speed the camera could fly at here, and a radius of a twentieth of the distance to the nearest surface (between 0.0015 and 0.03). `stepSpark` moves it; when `de` at its centre is less than its radius it is pushed back out along the surface's direction (`facing`: central differences of `de`, six calls) and its velocity is reflected and multiplied by `SPARK_KEEP`, 0.8 (`bounce`). It is wrapped by the world's period, drawn at its nearest copy, and shrinks over the last three of its `SPARK_LIFE` 20 seconds. It does not move while Hold still is on. The scene shader draws it with the same `ball()` function as the orb, from `uSpark`, in another palette colour. Because it asks `de` every frame it is refused in a pack world; a cloud world has nothing to bounce off; the land alone and the video filling the screen have no world. Measured in headless Chrome over 900 frames in Sponge, Julia and Box: 8, 1 and 6 bounces, never deeper into a surface than a tenth of its radius at the end of a step.

## 6. Worlds

### Data shape

```js
{ id: "lattice", name: "Lattice",
  hue: 0,            // offset added to the palette phase
  fog: .18,          // fog density
  maxd: 16,          // far limit of the march
  speed: .55,        // top flight speed
  start: [.8,.45,.1],// camera start, or null to sample for open space
  period: function(m){ return [2,2,2] },  // repeat period per axis; may depend on the morph value m
  glsl: [ ...lines defining float map(vec3 p) and filling orb... ],
  de: function(x,y,z,m){ ... },           // the same distance estimator in JavaScript
  volume: true }     // only on volumetric worlds, which define dens() instead of map()
```

Two requirements matter more than anything else when adding or changing a world:

1. **`de` must mirror `map`.** JavaScript evaluates the same distance field to scale flight speed, steer the journey autopilot and place orbs. If the two drift apart the camera will clip through walls or crawl in open space.
2. **The field must be exactly periodic with `period`.** Each frame the camera position is wrapped into one period (`pos -= per * floor(pos/per + 0.5)`) to keep `float` precision. If the field is not periodic at that interval the wrap is visible as a jump.

`uM` (GLSL) and `m` (JS) are the morph value, `sin(0.09*T) + 0.15*sin(0.31*T)`, roughly in [-1.15, 1.15], where `T` is morph time. Each world maps it onto one of its parameters.

### Shared building blocks

- **Mirror tiling.** `p = abs(mod(p + P/2, 2P) - P) - P/2` reflects space into a cell of width `P` centred on the origin. It makes any bounded fractal endless with period `2P`, and, unlike plain `mod`, keeps the distance field continuous and exact: the nearest surface to a point is always in its own cell, because a mirror image is never closer than the original. JS helper: `tile(x, P)`.
- **Triangle-wave fold.** `p = abs(mod(p + c, 4c) - 2c) - c` equals a box fold `clamp(p,-c,c)*2 - p` (up to sign) near the origin but is periodic with period `4c`. It turns clamp-fold fractals, which are bounded, into endless ones.
- **Sphere inversion.** `k = s / dot(p,p); p *= k; scale *= k`, optionally clamped. The running `scale` is the derivative used to turn the final primitive distance into a world-space distance.
- **KIFS folds.** `p = abs(p)` plus conditional swizzle swaps reflect space into a fundamental domain before a scale-and-offset step.

### The worlds

| World | Family | Core iteration | Period | Morphs |
|---|---|---|---|---|
| Lattice | Apollonian sphere packing | `p = -1 + 2*fract(0.5p + 0.5)`; `k = s/r2`; 7 iterations; `0.25*abs(p.y)/scale` | 2 | `s = 1.3 + 0.2m` |
| Web | Same folds as Lattice, 6 iterations | Final distance to a line: `(0.25*length(p.xz) - 0.012)/scale` | 2 | `s = 1.22 + 0.14m` |
| Sponge | Menger sponge, endless | 4 levels of `a = mod(p*s,2)-1; r = abs(1-3|a|)`; `d = max(d, (min of pair-maxes - w)/s)` | 2 | hole size `w = 1 + 0.22m` |
| Halls | Pseudo-Kleinian | Triangle fold with `c`; `k = max(1/r2, 1)`; 7 iterations; Knighty's `max(rxy - 0.92784, |rxy*z|/|p|)/sc` | `4c` | `c = 0.92 + 0.05m` |
| Temple | Pseudo-Kleinian, per-axis | Fold sizes `(0.808, 0.808, 1.167+0.08m)`; `k = max(1.1/r2, 1)`; `0.5*abs(p.y)/sc` | `4c` per axis | z fold size |
| Box | Mandelbox, scale about -1.55 | Mirror tile `P=3.6`; box fold, sphere fold clamped to [1,4], `p = p*S + c0`; 7 iterations; `0.8*|p|/|dr|` | 7.2 | `S = -1.55 + 0.12m` |
| Fortress | Mandelbox, scale about +2.6 | As Box with `P=9`, 6 iterations | 18 | `S = 2.6 + 0.2m` |
| Citadel | Menger KIFS with rotation | Mirror tile `P=3`; abs, sort, two small rotations, `p = 3p - 2`, z fix; 6 iterations; box distance | 6 | rotation angles |
| Hive | Menger KIFS plus sphere fold | As Citadel without rotation, then `k = clamp(f/r2, 1, 2.2)`; 5 iterations | 6 | `f = 1.1 + 0.25m` |
| Shards | Sierpinski tetrahedron KIFS | Mirror tile `P=3`; three diagonal folds, xy rotation, `p = 2p - 1`; 7 iterations; `(|p| - 1.5)/s` | 6 | rotation `0.35m` |
| Crystal | Octahedral KIFS | abs, sort, two rotations, `p = 2p; p.x -= 1`; 6 iterations; `(|p| - 0.9)/s` | 6 | rotation angles |
| Bulbs | Mandelbulb | Mirror tile `P=3.4`; spherical power map, 6 iterations; `0.5*log(r)*r/dr` | 6.8 | power `8 + 1.5m` |
| Julia | Quaternion Julia | Mirror tile `P=3.4`; `z = z^2 + c` in quaternions, 9 iterations; `0.25*sqrt(|z|^2/|dz|^2)*log(|z|^2)` | 6.8 | the constant `c` |
| Mandelbrot | The Mandelbrot set in quaternions | Mirror tile `P=3.4`; `z` starts at a small seed, `c` is the point (moved 0.75 along x), `z = z^2 + c`, 12 iterations, bailout 64; `0.5*|z|*log|z|/|dz|` with `|dz| = 2|z||dz| + 1`. With no seed it is the flat set turned about its real axis | 6.8 | the seed, which pulls the shape out of round |
| Coral | Layered gyroids | `g(p) = dot(sin p, cos p.zxy)` at 1x, 3x, 9x; a thick shell of the first, bumped and perforated by the others; factor 0.42 | 2π | shell thickness |
| Gates | Nested tori | xy mirror tile (4), z repeat (1), twist of 2π per 16 units; a torus then 5 KIFS levels of smaller tori; factor 0.6 | 8, 8, 16 | twist phase |
| Nebula | Volumetric Kaliset | `p = abs(p)/dot(p,p) - f`, 10 iterations, accumulating `|len - prevLen|`; cubed | 2 | `f = 0.55 + 0.03m` |
| Aurora | Volumetric warped gyroid | Three octaves of `p += A*sin(p.yzx*F + t)`, then `exp(-k*|gyroid|)` ribbons | 2π | ribbon width |

Safety factors (0.42, 0.6, 0.8 and so on) are there because some of these estimators are not strictly 1-Lipschitz: twists, sums of gyroids and clamped sphere folds can overestimate distance. Lowering a factor trades speed for fewer overshoot artifacts.

Octave multipliers in Coral are integers (3, 9) so the sum stays periodic at 2π. The Gates twist rate is `2π/16` so the field repeats exactly every 16 units of z.

### Adding a world: checklist

1. Add an entry to `WORLDS` with `glsl` and a matching `de`.
2. Fill `orb` in `map` (start it at `vec4(1000.0)`, take a `min` each iteration, keep `orb.w` roughly in 0..1).
3. Give an exact `period`. If the fractal is bounded, mirror-tile it.
4. Pick `start` in open space, or use `null` to have 300 random points sampled for the largest distance.
5. Add the id to any built-in template sets that should include it (templates with `set: null` include everything automatically).
6. Update the world count in the start card text.
7. Run `python3 tools/render.py --world <id> -o x.png`, try two or three palettes, then `python3 tools/check.py`.

Worlds were developed by writing several candidates at once, rendering them, and keeping the good ones. First attempts often needed one retune (Crystal collapsed to dust until its rotation was reduced; Nebula and Aurora needed their gain changed by an order of magnitude).

### Blends (removed)

The app once could mix two worlds' distance fields into one scene. The control for it was removed because a blend cost twice as much per pixel and did not look good enough, and the engine code behind it was removed later. It is in the repository's history before the commit "Remove the world-blend code" if it is wanted again.

## 6c. The zoom worlds

`js/zoom.js`. **Mandelbrot zoom** (`mzoom`) and **Julia zoom** (`jzoom`) are entries in `WORLDS` with `flat: true` and no `map`. They are also marked `volume: true`, so that everything that already leaves the cloud worlds alone (the probe, the thrown light, the orb's surface check, Journey in the VR viewer) leaves them alone too. The camera still flies its hidden course through an empty world; nothing shows it.

**The view** is `zm`: the middle `x, y` in doubles, `s` (the distance from the middle to the top of a square picture), the turn `rot`, and the Julia constant `jx, jy`. `stepZoom(fr)` runs after `move`: the look applied this frame (`fr.lx`, `fr.ly`) and the sideways inputs slide the middle, the user's forward input (`fr.uz`, before drift or autopilot is added) zooms, `cam.rollIn` turns. With nothing asked for it zooms in slowly (Drift) or runs `tour` (Journey travelling).

**Drawing.** The shader's numbers are single precision, which runs out a few thousand times in. So each pixel is followed only as its difference `dz` from a reference path (perturbation): `dz' = 2*Z*dz + dz*dz + dc`, with `Z` read from a 1024 by 2 picture of real numbers (`OES_texture_float`) that `zoomUniforms` fills from `refOrbit`, in doubles, whenever the middle moves. Row 0 is the path of the view's middle and row 1 the path from zero; for the Mandelbrot set they are the same. When a pixel's value `Z + dz` is smaller than `dz`, or its row runs out, it carries on against row 1 from the start with `dz` set to the value itself (rebasing), which is what keeps one reference good for the whole picture. `zoomIter` sets the step count from `s`, up to `zoomCap()` (1,024, or 384 on a touch device; the loop's fixed bound is the same number). Colour is the smoothed step count through the palette. Without the float texture `build` throws for these two worlds and `setWorldNow` skips them with a message.

**Targets.** `ZTARGETS` holds seven Misiurewicz points (found by Newton's method on `f^(k+p)(0) = f^k(0)`; `tools/unit.mjs` checks each still lands on a cycle) and one small copy of the set. Around a Misiurewicz point the picture repeats at every size, so the tour can go to `ZMIN`-ish depths; each target has `d`, the smallest `s` worth going to, and `per`, roughly how many more steps each tenfold zoom costs, from which `targetDepth` works out how deep a device with fewer steps may go. `fixedPoint(c)` gives the Julia tour's point: the alpha fixed point when it repels by more than 1.045 a step, otherwise the beta one.

**The tour.** `pilotTo` is a pure step: while the target is off the picture or near its edge the view backs out; once it is inside, the middle closes on it three times faster than the view shrinks and snaps onto it exactly, which matters because the reference path must be the target's own. Mandelbrot: target, rest `ZHOLD`, next target (mirrored top to bottom at random). Julia: fixed point, rest, out to the whole set, then the constant eases to the next of `JULIAS` over six seconds.

**Share links.** A zoom world's spot is still 16 letters and digits, so `cleanScene` and the hash pattern are unchanged: palette, mirrors, then `zoomSpot`'s 14: the target's number if the middle is exactly a target (which restores it exactly), the middle to 4 digits each (about three millionths), `log s`, the turn, and the Julia set's number. `zoomFromSpot` holds a view that is not on a target to `s` of a thousandth or more.

**Hold still** compares `zoomKey()` as well as the camera, so the picture is sharpened only while the view is not changing.

**A fault this turned up.** The scene shader's `uLandT` was only given a texture unit while the land was over a world; otherwise it stayed at unit 0, which at that point in the frame can hold `tA`, the picture being drawn into. The other worlds got away with it. The zoom shader did not: the draw was refused with `INVALID_OPERATION` and the picture was black. `drawScene` now always points `uLandT` at unit 6, bound to the land's picture or to nothing.

## 6a. The land

The land (`landMode`: 0 off, 1 alone, 2 over the world) is a height field, not a distance field, so it does not use `fragSource`. It has its own shader, put together by `landSrc(k)` from the shared template `LAND_T` and one landscape's pieces, a coarse first pass (the same text up to the `/*sky*/` marker plus `LAND_PRE_MAIN`), its own camera position `lpos` and its own JavaScript height `landH`. It shares the camera's direction (`R`, `Up`, `F`), the field of view, the mirrors (`ray()` in the land shader repeats the fold in the scene shader) and the palette.

- **Landscapes.** `LK` lists them (`landKind` is the index): the Alps, canyon country, a strange planet, a steel ball, a city. The last two are not height fields: their entries have `src` (a whole shader built by `landOwn`, with no coarse pass), `h` (a height used only for steering; the ground is level) and `mirror` (the world is drawn whole so they can mirror last frame's `tA`). The ball is one ray-sphere test. The city walks the ray from block to block (`trace`) and tests the few boxes in each; `cityBlock`, `cityH` and `cityExtra` are the same blocks in JavaScript. For the others, `LAND_T` has gaps marked `@` (`@CONST`, `@SHAPE`, `@EXTRA`, `@SKY`, `@ZONE`, `@SHAPES`, `@GROUND`, `@XCOL`, `@COLS`) which `landSrc` fills from the entry's `gl` object. An entry also has its water level, `hmax` (the height above which an upward ray is sky), `flute` (how much the fine layers are turned down where the shape is a cliff, which stops upright grooves and smears), `shn` (shadow steps), its sun, and `shape` in JavaScript. All landscapes use the same noise sum; they differ in `shape()`, which turns the sum into a height. The canyon's shape is a staircase generated for GLSL and JavaScript from one list, `CANYON_STEPS`. Each landscape's two programs are compiled the first time it is chosen and kept in `pLandK`.
- **Free-standing shapes.** A height cannot describe rock with air under it, so a landscape may define `extra(p)`, a distance to shapes placed at most one to each square of the coarsest noise grid (arches and balanced rocks in the canyon; floating crystals, rings and slabs on the planet). Whether a square has a shape, and the height of the ground under it, is worked out once in JavaScript (`xcell`, `landXTab`) and read by the shader from the texture `uX` and by JavaScript from `xh`. Shapes keep half a unit inside their squares and have a height limit, so away from one `extra` returns a safe distance that never becomes small; an earlier version slowed every ray at every square edge. The march, the coarse pass and the shadow all take the smaller of the land step and this distance; `gX` says which was hit, and `xcol()` colours a shape. The entry's `extra` in JavaScript is the same function, used in `frame()` to push the camera out of a shape. It must match the GLSL except for the surface lumpiness.
- **Height.** A sum of value-noise layers. Each layer is weakened where the layers before it are steep, which carves ridges and gullies, and the sum goes through `shape()` to give flat valley floors and steep peaks. Each layer is the previous one multiplied by the whole-number matrix `[2 -1; 1 2]` (a turn of 26.6 degrees and a scale of 2.236). Because the matrix is whole numbers and the noise repeats every 256 squares, the land repeats exactly every `LPERIOD = 256 / LFREQ` units, and `lpos` is wrapped by that.
- **Noise.** `LTAB` is 65,536 bytes from a fixed generator. The shader reads it from a 256 by 256 texture in which each texel also holds its right, upper and upper-right neighbours, so one read gives the four corners of a noise square. `landHash` reads the same table, so GLSL and JavaScript agree exactly at the corners.
- **Precision.** The shader measures everything from the camera. `landPass` works out, in doubles, where the camera sits in each of the 13 noise layers (`uCi` whole part, `uCf` remainder) and in each grid of things (`uLi`, `uLf`) and two grain patterns (`uDa`, `uDb`). Without this the fine layers shake, because a 32-bit float cannot hold a position hundreds of units from the origin to a ten-thousandth of a unit.
- **Levels of detail.** `terrL` (4 layers) for broad slope, `terrU` (4 layers through `shapeU`, never below the true height, used by the march and the shadow when well clear of the ground), `terrM` (6) for marching, `terrG` (6, also returning an approximate slope), `terrD` (9, plus 4 more that fade in within 1.6 units).
- **Things.** `zone()` gives how much a place is forest, meadow or stony ground from slope, height and noise. `things()` scatters one thing to each square of six grids (two of trees, then bushes, boulders, rocks, scree) and returns its height above the land, which the march adds within 2.2 units. Each thing is kept inside its square, so one table read per grid is enough. `treeh`, `bushh` and `rockh` give the shapes.
- **Marching.** `LAND_PRE` runs at one-eighth size. Each ray is a cone wide enough to cover its block of pixels and stops when the cone first touches the land (raised by the tallest thing near the camera). `pre()` in the main shader takes the nearest of the four coarse results around a pixel as the place to start. A step is 0.42 of the height above the land, which can jump through a cliff, so both passes remember the last point known to be outside and go back to it. Low rays near the camera take short steps so no tree is stepped over.
- **Lakes.** A plane at the landscape's `water` level, coloured by `WSHAL`, `WDEEP`, `WGLOW` and `WFOAM`. The loop in `main` runs twice at most: the view, then the mirrored view from the water with a looser march and no streams or cast shadows.
- **Streams (Alps only).** One to each square of a coarse grid, running straight downhill from a point in the square: white where steep, blue where gentle.
- **Passes.** Alone: `landPass(tA)` replaces pass 1. Over a world: `landPass(tL)` first, with alpha 0 for sky and alpha below 1 for far land; then the world into `tA`, where `uLandOn` makes it skip pixels the land covers; lakes mirror last frame's `tA`. `landFx` then picks the picture the effects work on: 0 lays the land over the world into `tC` (`FS_MIX`); 1 uses the world, and the final pass lays the land on top after the filters (`uLandMix` 1); 2 uses the land, and the final pass shows the world behind it (`uLandMix` 2).
- **Flight.** `lpos` moves along the level part of `F` at a fixed speed and its height eases toward the ground here and ahead plus `landClear`. While the land is on, the horizon is eased level, the slow automatic roll is off, and the travel autopilot steers toward the lower side instead of probing the world's distance field.
- **Limits.** Off in the VR viewer. Not part of Journey templates. Trees cast no shadows. The canyon's and the planet's patterns were tuned from still renders in headless Chrome only; their frame rate on a phone is unmeasured. Relative cost in software rendering (six views, lower is better): Alps 609, canyon 600, planet 816, city 42, ball 18. An arch's legs run straight down without end, so one standing beside a drop shows a leg hanging down the cliff. `proto/alps.html` is the standalone page it was developed in and is no longer needed by the app.

## 6b. The distance probe and Stats

`probe(w, m, n)` asks the graphics chip for world `w`'s distance at the first `n` (up to 16) points in `probePts`. `probeBuild` makes a program from the world's own shader text up to `main`, with a `main` that evaluates `map` at point number `gl_FragCoord.x`, clamps it to -8..8 and spreads it over three colour bytes; `probe` draws that into a 16 by 1 picture, reads it back and decodes into `probeOut`. It exists for two reasons:

- **Worlds in packs.** A pack may not carry JavaScript, so a pack world has GLSL `map` but no `de`. `cleanWorld` checks it (the rules of `cleanCode`, no clock or sound, loops at most 16 times in all, numbers in range); `packWorld` wraps the code as `wmap(p, m)` inside a `map` that first folds `p` into the period, so the world is exactly periodic whatever the code does, and clamps the result. `packFrame` asks the probe once a frame for the camera and the autopilot's four points (`packD`); if the answer takes over 4 ms on average it asks every third frame. `deMany` batches the one-off searches (a starting place, an orb's place) 16 points to a question. Pack worlds are appended after `NWORLD`, are saved in `localStorage["mirrorfold-library"]` as cleaned source, and while one that is not `reviewed` is showing the flash limiter is on. Untested: any pack world on a phone, and the orb in a pack world.
- **Testing.** `tools/probe.py` compares `map` with `de` at 384 random points for every solid world. All 15 agree within 0.002 units plus 0.3% (32-bit against 64-bit arithmetic). This is the automatic check of the rule that the two must match.

Reading a picture back makes the page wait until the chip has finished everything queued before it, which in practice is the rest of the previous frame. So the time the probe takes is mostly a measure of how far behind the chip is, not of the probe's own work. WebGL 1 has no way to read back without waiting; WebGL 2 does (a pixel buffer and a fence).

**Stats** (`statsOn`, `ST`, `statsShow`) shows, twice a second: pictures a second and the longest gap between two, the script time per picture (measured round `frame()`, less the probe), sharpness and buffer size, the renderer name from `WEBGL_debug_renderer_info`, and the probe at the camera: its wait in milliseconds and the chip's distance beside `de`. A low script time with a long probe wait means the chip is the limit; a high script time means the page's JavaScript is.

## 7. Camera and flight

The camera is three orthonormal vectors `R`, `Up`, `F` (right, up, forward) and a position `pos`. The system is left-handed: `R x Up = F`, with x right, y up, z forward.

- **Look.** Input adds to `lookX` and `lookY`. Each frame a fraction `1 - exp(-14*dt)` of the pending amount is applied as a yaw about `Up` and a pitch about `R` (Rodrigues rotation, `rot(v, axis, angle)`), then the basis is re-orthonormalised. Rotations are in the camera's own frame, so there is no gimbal lock and no fixed horizon.
- **Roll.** Q and E keys, a slow automatic roll while drifting, and the two-finger twist gesture.
- **Speed.** `sp = min(world.speed, max(0.012, 2.6*dist)) * baseSpeed * (1 + 0.25*bass) * (1 + 3*boost)`, where `dist = |de(pos)|`. Velocity eases toward the target with rate 3.5 per second. Because speed is proportional to distance, the camera approaches surfaces asymptotically.
- **Wrap.** After moving, each coordinate is wrapped into one period of the current world.
- **Journey autopilot.** Runs when Journey is on and its movement setting `jMove` is `"travel"`. Probes `de` at four directions tilted from forward (right, left, up, down) at a distance proportional to `dist`, and steers toward the more open side: `lookX += (dR - dL)/(dR + dL) * 1.1 * dt`, plus a slow sum-of-sines wander. Forward thrust is 0.5 (drift is 0.3). With `jMove` set to `"drift"` none of this runs: Journey's clocks still change the scenery, and movement is whatever the user and the Drift toggle give. `jMove` is stored in `localStorage["mirrorfold-move"]`.
- **Handing control to the user.** All user look input (mouse, touch drag, arrow keys) goes through `userLook(dx, dy)`, which also adds the size of the turn to `userTurn`; the VR viewer's head turns add to it in `onGyro`. Each frame `userTurn / dt` is a turn rate in radians a second, and `userActive(act, rate, dt)` turns it into `lookAct` in 0..1: zero below 0.08 rad/s so tremor is ignored, full at 0.5 rad/s, rising in under a tenth of a second and fading with a time constant of about 0.7 s. The autopilot's steering and the idle roll are multiplied by `1 - lookAct`, and the automatic forward thrust (travel and drift) by `1 - 0.85*lookAct`. This applies in the VR viewer and in normal use alike.

## 8. Feedback, overlays, filters and transitions

This is the MilkDrop-style layer. MilkDrop's look comes from a loop: take the previous frame, warp it a little, fade it, draw something new on top, repeat. Then a composite shader recolours the result.

### Feedback (`FS_TRAIL`)

```
out = max(scene, warp(previous) * decay - 0.004)
```

The warp is applied to the UV used to sample the previous frame, in aspect-corrected space: rotation `uRot + uSwirl*(0.5 - r)`, zoom `uZoom`, a sinusoidal wobble `uWob`, a radial ripple `uRip`, then a drift `uDrift`. The `- 0.004` stops 8-bit values from sticking above zero. When a motion is active, `uShift` blends the trail toward its `brg` channel rotation each frame so trails change colour and read as distinct from the scene.

`MOTIONS` are parameter sets, expressed per frame at 60 fps and corrected for the real frame time (`pow(x, dt*60)` for decay and zoom, `* dt*60` for the rest):

| Motion | decay | zoom | Other |
|---|---|---|---|
| none | from FX | 0.994 | |
| Melt | 0.965 | 0.999 | wobble 0.0015, drift down 0.004 |
| Vortex | 0.96 | 0.992 | rotation 0.012, swirl 0.03 |
| Tunnel | 0.955 | 0.965 | |
| Implode | 0.95 | 1.03 | rotation 0.004 |
| Ripple | 0.955 | 0.996 | ripple 0.012 |
| Drift | 0.96 | 0.999 | wobble 0.001, drift sideways 0.004 |

**Drivers.** A motion from a pack or the editor may have `drive`, a list of up to two `{to, by, amount, every}`: one of `zoom`, `rot`, `swirl`, `wob`, `rip`, `dx`, `dy` follows a slow sine wave (`by: "wave"`, one cycle in `every` seconds, 8 at the least) or the pulse of the bass, mids or treble. `driven(mo, field, default, time, bass, mid, treble, scale)` in `js/packs.js` returns the number for this frame: the set value plus `amount * scale * half the field's range * signal`, then held inside `MOTION_LIM`, the same ranges `cleanMotion` uses. So a driven motion can never be outside what a plain one may be, and the quickest wave crosses a whole range in about 2.5 seconds at its fastest. `scale` is 0.25 under reduced motion. `decay` and `kick` cannot be driven, because trails that came and went with the sound would flicker. Filters have no drivers: a filter number following the beat (Negative, Solarise) would flash. The wave reads `clock.time`, so it stops under Hold still. The motion editor has two driver groups below its sliders (`edDriveBuild`, `edDriveRead`); what they say goes through `cleanMotion` with the rest. The built-in motions have none.

The **FX** button sets the base: glow (decay 0.78, bloom 0.55, fringe 0.004), trails (0.93, 0.75, 0.008) or clean (all zero). The decay used is the larger of the FX and motion values.

### Overlays

Drawn into the feedback buffer after the composite, so the motion smears them. Selected by `uOv` (1..7): Ring, Scope, Spectrum, Spokes, Rings, Spiral, Orbit. Sound data arrives as a 128x1 luminance texture `uWv`, refilled each frame by `updateWave()` with either the time-domain waveform or the frequency spectrum (overlays marked `spec` in `OVERLAYS`). With no live audio a synthetic shape is used. Colour is `pal(uHue + 0.3 + 0.45*r)` from the current palette. Strength is `uOvAmt` (15, 30, 50, 75 or 100%) and blends as `o += (max(o, colour) - o) * line * amount`.

### Bloom

`FS_DOWN` averages four taps and keeps what is above 0.5; `FS_BLUR` is a 9-tap Gaussian run horizontally then vertically at quarter resolution. Strength is `fx.bloom * (1 + 0.7*bass) + 0.5*warp`.

### Filters (`FS_FINAL`)

Applied in this order. `LOOKS` entries set one or more of these uniforms.

1. Transition coordinate warp (below).
2. Coordinate filters by `uFx`: Quad (`abs`), Tiles (mirrored 3x3), Bulge, Twirl.
3. Liquid (`uLiq`, sinusoidal displacement) and Mosaic (`uMos`, cell quantisation).
4. Sampling: four taps along the zoom-blur direction, with red and blue sampled at slightly different scales for colour fringing (`uCA`).
5. Echo (a flipped, 2x ghost), Neon (four-tap edge detect), Solar, Negative, Prism (hue rotation growing with radius and time), Poster.
6. Colour filters by `uFx`: Thermal (luminance through the palette), CRT, Halftone, Contour, Noir, and six made with video in mind: Comic (four levels a channel with dark outlines), Two-tone (two palette colours by brightness), Tape (rows shifted, colours out of register, a slow rolling band, faint grain), Streaks (bright parts run downward), Emboss, and Glass (15, a grid of small lenses, applied with the geometric ones).
7. Bloom is added, then the transition tint and mask.

### Transitions

A world change (and a journey mirror change) runs `warp` from 0 to 1 over 0.5 s, performs the change at the peak, and returns to 0 over 0.8 s. `beginWarp()` picks one of eight types at random, never repeating the last: swirl, dive, blocks, fold, melt, blink, tear, dissolve. All but blink and dissolve finish in a wash of the current palette colour at the peak, which hides the swap and the shader-compile hitch. `requestWorld(i)` starts a transition to a world; `warpThen(fn)` runs any function at the peak.

## 8b. Hold still

`js/still.js`. The **Hold still** switch (`still`, `setStill`, key H) is a pause and a way to get a clean frame.

**The pause.** In `frame()`, `tickClock`, the autopilot and `stepJourney` are skipped while `still` is true, so the time, the morph, the colour drift and the mirror spin stop, and Journey changes nothing. `turn` and `move` drop the automatic roll and the drift, bring the look, the roll and the velocity to an exact stop (they otherwise ease toward zero for ever), and still obey the stick, the keys and the pointer. The sound is still read, so the glow and the motions keep following the music. Turning Journey on calls `setStill(false)`.

**The sharpening.** `stillAim(fr)` runs before `drawScene`. If the camera's position and directions and the morph are within 1e-9 of last frame's, and the world, picture size, mirrors, palette and VR setting are the same, it counts one more frame (`stillN`, up to `STILL_MAX` = 32); otherwise it starts again at 1. It also sets `jit`, a shift of up to half a pixel each way from the Halton sequence (bases 2 and 3, 64 places). The scene shader adds `uJit` to `gl_FragCoord` where it makes the ray (and where a cloud world picks its first step), so each frame looks through a different part of every pixel. While `stillN` is not zero `drawScene` passes no sound to the scene and the field of view does not pulse, so the frames match.

`stillBlend()` runs after `drawScene`: `FS_ACC` moves the kept picture `tR` a share `1/stillN` of the way to the new frame in `tA`, then the kept picture is copied back into `tA`, so every later pass (the land laid over, trails, glow, filter) works on it unchanged. The pictures are 8 bits a colour, where a share of 1/32 of a small difference rounds to nothing; `FS_ACC` adds half a level of noise that differs every frame, so the rounding is right on average. Once `stillN` reaches 32 the share stays at 1/32, so a slow change (the palette easing to a new choice) is followed with a lag of about half a second.

Not sharpened: the land alone, and anything with a video (the frames differ). The land laid over a world is not sharpened but the world behind it is. In the VR viewer it works as on a flat screen, because nothing in it is centred on the screen. Measured only in headless Chrome; whether a phone holds 60 frames a second while it runs (two extra full-size copies a frame) is untested.

## 8c. Record video

`js/record.js`. `recStart()` takes `canvas.captureStream(30)` and, if the audio context is running, adds the audio track of a `MediaStreamDestination` joined to `master`, so the recording has whatever the app itself is playing. While the app listens to a tab or the microphone `master.gain` is 0, so that sound is not recorded, which is as it should be: it is not the user's to republish through this page. A `MediaRecorder` gathers a part a second into memory; `recStop()` (or the limit `REC_MAX`, 300 seconds) joins them into a file and saves it through a download link. The file kind is the first of `REC_TYPES` the browser accepts (MP4 where it can, otherwise WebM). The button is hidden where `captureStream` or `MediaRecorder` is missing.

It records what is drawn, at the size and rate it is drawn, so a phone that is struggling makes a struggling video. Checked in headless Chromium in real time (the recorder gives nothing under virtual time): four seconds gave a 1.7 MB WebM. Untested: any phone, Safari's MP4, whether the sound is in step with the picture.

## 8a. Video (an experiment)

`js/video.js` shows a video file the user picks, or the camera, in the picture. Nothing is uploaded or kept, and a pack cannot name a video. The frame step `videoFrame` runs before the drawing steps; `videoUniforms` hands the result to the scene shader and the trails pass on texture unit 5 (`uVid`, `uVidK` = way, strength, fit to screen; `uVidS` = repeat scale on surfaces).

Six ways (`VMODES`), chosen with the "Video …" button:

| Way | Where | What it does |
|---|---|---|
| on the surfaces | scene shader | Laid on from the three axes, weighted by the normal. Each copy is the mirror of its neighbour, and a pair of copies fits the world's period a whole number of times, so it survives the camera wrap. True 3D, so it stays on in the VR viewer. |
| through the shapes | scene shader | Flat on the screen, used as the surface colour and lit more evenly. The video stays recognisable with the world embossed into it. |
| in the distance | scene shader | Takes the place of the fog colour, so far things fade into the video. Only shows on open worlds. |
| in the overlay | trails pass | The overlay's shapes are drawn seven times wider (`wd`) and replace what is under them with the video. Works with pack overlays too. |
| as the colours | scene shader | The surface colour is read from the video at a point given by the orbit trap, so the fractal is striped with the video's colours. True 3D. |
| filling the screen | its own program (`videoScene`) | No world is drawn: the video is the scene, fitted to the screen, folded by the mirrors exactly as a world is, and swelling 2.5% on the beat. Motions, filters, overlays and transitions then work on it as on any scene, and the land can stand in front (Land over). The camera still flies the unseen world, so the land moves. Orbs are off. In the VR viewer the world is drawn instead. |

**The flash limit.** The shaders never read the video itself. They read `tV`, a 640-wide copy that `videoFrame` moves towards the newest frame. Each frame a 4 by 4 picture of the new frame's average colours (`pMean`, read back into `mNew`) is compared with the same averages of the copy (`mOut`, tracked in JavaScript, since the blend is linear). The blend amount is cut so that no sixteenth's average changes by more than 0.6 of full brightness a second (0.3 with reduced motion). Measured: a clip strobing black to white at 5 Hz comes through as a ripple of about 6%; ordinary footage is followed within a level or two; a hard cut becomes a fade of up to a second. Do not hand the raw texture to any shader.

**Sound.** Music has a source `video` ("My video's sound"). Choosing a video file selects it only if Music is off; the "Video sound" button (`bVidSnd`) switches between it and the source that was playing before (`musicBefore`), so a video can run silently under any other music. `videoSound(on)` joins the video element to the audio graph with `createMediaElementSource` the first time, and from then on mutes or unmutes the element; `liveAudio()` counts it, so the beat reading follows the video. Any other music source mutes the video. The camera has no sound. Checked in headless Chrome only (sound reaches the analyser; the video keeps playing while the audio context is suspended); iPhone untested.

Not done: the land (it ignores the video; only the overlay way works over it), cloud worlds (same), a journey category, remembering the choice, any test on a real phone. The smoke test does not cover it, because headless Chrome's virtual clock does not run a video; it was tried with Playwright and three made-up clips.

## 9. Palettes

Cosine palettes: `colour(x) = a + b*cos(2π*(c*x + d))`, four `vec3` parameters per palette. The shader's `pal()` reads them from uniforms `uPa..uPd`. The live values `palCur` ease toward the selected palette at rate 1.6 per second, so palette changes are smooth. The phase `uHue` drifts slowly and faster with treble.

The first seven palettes are always available. The other six are unlocked one at a time by collecting orbs; the count is stored under `localStorage["mirrorfold"]`. Palettes added from packs follow the built-ins and are always available (see Packs in section 11).

## 10. Audio

### Graph

```
built-in music (js/music.js):
  kick, clap, closed hats -----------------------------+
  pad -> filter -> gate -+                             |
  arp, lead, riser ------+-> tone filter -> duck ------+-> compressor -> air filter -> out -+
  echo and reverb -------+                 (pumps)     |                                    |
  bass -> subDuck (pumps deeper) ----------------------+                                    |
orb chime, file (buffer source or media element) ------------------------------------------+-> bus -> analyser -> master -> destination

shared tab or microphone -> cap.gain -> analyser      (master gain is 0 while listening)
```

One `AnalyserNode` (FFT 1024) sees whatever is playing. `ensureAudio()` builds the graph on first use.

### Sources (`setMusic(mode)`)

- **built**: a dance track made up as it plays (`js/music.js`), 126 BPM, natural minor. `tick()` runs every 90 ms and schedules sixteenth-note steps 350 ms ahead on the audio clock with `playStep`. A song is 72 bars from `PLAN` (intro 8, build 8, drop 16, breakdown 8, build 8, drop 16, outro 8); `newSong()` then picks a new key, one of five four-bar chord loops (`PROGS`), a gate rhythm, an off-beat or rolling bass, an arp shape and a one-bar tune. The sounds are all oscillators and filtered noise: a kick (sine dropping from 165 to 44 Hz with a noise click) on every beat, which also ducks the `duck` and `subDuck` gains and lets them recover over about a fifth of a second (the sidechain pump); a clap (three bursts and a tail) on beats 2 and 4 of a drop, gathering pace through a build; hats; a saw-and-sine bass; the chord as three detuned saws a note, chopped by `gate`; an arp whose rests come from a Euclidean rhythm; a lead; a noise riser into each drop and an impact on it. A build ends with half a bar of silence. `musicFollowsSpeed` opens the last low-pass filter as you fly faster. `musicRender(ctx, bars)` schedules a song into an `OfflineAudioContext`, which is how the mix was checked: the author cannot hear it, so levels were measured bar by bar (peak 0.82 before the master gain of 0.5; breakdown about half the loudness of a drop). How it actually sounds is untested.
- **file**: `decodeFile` reads the file and decodes it into an `AudioBuffer`, played by a looping `AudioBufferSourceNode`. Seeking is stop-and-restart at an offset, which is exact. Because a decoded hour of stereo audio is over a gigabyte, the file's length is probed first with a media element: anything over 15 minutes, or over 80 MB, or that decodes shorter than its reported length, plays through the media element instead (`useElement`). The `player` object abstracts the two (`pPlay`, `pPause`, `pSeek`, `pPos`, `pDur`).
- **tab**: `getDisplayMedia` with audio. The user picks a tab in the browser's share dialog and turns on tab audio. Offered only where `getDisplayMedia` exists and the device has no touch screen, which in practice means Chrome and Edge on a computer; Firefox and Safari have the API but pass no audio, and that case ends with a message. The video track is requested as small and slow as allowed and is not used.
- **mic**: `getUserMedia` with echo cancellation, noise suppression and automatic gain off, so the level follows the music.
- Both go through `startListening(mode)`: the stream becomes a `MediaStreamAudioSourceNode` into `cap.gain` (1 for a tab, 3 for a microphone), which feeds the analyser. `master.gain` is set to 0 while listening so the captured sound is never played back; a shared tab keeps playing from its own tab, and a microphone would feed back. `stopListening()` stops the tracks and restores the gain. A token (`cap.tok`) discards a stream that arrives after the music setting has changed. If the user stops sharing or the track ends, the mode falls back to off with a message. `liveAudio()` is true in these modes once a stream is connected, so the bands, overlays and the change detector work as for a file.
- **tap**: no sound. `tap()` averages the last few tap intervals; intervals under 0.36 s are doubled to keep pulses slow. The audio context is suspended so that music playing in another app is not interrupted.
- **off**: suspended as for tap.

The scrubber is a custom slider (pointer events with capture), not `<input type="range">`. The time label has a fixed width because a changing width was shifting the slider under the finger.

A select's `change` event may not count as a user gesture for audio on iOS, so a capture-phase `pointerdown` listener resumes the context on the next tap.

### Bands (`readMusic`)

| Band | FFT bins | Roughly | Drives |
|---|---|---|---|
| bass | 1–4 | below 200 Hz | motion zoom kicks, bloom, field of view, flight speed, Rings overlay |
| mid | 6–45 | 250 Hz–2 kHz | morph speed, motion rotation and wobble, surface bands, Liquid filter, Spokes length |
| treble | 60–250 | above 2.5 kHz | specular highlights, colour fringing, hue drift, trail colour shift, Orbit lights |

Each band keeps a **level** and a **pulse** (`bandStep`). The raw average is normalised by a slowly decaying running maximum (so quiet and loud tracks both use the full range), a slow average is tracked, and the pulse is `max(pulse*exp(-5dt), clamp((x - avg)*gain))`, an onset detector with decay. Level follows with a fast attack and slow release.

In tap mode the bands are synthesised: bass on the beat, mids half a beat later, treble twice per beat.

With `prefers-reduced-motion`, all reactions are scaled to a quarter and several motions are disabled (`calm`).

### Change detector (`makeChangeDetector`)

Decides when the music has changed enough to justify a world change. Inputs each frame: energy `e = 0.5*bass + 0.35*mid + 0.15*treble` (raw, not normalised) and balance `(treble + 0.5*mid)/(bass + mid + treble)`.

It keeps a short average (time constant 0.8 s) and a long one (8 s) of each. Novelty is

```
|sE - lE| / max(sE, lE, 0.03) + 2.2 * |sB - lB|
```

and it fires when novelty exceeds 0.45, after a 5 s warm-up. After firing it holds for 4 s, during which the long averages are snapped to the short ones so the new sound becomes the baseline. `tools/unit.mjs` checks it against six synthetic signals. It has not been tuned on real music; the threshold 0.45 and the weight 2.2 are the two numbers to adjust.

## 11. Journey

### Clocks

`J` holds one clock per category: `world`, `palette`, `mirrors`, `motion`, `filter`, `overlay`, `land`. A land option is `"none"` or a landscape's `id` plus `" alone"` or `" over"`; templates saved before the land existed get `mode: "keep"`. `jReset(k)` sets the next firing time to `base * (0.8 + 0.4*random)`, so each change lands within a fifth either side of its target interval and the categories drift relative to each other.

### Templates

```js
{ name: "My trip", builtin: false,
  world:   { mode: "random", every: 55, set: null, trigger: "timer" },  // trigger: "timer" | "sound"
  palette: { mode: "random", every: 21, set: null },
  mirrors: { mode: "off",    every: 20, set: null, none: "even" },      // none: "even" | "50" | "75"
  motion:  { mode: "keep",   every: 24, set: ["Melt","Drift"] },
  filter:  { mode: "keep",   every: 27, set: null },
  overlay: { mode: "keep",   every: 22, set: null } }
```

- `mode`: `off` forces the category to none every frame; `keep` leaves it as the user set it; `random` changes it on the clock. Worlds and palettes have only `keep` and `random`.
- `set`: `null` means every option. Otherwise a list of option keys: world ids, palette names, mirror counts as strings (`"0"` is none), and motion, filter and overlay names. Keys are names rather than indices so templates survive options being added.
- `CATS` describes the categories and is what the engine and the editor both iterate over. `normT` fills in anything missing and drops unknown keys, so stored or pasted templates are always complete.

Engine functions: `jCur(k)` (current option key), `jPool(k, cfg)` (allowed options; locked palettes are excluded), `jPick(k, cfg, cur, pool)` (the next option; weighted for mirrors, otherwise uniform over the others), `jApply(k, key)` (apply it; returns false if a transition is running and it must be retried). The per-frame loop is in `frame()` inside `if (journey && started)`.

A world with `trigger: "sound"` changes when the detector fires and at least `max(10, every/4)` seconds have passed, or after `2.5 * every` seconds regardless. Without live audio it falls back to the clock.

Built-in templates: Classic, Everything, Clean flight, MilkDrop, Kaleidoscope, Calm, Follow the music.

### Likes

`js/taste.js`. `taste` maps `"<category>:<option key>"` to a weight between `TASTE_MIN` (0.2) and `TASTE_MAX` (4); an option with no entry has weight 1. `jPick` chooses among the allowed options with `pickWeighted`, each in proportion to its weight (the weighted mirror choice still decides between none and some first). **More like this** (`jMore`) multiplies by 1.4 the weight of what is showing in every category the template sets to random. **Less like this** (`jLess`) multiplies by 0.6 the weight of what is showing in `jLast`, the category `stepJourney` changed most recently (or the first random category if it has changed nothing yet), and changes that category at once. A weight that returns to within 0.02 of 1 is dropped. The weights are in `localStorage["mirrorfold-taste"]`, read through `cleanTaste`; **Forget what I liked** in the setup panel empties them. They are not part of a pack. `tools/unit.mjs` checks the limits, the proportions and the cleaner.

### Sets

```js
{ name: "Grand tour", builtin: true, order: "cycle",   // or "random"
  items: [ { tpl: "Clean flight", min: 2 }, { tpl: "MilkDrop", min: 2 }, ... ] }
```

`advanceSet()` moves to the next item (or a random different one) when its minutes are up and calls `applyTemplate`. Items whose template no longer exists are skipped.

### Storage

`localStorage["mirrorfold-journeys"]` holds `{ tpls, sets, sel }`, where `sel` is `"t:<name>"` or `"s:<name>"`. Built-ins are defined in code and never stored. `adopt(raw)` validates stored or loaded data and skips names that collide with built-ins. It reads templates from `raw.templates` (packs) or `raw.tpls` (storage and older backups).

### Packs

A pack is JSON: `{ mirrorfold: 1, name, author, about, scene, palettes, motions, filters, overlays, worlds, templates, sets }`. The format and ranges are documented for authors in `packs/README.md`. Nothing in a pack is evaluated as JavaScript. The only code a pack can carry is the GLSL body of a filter or an overlay (below).

- **Cleaners.** `cleanName`, `cleanPalette`, `cleanMotion`, `cleanFilter`, `cleanOverlay` and `cleanCode` are pure functions. They refuse a wrong shape (returning `null`), copy only known fields into a new object, and clamp every number. The motion ranges are what keeps a pack from breaking the no-strobe rule, so widen them only after looking at the result.
- **Library.** Added palettes, motions, filters and overlays are appended to `PALETTES`, `MOTIONS`, `LOOKS` and `OVERLAYS` after the built-ins (`NPAL`, `NMOT`, `NLOOK` and `NOV` are the built-in counts) and stored in `localStorage["mirrorfold-library"]`. They are loaded before the selects and `CATS` are built. `libAdd` refuses built-in names, replaces an earlier added item of the same name, and stops at `LIB_MAX` (16) per kind.
- **Loading.** `loadPack(text)` is the one entry point for a file, pasted text and a published pack. It adds palettes and motions first, calls `refreshLists()` (which rebuilds the two selects and the palette and motion options in `CATS`), then adopts templates and sets, so a template can name items from its own pack.
- **The gallery** (`js/gallery.js`). `loadGallery()` fetches `packs/index.json` from the same folder as the page, once, when the panel opens, passes each line through `cleanEntry` (a file name matching `^[a-z0-9][a-z0-9_-]{0,60}\.json$`, a name, and optionally an author, a sentence and counts, all as plain text and small numbers) and shows a card for each with **Add**, which fetches the file and calls `loadPack(text, "site")`. Under `file:` it only says so. `packs/index.json` is written by `tools/gallery.mjs` from the pack files, and `tools/pack.mjs` fails if it is out of date.
- **Offering a pack.** The panel lists what may be offered, each with a tick box (`offerItems`, `offerFill`): the user's worlds, palettes, motions, filters, overlays, templates and sets from `packNow()`, less anything named in `fromGal`, and the scene showing now. `fromGal` is the names in every pack added with **Add** (`packNames`), kept in `localStorage["mirrorfold-from-gallery"]` and read back through `cleanFrom`; an item is known as the gallery's by its kind and name only, so a thing of the user's own given the same name later is left out too. **Offer what is ticked** builds a pack of the ticked things with `offerPick`, which also takes what they use if it is in the list (a set's templates; the options a template names in a `set`; the scene's world and look) and reports those so the message can name them. Nothing else is sent. It opens the repository's issue form (`.github/ISSUE_TEMPLATE/pack.yml`) with the pack in the address (`offerUrl`); past 6,000 characters the pack is left out of the address, copied, and the user pastes it. The repository is taken from the Help link, which `vr.js` already points at the right fork. On GitHub, `.github/workflows/offer.yml` runs `tools/offer.mjs` when an issue with the `pack` label is opened or edited: it reads the issue from the event file, runs every item through the cleaners (`tidy` in `tools/packlib.mjs`), and for a pack with anything left writes `packs/<name made here>.json` and the index, pushes the branch `pack/<issue number>` and opens a pull request. It comments on the issue either way. No step puts issue text into a command; the only values that reach the shell are the issue number and a file name of lower-case letters, digits and hyphens, which the shell step checks again. Nothing is in the gallery until a maintainer merges, and merging is what makes code `reviewed`. Untested on GitHub itself: the script was run by hand against made-up issues, and the workflow file has only been read.
- **A scene in a pack.** `cleanScene` checks an optional `scene`: a spot as Share spot writes it, the look by name, mirrors, FX and land. `loadPack` adds the library items first and then calls `goScene`, which looks each name up and passes over any it does not know. `sceneNow()` reads the current scene and `packOfScene()` wraps it with whichever of the palette, motion, filter, overlay and world in use are not built in.
- **Save picture** (`js/picture.js`). `pictureMake(fn)` asks for the next frame; `pictureFrame()`, the last step of `frame()`, calls `canvas.toBlob` while the frame is still on the canvas, and `pngPut` adds a `tEXt` part named `mirrorfold` holding `packOfScene()` as ASCII JSON (`asciiJson` writes every other character as `\uXXXX`). `loadFile` is the one way in for a file the user picks or drops: a PNG goes through `pngGet`, which checks every length against the file and stops at 200,000 characters, and then `loadPack` like any pack, so a picture can never mark code reviewed. Checked in headless Chrome: the file opens in other software with its text part, and loading it returns to the same scene. Untested: saving a file on a phone, where the download link may open the picture instead.
- **Palette locks.** `palOpen(i)` says whether a palette may be used: built-ins up to the orb count, and every added palette. Use it instead of comparing against `BASE_PALS + unlocked`.
- **Share links** store the palette by index in one base-36 digit. 13 built-ins plus 16 added fit. A link that names an added palette the receiver does not have keeps the receiver's current palette.
- **Filters.** A pack filter is a `LOOKS` entry: the same control fields the built-ins use (`edge`, `post`, `fx` and so on, clamped by `cleanFilter`) and optionally `code`.
- **Filter code.** `code` is the body of `void look(vec2 uv, inout vec3 col)`. `finalSource(code)` splices it into a copy of `FS_FINAL` with the helpers `scene`, `luma`, `aspect` and `pixel`, calls it after the built-in filter steps and before bloom, and clamps the result. `filterProg(lk)` compiles that copy on first use and caches it on the entry (`lk.prog`, `null` if it failed). Loading a pack compiles at once, so code that does not compile is left out; code restored from storage compiles when first selected.
- **What `cleanCode` enforces, and why.** No `#`, comments or backslashes, so the checker and the compiler see the same tokens. Balanced braces that never go negative, so the body cannot close `look` and define more functions (call chains of functions can multiply cost without any loop). No identifier matching `u[A-Z0-9_]…` or `gl_…` except `gl_FragCoord`, so the code cannot name the app's uniforms: it has no clock, no audio and no direct texture access. At most counted `for(int i=0;i<N;i++)` loops, with the product of the counts times the number of `scene` mentions at most 64, which bounds texture reads per pixel. No `discard`, which would leave pixels undefined.
- **Overlay code.** A pack overlay is an `OVERLAYS` entry `{ name, sound, code }`. `code` is the body of `void mark(vec2 p, inout float ln, inout float hue)`. `trailSource(code)` splices it into a copy of `FS_TRAIL` with the globals `time`, `beat`, `mid`, `hi`, `aspect` and the helper `sound(x)`, and runs it when `uOv` is 99. `overlayProg(ov)` compiles and caches it like `filterProg`. Unlike a filter, an overlay does get the clock and the sound, because an overlay without them is a still shape. `sound: "bands"` makes `updateWave()` fill the wave texture with the spectrum, as the built-in `spec` flag does.
- **Flash limiter.** For filters, having no clock is not enough: code can amplify tiny changes in the picture into a full-screen flip. Overlays have a clock outright. So while any code that is not marked `reviewed` is in use, pass 4 draws into `tF[fcur]` and blends with the previous finished frame (`uKeep = exp(-dt/0.25)`, sampler `uPrev`, both in the base `FS_FINAL`), then copies to the screen with `pCopy`. In real-time tests a filter written to flash swung more than 10% of full brightness 6 times a second with the limiter off and never with it on; an overlay written to flash, 12 times a second and never. `reviewed` is set only for packs fetched from the page's own `packs/` folder (`loadPack(text, "site")`) and is kept in `localStorage`; a file or pasted text can never set it. `tF` is allocated on first need and freed on resize.
- **VR.** Filters with code are treated as "none" while `stereo` is on, like the built-in filters that move pixels. Overlays are all off in VR already.
- **Editor.** `ED` describes the sliders for each kind (`p`, `m`, `f`): field, label, range and step. `edOpen(kind, i)` builds the sheet `#ed` and selects the item so the picture shows it. Every slider move runs `edRead()`, which builds an object from the sliders, passes it through the same cleaner a pack goes through, writes the result into the live item in place, and saves. So the editor cannot make anything a pack could not hold. `edNew(kind)` starts from a copy of what is showing (without any code). Renaming updates the names in the user's templates. Overlays have no editor. Each `ED` row also carries the help sentence that the **Help** button shows, so a control and its explanation stay together. The palette editor has plain controls on top of the twelve sliders: two colour pickers and the three `ED_SIMPLE` sliders. `palFromSimple` builds `a`, `b`, `c`, `d` from them (each channel swings between its value in the two colours; `c` is half the number of colour changes; `d` is the slide, plus a third of the rainbow setting per channel, plus a half where the channel runs downward). `palToSimple` reads the settings back from a palette and reports `exact: false` when the palette has no such settings; the editor then shows a note, because touching a plain control rebuilds the palette. The twelve sliders (**Fine tuning**) remain the source that `edRead()` reads. On a phone held sideways the sheet is a panel down the right side (a media query on `#ed`).
- **`tools/pack.mjs`** extracts the cleaners by name and fails on any pack in `packs/` that would be refused or changed. It runs on every push and pull request (`.github/workflows/check.yml`), together with `tools/unit.mjs`. `tools/check.py` loads every pack in `packs/` and fails if one does not load whole or a filter does not compile; it needs a browser and is run by hand.

### Setup panel

Built with a small `mk(tag, props, kids)` DOM helper. `advRenderT()` and `advRenderS()` re-render the whole template or set editor on each change, which is simple and fast enough at this size. Built-ins render read-only.

## 12. Orbs and share links

**Orbs.** `spawnOrb()` samples 260 random points in one period and scores them by distance from surfaces and from the camera. The orb's radius scales with the open space around it. Each frame the nearest periodic copy to the camera is found and passed to the shader; reaching within 2.5 radii collects it. Every 1.5 s the orb is checked against the morphing surface and respawned if swallowed. The first six orbs unlock palettes; later ones trigger a world change. The Orbs button hides them and is remembered in `localStorage["mirrorfold-orbs"]`.

**Share spot.** `encodeSpot()` produces `<world id>-<16 base-36 characters>`:

| Chars | Field | Encoding |
|---|---|---|
| 1 | palette index | base 36 |
| 1 | mirror index | base 36 |
| 6 | position, 2 per axis | `(pos/period + 0.5) * 1295` |
| 2 | yaw | `(atan2(F.x, F.z)/2π + 0.5) * 1295` |
| 2 | pitch | `(asin(F.y)/π + 0.5) * 1295` |
| 4 | morph time | quarter seconds, mod 36^4 |

Roll is not stored. `applySpot()` restores morph time first, because some periods depend on it. A bare `#<world id>` hash selects a world.

## 13. Input

**Knobs** (`js/midi.js`). Where `navigator.requestMIDIAccess` exists, the Knobs button asks for access and listens to every input; nothing is sent. `midiRead` turns a message into a knob (a controller change, on any channel, as 0 to 1) or a pad (a note pressed). `knobSlot` gives the first four different knobs turned the four jobs in `KNOBS`: speed (`0.2 * 20^v`, the same 0.2 to 4 as the wheel), overlay strength, and the two look axes. A look knob is a rate, not a position: `knobRate` is zero within 12% of the middle, and `midiFrame`, a step of `frame()`, turns the view through `userLook` at up to 1.2 radians a second, so the autopilot stands back as it does for a hand. A pad's note number, modulo four, steps the world, palette, motion or filter. Tried only with made-up messages; no controller has been connected.

**Touch.** A touch that starts in the left 45% of the screen is the move stick (a ring appears under the finger; deflection gives strafe and forward). A touch elsewhere is look. A second finger on the look side starts a gesture: the change in distance between the two fingers scales `baseSpeed`, and the change in angle rolls the camera. Two quick taps on the look side set `boost = 1`, which decays at 1.2 per second and multiplies speed by up to 4.

**Mouse and keyboard.** Click captures the pointer where allowed, otherwise drag to look. W A S D, Space and Shift (up and down), Q and E (roll), arrows (look), wheel (speed), `[` and `]` (world), 1–9 (world), P (palette), M (mirrors), J (journey), T (tap tempo), B or double-click (boost). Key handling is skipped while focus is in a select, input or textarea.

The HUD fades after 5 seconds without interaction and returns on any touch. It is a row of lists (World, Palette, Music), a row of buttons, and four groups (**Look**, **Land and video**, **Save and share**, **More**) of which one at most is open: `menu` and `setMenu(name)` in `controls.js`, with the group rows named `menuLook` and so on in `index.html`. Its last button, **Help and source**, is a link to the repository's README; on a copy served from `<user>.github.io/<name>` it is rewritten to point at `github.com/<user>/<name>`.

### VR viewer

`setStereo(on)` switches a side-by-side stereo mode for a phone in a Cardboard-style viewer. The button is hidden on devices without touch; the harness can still call `setStereo(true)`.

**Rays.** The scene shader takes `uVr = (on, lens centre offset in buffer pixels, tangent per buffer pixel, half the eye spacing in world units)`. A pixel in the left half of the buffer belongs to the left eye. Its position relative to that eye's lens centre, times the tangent per pixel, is `q`, the tangent of its angle as seen without a lens. The lens is modelled with Cardboard's radial polynomial, `uv = q * (1 + 0.34*|q|^2 + 0.55*|q|^4)`, and the ray is `normalize(uCam * vec3(uv, 1.0))`. Because each pixel's ray is bent the way the lens will bend its light, no separate distortion pass is needed. Pixels with `|uv| > 1.8` are black and are not marched. The ray origin is `uPos + uCam * vec3(eo, 0)` with `eo = (-half, 0)` or `(+half, 0)`.

**Geometry.** Lens spacing is 64 mm and lens-to-screen distance 39 mm (Cardboard V2). The browser does not expose physical screen size, so one CSS pixel is assumed to be 0.162 mm. This is the main source of error and has no user adjustment yet. `uPix` is set to the tangent per pixel so the hit threshold still tracks pixel size.

**Eye spacing.** `vrEye` eases toward `0.021 * dist`, where `dist` is the distance to the nearest surface. That is a 64 mm spacing in a world scaled so the nearest surface is about 1.5 m away. It follows the same idea as flight speed: the world keeps a similar apparent size however deep you fly. Volumetric worlds report a constant distance of 0.2.

**Mirrors.** The fold acts on the ray direction, as in normal mode. For the angle `a0 = atan(uv) + uSpin`, the fold is either a rotation or a reflection of the plane, depending on the wedge. The same rotation or reflection is applied to `eo`. Both eyes' rays through one wedge are then moved by one rigid transform, so depth is consistent inside each wedge.

**Head look.** `onGyro` handles `deviceorientation`. `devMat(alpha, beta, gamma, o)` builds the W3C rotation matrix `Rz(alpha) Rx(beta) Ry(gamma)` and multiplies it by `Rz(-o)`, where `o` is the screen rotation, giving screen axes in earth axes. Working with matrices avoids the jump in the angles when gamma passes 90 degrees, which is where a phone in a viewer sits. `gyroTurn(P, S)` returns the rotation between the previous and current matrix as an axis-angle vector in screen axes (x right, y up, z toward the viewer). That turn is applied to `R`, `Up` and `F` about `-x*R - y*Up + z*F`; the signs differ because the camera's forward axis points into the screen. Only the change between events is used, so the head turn adds to touch look and to the autopilot's steering, and the compass heading does not matter. Turns over 0.6 radians between events are dropped. iOS needs `DeviceOrientationEvent.requestPermission()` from a tap, which the button's click provides.

**Comfort.** While `stereo` is true `jPool` leaves the cloud worlds out of Journey's choice of world (they have no surfaces, so both eyes see the same flat glow), unless a template allows nothing else, and `autopilot` turns at half its usual rate. Both were chosen by reasoning; neither has been tried in a viewer.

**What is switched off.** Everything centred on the screen would show each eye something different. In `frame()`: the feedback pass gets decay 0 and no overlay (so it passes the scene through); filters that move pixels (Echo, Mosaic, Liquid, Prism, Quad, Tiles, Bulge, Twirl) are treated as none; `FS_FINAL` gets `uVr = 1`, which zeroes zoom blur and colour fringing; the transition type is forced to blink, the only one that is the same for both eyes; the idle roll is skipped. Field-of-view pulsing does not apply because the lens model fixes the field of view. Bloom is kept.

**Screen wake.** `keepAwake()` holds a screen wake lock (`navigator.wakeLock`) while Journey or the VR viewer is on, since nobody touches the screen then. `setJourney` and `setStereo` call it. The browser drops the lock when the page is hidden, so it is taken again when the page becomes visible. Browsers without the API, and iOS before 16.4, fall back to the phone's own lock timer.

## 14. Testing

There is no test framework. `tools/` holds what was used during development:

| Command | What it does |
|---|---|
| `node tools/unit.mjs` | Imports the pure functions (change detector, picker, head-turn math, steering handoff, cleaners, palette conversions) from the modules and tests them |
| `node tools/pack.mjs` | Checks every pack with the app's own cleaners, and that `packs/index.json` is up to date |
| `node tools/gallery.mjs` | Writes `packs/index.json` from the pack files |
| `node tools/offer.mjs event.json --dry` | Runs the gallery's offer check on a saved issue event |
| `python3 tools/probe.py` | Compares every world's GLSL `map` with its JavaScript `de` through the distance probe |
| `python3 tools/check.py` | Headless smoke test: compiles all worlds, cycles every option, opens the setup panel, runs journey ticks, taps a tempo, starts audio; fails on any script or WebGL error |
| `python3 tools/render.py ...` | Screenshot one world, or `--all` for a contact sheet; `--js` runs code inside the page |

`tools/harness.py` explains the mechanism: it writes a temporary copy of `index.html` with a `<base>` pointing at the repository and one extra script that waits for the `mf-ready` event (sent by `main.js` after start-up) and then runs the test code inside `with(window.MF)`. It relies on the exact tag that loads `js/main.js` and asserts on it. Chrome is started with `--allow-file-access-from-files` so that modules load from `file://`.

Things to know about the headless environment:

- Rendering is software (SwiftShader), around ten frames per virtual second at full size. Use `--fast` and a larger `--budget` for anything involving feedback.
- Virtual time only advances while timers are pending. Drive tests with `setTimeout` steps; a `requestAnimationFrame` loop alone stalls.
- `dt` is capped at 50 ms per frame, so simulated time runs slower than virtual time.

`docs/worlds.jpg` is a contact sheet of all worlds from `render.py --all`.

### What has and has not been verified

Verified in headless Chrome: the VR viewer renders two lens-shaped pictures with the expected offset between them, with and without mirrors; every shader compiles; every motion, filter, overlay and transition renders; the journey engine, setup panel, file player and scrubber (both playback paths), tap tempo and spot links work without errors.

Not verified, because they need a real device or a human:

- Frame rate on phones. Bulbs, Julia and the Mandelbox worlds are the heaviest.
- Multi-touch gestures. They cannot be simulated; the twist direction may feel reversed.
- How the built-in music sounds, and how strong each band's reaction should be.
- The change detector on real songs.
- Seeking in the streaming fallback on iOS, used for files over 15 minutes.
- Whether iOS keeps another app's music playing while the page is open in tap mode.
- Text entry in the setup panel on iOS (`user-select: text` is set on inputs because the body disables selection).
- Listening to a real Spotify or YouTube tab, and to a real microphone. Both paths were run in headless Chromium with simulated devices: the analyser received sound, the output stayed muted, and switching away released the stream. Whether Spotify's copy-protected audio reaches a shared tab stream, how strong the microphone gain of 3 should be, and what iOS does to another app's music when the microphone opens are unknown.
- Whether the steering handoff thresholds (0.08 and 0.5 rad/s, 0.7 s fade) suit a real head in a viewer. A head is never quite still, and sensor noise on a real phone is unknown.
- Whether the screen wake lock holds on a real phone with Journey or the VR viewer on, in Safari and as a home-screen web app.
- Everything about the VR viewer on a real phone: whether the two pictures merge through real lenses, whether the assumed pixel size is close enough, whether head turns go the right way in both landscape directions, and whether the autopilot is comfortable. The head-turn math is unit tested but the sensor conventions were taken from the specification, not from a device.
- The home-screen web app mode on iPhone (see section 2): that it opens without Safari's bars, and that the safe-area padding keeps the HUD clear of the notch and home bar.

## 15. Known weaknesses

- **Box and Fortress are grainy in flight.** Mandelbox detail is finer than the pixel-footprint threshold can tame. Hold still (section 8b) cleans a frame that is not moving; fewer iterations or a larger hit threshold for these two would help while flying.
- **The HUD is still tall on a phone with Journey on.** The buttons are in four groups that open one at a time (`setMenu` in `controls.js`; `wakeHud` closes the open one when the HUD fades), so the HUD at rest is the three lists, one row of seven buttons and, with Journey on, the journey row: about six lines of pills at phone width, where it was ten. The video's row shows only while **Land and video** is open (a CSS rule on `#hud[data-menu]`). Seen only in headless Chrome, which cannot be narrower than 500 pixels.
- **Motion strengths were tuned from stills.** Some are probably too strong or too subtle in motion.
- **Bulge is subtle; Scope and Orbit overlays can be faint** against bright worlds.

## 16. Ideas not yet built

- VR viewer: a way to set the screen size or lens spacing, comfort options for the autopilot (slower turns, a vignette while turning), trails and overlays redone per eye, and a WebXR mode for real headsets.
- A list of saved scenes in the app. A scene can be kept as a picture (Save picture) or in a pack, but there is no list of them to tap.
- Per-band reaction strength controls.
- A proper MilkDrop-style per-pixel equation system, if the fixed motion list feels limiting.
- Jittered supersampling while flying (Hold still, section 8b, does it only while nothing moves). It needs each pixel's place in the last frame, which the scene shader does not work out.
- The rest of `docs/ROADMAP.md`.

## 17. How the code came to be laid out this way

The app was one script in one closure. It was split in four steps, each done mostly by programs that parsed the code and moved text without rewriting it, and each checked with the smoke test, the probe test, the unit tests and renders:

1. **Files.** The script was cut along its section comments into modules. Start-up statements went into each file's `init()`; names set by more than one file went into one shared object.
2. **Owners.** The shared object was removed. Values were moved to the file that sets them, the few changes from outside became function calls, and the values that a frame changes in many places became the five state objects.
3. **The frame.** `frame()`, one function of 300 lines, was cut into the steps listed in section 3. The statements inside each step were not changed; each step begins by reading what it needs from the frame's notes and ends by leaving what later steps need.
4. **Homes.** Code that sat in the wrong file because of where the old comments fell was moved: palettes, Stats, orbs, share spots, pack worlds, the effect programs.

What could still be better:

- **The frame's notes are one shared record.** `fr` has about thirty fields, all declared with a comment in `loop.js`, but which step sets which is not checked. Steps that returned their results and took them as arguments would make the flow checkable.
- **The drawing steps set dozens of uniforms by hand.** A small table per program would shorten `render.js` and make a missed uniform harder.
- **`__dbg` is boilerplate.** It exists because the browser tests reach every name. Tests that import what they use would let it go.
- **`init()` order still matters** for a few files (the lists must be filled before a world is chosen, the library must load before templates are read). The order is the one in `main.js`.

Keeping each world's GLSL next to its JavaScript `de` is worth preserving in any layout, because they must change together.
