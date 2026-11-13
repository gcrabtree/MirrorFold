# Mirrorfold: project, architecture, math and code

This document is written for an engineer (or a Claude Code session) picking the project up cold. It describes what the app does, how the code is laid out, the math behind each part, how to test it, and what is known to be weak.

Everything lives in one file, `index.html` (about 2,480 lines, 126 KB): markup, CSS, GLSL and JavaScript. There is no build step and there are no dependencies apart from two Google Fonts.

## 1. What it is

Mirrorfold is a first-person fly-through of endless fractal worlds, rendered by raymarching in a WebGL 1 fragment shader, with a MilkDrop-style feedback and filter chain on top and music reactivity underneath. It is designed for a phone first (touch controls, adaptive resolution) and also works with mouse and keyboard.

Features, in the order a user meets them:

- **17 worlds.** 15 are surfaces found by sphere tracing a distance estimator; 2 (Nebula, Aurora) are volumetric.
- **Free flight** with six degrees of freedom. Speed scales with distance to the nearest surface, so you cannot hit a wall.
- **Kaleidoscope mirrors**: off, 3, 4, 6, 8 or 12 segments, applied to the ray direction.
- **13 palettes** (7 available at once, 6 unlocked by finding orbs).
- **Feedback motions** (6), **filters** (17), **overlays** (7) and **transitions** (8).
- **Music**: a built-in generative track, a user's audio file with a scrubber, the sound of another browser tab, the microphone, or tap tempo for music playing in another app. Three frequency bands drive different parts of the picture.
- **Journey**: an autopilot that flies, and changes world, palette, mirrors, motion, filter and overlay on jittered clocks. What it may change is set by templates; sets play several templates in turn. Both are user-editable and stored in the browser.
- **Orbs** to find, **Share spot** links, and a morphing parameter that makes every world breathe.
- **VR viewer**: side-by-side stereo with gyroscope look, for a phone in a Cardboard-style holder (section 13).

## 2. Running and deploying

Open `index.html` in a browser. It works from `file://` and from any static host.

For GitHub Pages: put `index.html` at the root of the published branch (or in `/docs` if Pages is set to that folder). The empty `.nojekyll` file stops Pages from running Jekyll over the repo. No configuration is needed.

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

`index.html` is organised in this order. Section comments in the source (`/* ---------- name ---------- */`) match the names below. Line numbers are approximate and will drift.

| Lines | Section | Contents |
|---|---|---|
| 1–90 | `<style>` | Design tokens in `:root`, HUD pills, start card, scrubber, setup panel |
| 91–190 | Markup | Canvas, HUD rows, start card, journey setup panel, toast, error box |
| 190–210 | Setup | `$`, touch and reduced-motion detection, WebGL context, `STEPS` |
| 209–665 | `the worlds` | `fr`, `md`, `tile` helpers and the `WORLDS` array |
| 666–685 | Palettes | `PALETTES`, unlock state, `saveProgress` |
| 687–778 | Scene shader | `VS`, `fragSource(w)` builds the fragment shader for one world |
| 779–900 | `post-processing shaders` | `FS_TRAIL`, `FS_DOWN`, `FS_BLUR`, `FS_FINAL` |
| 900–960 | Programs | `sh`, `link`, `build(w)`, `hybProg(a,b)` |
| 961–990 | `render targets`, `resolution` | `target`, `resize`, detail modes |
| 990–1063 | `state` | Camera, `MOTIONS`, `LOOKS`, `OVERLAYS`, journey clocks `J`, `beginWarp`, `deAt` |
| 1064–1200 | `choosing a world` | Dropdown fill, `spawnOrb`, `collectOrb`, hybrids, `setWorldNow`, `requestWorld`, `warpThen`, spot encode and decode, hash routing |
| 1201–1290 | `input` | Pointer, wheel and keyboard handlers, gestures |
| 1291–1423 | `HUD`, `journey templates` | `CATS`, built-in templates and sets, storage, the journey engine |
| 1424–1560 | `journey setup panel` | The editor UI |
| 1560–1624 | HUD buttons | Share, overlay strength, orbs, `updateWave` |
| 1625–1936 | `music` | Audio graph, sequencer, file player and scrubber, `setMusic`, tap tempo, bands, change detector |
| 1937–1945 | `start` | `begin` |
| 1946–2146 | `loop` | `frame(now)`: the whole per-frame update and render |

The script is one IIFE in ES5 style (`var`, function declarations, no modules, no classes). All state is closure variables. This was deliberate for a single-file artifact; see section 17 for a suggested split.

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

In auto mode, every 30 frames the mean frame time is checked: above 36 ms, `q` is multiplied by 0.9; below 22 ms, by 1.06. The policy is to give up frame rate before sharpness. An earlier version started at 0.55 and dropped to 0.3, which users found too blurry.

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

### Hybrids (dormant)

`hybProg(a,b)` compiles a shader that defines `mapA` and `mapB` from two worlds and returns `mix(mapA(p), mapB(p + uOff), uMix)`. A mix of two 1-Lipschitz functions is 1-Lipschitz, so it is a valid field. `uOff` solves the period problem: when the camera wraps by world A's period, the same shift is added to `uOff` and then wrapped by B's period, so B keeps being sampled at the right place. `startHybrid`, `finishHybrid` and `deAt` support this.

The user-facing Blend dropdown and the journey morph option were removed because blends cost twice as much per pixel and did not look good enough. The engine code remains and works; nothing calls `startHybrid` at present.

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
6. Colour filters by `uFx`: Thermal (luminance through the palette), CRT, Halftone, Contour, Noir.
7. Bloom is added, then the transition tint and mask.

### Transitions

A world change (and a journey mirror change) runs `warp` from 0 to 1 over 0.5 s, performs the change at the peak, and returns to 0 over 0.8 s. `beginWarp()` picks one of eight types at random, never repeating the last: swirl, dive, blocks, fold, melt, blink, tear, dissolve. All but blink and dissolve finish in a wash of the current palette colour at the peak, which hides the swap and the shader-compile hitch. `requestWorld(i)` starts a transition to a world; `warpThen(fn)` runs any function at the peak.

## 9. Palettes

Cosine palettes: `colour(x) = a + b*cos(2π*(c*x + d))`, four `vec3` parameters per palette. The shader's `pal()` reads them from uniforms `uPa..uPd`. The live values `palCur` ease toward the selected palette at rate 1.6 per second, so palette changes are smooth. The phase `uHue` drifts slowly and faster with treble.

The first seven palettes are always available. The other six are unlocked one at a time by collecting orbs; the count is stored under `localStorage["mirrorfold"]`. Palettes added from packs follow the built-ins and are always available (see Packs in section 11).

## 10. Audio

### Graph

```
drone oscillators -> droneGain -> lowpass -+
kick, bass, pluck, hat --------------------+-> bus -> analyser -> master -> destination
pluck -> sendIn -> delay (feedback) -------+
file (buffer source or media element) -----+

shared tab or microphone -> cap.gain -> analyser      (master gain is 0 while listening)
```

One `AnalyserNode` (FFT 1024) sees whatever is playing. `ensureAudio()` builds the graph on first use.

### Sources (`setMusic(mode)`)

- **built**: a generative track at 92 BPM. `tick()` runs every 90 ms and schedules eighth-note steps 350 ms ahead with `playStep`. Kick on every beat, hat off the beat, a bass note each bar, and a triangle-wave arpeggio that random-walks a minor pentatonic scale. The root moves through A, F, C, G every four bars and the drone retunes with it.
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

`J` holds one clock per category: `world`, `palette`, `mirrors`, `motion`, `filter`, `overlay`. `jReset(k)` sets the next firing time to `base * (0.8 + 0.4*random)`, so each change lands within a fifth either side of its target interval and the categories drift relative to each other.

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

### Sets

```js
{ name: "Grand tour", builtin: true, order: "cycle",   // or "random"
  items: [ { tpl: "Clean flight", min: 2 }, { tpl: "MilkDrop", min: 2 }, ... ] }
```

`advanceSet()` moves to the next item (or a random different one) when its minutes are up and calls `applyTemplate`. Items whose template no longer exists are skipped.

### Storage

`localStorage["mirrorfold-journeys"]` holds `{ tpls, sets, sel }`, where `sel` is `"t:<name>"` or `"s:<name>"`. Built-ins are defined in code and never stored. `adopt(raw)` validates stored or loaded data and skips names that collide with built-ins. It reads templates from `raw.templates` (packs) or `raw.tpls` (storage and older backups).

### Packs

A pack is JSON: `{ mirrorfold: 1, name, author, palettes, motions, templates, sets }`. The format and ranges are documented for authors in `packs/README.md`. It is data only; nothing in a pack is evaluated.

- **Cleaners.** `cleanName`, `cleanPalette` and `cleanMotion` are pure functions. They refuse a wrong shape (returning `null`), copy only known fields into a new object, and clamp every number. The motion ranges are what keeps a pack from breaking the no-strobe rule, so widen them only after looking at the result.
- **Library.** Added palettes and motions are appended to `PALETTES` and `MOTIONS` after the built-ins (`NPAL` and `NMOT` are the built-in counts) and stored in `localStorage["mirrorfold-library"]`. They are loaded before the selects and `CATS` are built. `libAdd` refuses built-in names, replaces an earlier added item of the same name, and stops at `LIB_MAX` (16) per kind.
- **Loading.** `loadPack(text)` is the one entry point for a file, pasted text and a published pack. It adds palettes and motions first, calls `refreshLists()` (which rebuilds the two selects and the palette and motion options in `CATS`), then adopts templates and sets, so a template can name items from its own pack.
- **Published packs.** `loadSitePacks()` fetches `packs/index.json` from the same folder as the page, once, when the panel opens. File names must match `^[a-z0-9][a-z0-9_-]*\.json$`. Under `file:` it does nothing and the row stays hidden.
- **Palette locks.** `palOpen(i)` says whether a palette may be used: built-ins up to the orb count, and every added palette. Use it instead of comparing against `BASE_PALS + unlocked`.
- **Share links** store the palette by index in one base-36 digit. 13 built-ins plus 16 added fit. A link that names an added palette the receiver does not have keeps the receiver's current palette.
- **`tools/pack.mjs`** extracts the cleaners by name and fails on any pack in `packs/` that would be refused or changed. It is meant to run on pull requests.

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

**Touch.** A touch that starts in the left 45% of the screen is the move stick (a ring appears under the finger; deflection gives strafe and forward). A touch elsewhere is look. A second finger on the look side starts a gesture: the change in distance between the two fingers scales `baseSpeed`, and the change in angle rolls the camera. Two quick taps on the look side set `boost = 1`, which decays at 1.2 per second and multiplies speed by up to 4.

**Mouse and keyboard.** Click captures the pointer where allowed, otherwise drag to look. W A S D, Space and Shift (up and down), Q and E (roll), arrows (look), wheel (speed), `[` and `]` (world), 1–9 (world), P (palette), M (mirrors), J (journey), T (tap tempo), B or double-click (boost). Key handling is skipped while focus is in a select, input or textarea.

The HUD fades after 5 seconds without interaction and returns on any touch. Its last button, **Help and source**, is a link to the repository's README; on a copy served from `<user>.github.io/<name>` it is rewritten to point at `github.com/<user>/<name>`.

### VR viewer

`setStereo(on)` switches a side-by-side stereo mode for a phone in a Cardboard-style viewer. The button is hidden on devices without touch; the harness can still call `setStereo(true)`.

**Rays.** The scene shader takes `uVr = (on, lens centre offset in buffer pixels, tangent per buffer pixel, half the eye spacing in world units)`. A pixel in the left half of the buffer belongs to the left eye. Its position relative to that eye's lens centre, times the tangent per pixel, is `q`, the tangent of its angle as seen without a lens. The lens is modelled with Cardboard's radial polynomial, `uv = q * (1 + 0.34*|q|^2 + 0.55*|q|^4)`, and the ray is `normalize(uCam * vec3(uv, 1.0))`. Because each pixel's ray is bent the way the lens will bend its light, no separate distortion pass is needed. Pixels with `|uv| > 1.8` are black and are not marched. The ray origin is `uPos + uCam * vec3(eo, 0)` with `eo = (-half, 0)` or `(+half, 0)`.

**Geometry.** Lens spacing is 64 mm and lens-to-screen distance 39 mm (Cardboard V2). The browser does not expose physical screen size, so one CSS pixel is assumed to be 0.162 mm. This is the main source of error and has no user adjustment yet. `uPix` is set to the tangent per pixel so the hit threshold still tracks pixel size.

**Eye spacing.** `vrEye` eases toward `0.021 * dist`, where `dist` is the distance to the nearest surface. That is a 64 mm spacing in a world scaled so the nearest surface is about 1.5 m away. It follows the same idea as flight speed: the world keeps a similar apparent size however deep you fly. Volumetric worlds report a constant distance of 0.2.

**Mirrors.** The fold acts on the ray direction, as in normal mode. For the angle `a0 = atan(uv) + uSpin`, the fold is either a rotation or a reflection of the plane, depending on the wedge. The same rotation or reflection is applied to `eo`. Both eyes' rays through one wedge are then moved by one rigid transform, so depth is consistent inside each wedge.

**Head look.** `onGyro` handles `deviceorientation`. `devMat(alpha, beta, gamma, o)` builds the W3C rotation matrix `Rz(alpha) Rx(beta) Ry(gamma)` and multiplies it by `Rz(-o)`, where `o` is the screen rotation, giving screen axes in earth axes. Working with matrices avoids the jump in the angles when gamma passes 90 degrees, which is where a phone in a viewer sits. `gyroTurn(P, S)` returns the rotation between the previous and current matrix as an axis-angle vector in screen axes (x right, y up, z toward the viewer). That turn is applied to `R`, `Up` and `F` about `-x*R - y*Up + z*F`; the signs differ because the camera's forward axis points into the screen. Only the change between events is used, so the head turn adds to touch look and to the autopilot's steering, and the compass heading does not matter. Turns over 0.6 radians between events are dropped. iOS needs `DeviceOrientationEvent.requestPermission()` from a tap, which the button's click provides.

**What is switched off.** Everything centred on the screen would show each eye something different. In `frame()`: the feedback pass gets decay 0 and no overlay (so it passes the scene through); filters that move pixels (Echo, Mosaic, Liquid, Prism, Quad, Tiles, Bulge, Twirl) are treated as none; `FS_FINAL` gets `uVr = 1`, which zeroes zoom blur and colour fringing; the transition type is forced to blink, the only one that is the same for both eyes; the idle roll is skipped. Field-of-view pulsing does not apply because the lens model fixes the field of view. Bloom is kept.

**Screen wake.** `keepAwake()` holds a screen wake lock (`navigator.wakeLock`) while Journey or the VR viewer is on, since nobody touches the screen then. `setJourney` and `setStereo` call it. The browser drops the lock when the page is hidden, so it is taken again when the page becomes visible. Browsers without the API, and iOS before 16.4, fall back to the phone's own lock timer.

## 14. Testing

There is no test framework. `tools/` holds what was used during development:

| Command | What it does |
|---|---|
| `node tools/unit.mjs` | Extracts `makeChangeDetector`, `jPick`, `devMat`, `gyroTurn` and `userActive` from `index.html` by name and tests them |
| `python3 tools/check.py` | Headless smoke test: compiles all worlds, cycles every option, opens the setup panel, runs journey ticks, taps a tempo, starts audio; fails on any script or WebGL error |
| `python3 tools/render.py ...` | Screenshot one world, or `--all` for a contact sheet; `--js` runs code inside the page |

`tools/harness.py` explains the mechanism: it writes a temporary copy of the page with JavaScript injected just before the closing `})();` of the script, so test code runs inside the closure and can see every variable. It relies on two exact strings in `index.html` (the script's first and last lines) and asserts they are present.

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

- **Box and Fortress are grainy.** Mandelbox detail is finer than the pixel-footprint threshold can tame. Fewer iterations or a larger hit threshold for these two would help.
- **The HUD is large.** With Journey on and a file loaded it covers about a third of a phone screen until it fades. It is four to six wrapping rows of pills. A collapsible menu or tabs would be better.
- **Motion strengths were tuned from stills.** Some are probably too strong or too subtle in motion.
- **Bulge is subtle; Scope and Orbit overlays can be faint** against bright worlds.
- **Hybrid code is dead weight** unless the feature returns.
- **`bmax` and `bavg` are unused** leftovers from the single-band analyser.
- **Sponge with Halls and similar blends looked murky**, which is part of why blends were cut.

## 16. Ideas not yet built

- VR viewer: a way to set the screen size or lens spacing, comfort options for the autopilot (slower turns, a vignette while turning), trails and overlays redone per eye, and a WebXR mode for real headsets.
- Export and import of templates as a file.
- Saving the current look (palette, mirrors, motion, filter, overlay) as a one-tap preset, separate from journey templates.
- Per-band reaction strength controls.
- A proper MilkDrop-style per-pixel equation system, if the fixed motion list feels limiting.
- Temporal anti-aliasing or jittered supersampling over the feedback buffer to tame fractal speckle.

## 17. Suggested refactor for a repository

The single file was right for an artifact. In a repo, a split along the existing section boundaries is natural and needs no bundler if ES modules are used:

```
index.html            markup only
css/app.css
js/main.js            setup, state, frame loop
js/worlds.js          WORLDS (GLSL and JS distance estimators together, per world)
js/shaders.js         fragSource, FS_TRAIL, FS_DOWN, FS_BLUR, FS_FINAL
js/gl.js              link, build, target, resize
js/audio.js           graph, sequencer, player, bands, change detector
js/journey.js         CATS, templates, sets, engine
js/journey-panel.js   the editor
js/input.js           pointer, keyboard, gestures
```

Two cautions. First, the code shares a lot of closure state (`world`, `pos`, `warp`, `beat` and so on); the split needs either a shared state module or explicit parameters, and that is the real work. Second, `tools/harness.py` injects test code into the closure and `tools/unit.mjs` extracts functions by regex. Both must be updated in the same change. With modules, the unit tests can simply import the functions.

Keeping each world's GLSL next to its JavaScript `de` is worth preserving in any layout, because they must change together.
