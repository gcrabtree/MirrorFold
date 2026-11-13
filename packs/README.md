# Mirrorfold packs

A pack is one JSON file of palettes, motions, filters, Journey templates and sets. Almost all of it is names and numbers. The one exception is a filter, which may hold a short picture program for the graphics chip. Nothing in a pack is ever run as JavaScript, so a pack cannot reach the page, your files or the network.

Packs in this folder are offered to everyone in the app: press **Library**, choose a pack, and press **Add this pack**. Anyone can also load a pack file from their own device with **Load a pack file**, without it being in this folder.

Worlds and overlays cannot be put in a pack yet.

## Format

```json
{
 "mirrorfold": 1,
 "name": "Starter pack",
 "author": "your name",
 "palettes": [
  {"name": "Glacier", "a": [0.45, 0.6, 0.7], "b": [0.35, 0.35, 0.3], "c": [1, 1, 1], "d": [0.5, 0.55, 0.6]}
 ],
 "motions": [
  {"name": "Slow spin", "decay": 0.96, "zoom": 0.998, "rot": 0.006}
 ],
 "filters": [
  {"name": "Inked", "edge": 0.6, "post": 6},
  {"name": "Duotone", "code": "float l=luma(col);col=mix(pal(0.15),pal(0.65),l);"}
 ],
 "templates": [
  {"name": "Starter drift",
   "palette": {"mode": "random", "every": 30, "set": ["Glacier"]},
   "motion": {"mode": "random", "every": 40, "set": ["Slow spin"]}}
 ],
 "sets": []
}
```

`"mirrorfold": 1` is the format version. Every list is optional. Names are 1 to 28 characters.

### Palettes

A palette gives the colour at each point `x` as `a + b × cos(2π × (c × x + d))`, separately for red, green and blue. Each of `a`, `b`, `c` and `d` is a list of three numbers.

| Field | Meaning | Allowed range |
|---|---|---|
| `a` | Middle brightness of red, green, blue | 0 to 1 |
| `b` | How far each swings either side of the middle | 0 to 1 |
| `c` | How many times each repeats across the range | 0 to 3 |
| `d` | Where in its cycle each one starts | -2 to 2 |

### Motions

A motion moves the previous picture a little before the new one is drawn over it, which leaves trails. Values are per frame at 60 frames a second. Leave a field out to leave that movement off.

| Field | Meaning | Allowed range |
|---|---|---|
| `decay` | How much of the old picture stays each frame | 0 to 0.98 |
| `zoom` | Below 1 the trails rush outward, above 1 they pull inward | 0.95 to 1.05 |
| `rot` | Turn, in radians | -0.025 to 0.025 |
| `swirl` | Extra turn that grows toward the edge | -0.08 to 0.08 |
| `wob` | Wavy sideways wobble | 0 to 0.006 |
| `rip` | Rings spreading from the middle, stronger on the beat | 0 to 0.03 |
| `dx`, `dy` | Steady slide sideways and vertically | -0.012 to 0.012 |
| `kick` | How strongly the beat pushes the zoom | -1 to 1 |

### Filters

A filter changes the finished picture. It can be a mix of the built-in filter controls, a short program, or both. Leave a field out, or give 0, to leave that control off.

| Field | Meaning | Allowed range |
|---|---|---|
| `edge` | Glowing outlines, as in Neon | 0 to 1 |
| `post` | Number of brightness steps, as in Poster | 3 to 16 |
| `solar` | Bright areas fold back to dark, as in Solar | 0 to 1 |
| `inv` | Negative | 0 to 1 |
| `echo` | A second, larger copy of the picture laid over it | 0 to 1 |
| `mos` | Mosaic: number of blocks down the screen | 8 to 400 |
| `liq` | Liquid wobble | 0 to 0.03 |
| `hue` | Colours turn slowly through the spectrum | 0 to 1 |
| `ca` | Extra colour fringing toward the edges | 0 to 0.04 |
| `fx` | One built-in effect: 1 Quad, 2 Tiles, 3 Bulge, 4 Twirl, 5 Thermal, 6 CRT, 7 Halftone, 8 Contour, 9 Noir | 0 to 9, whole numbers |
| `code` | A program, described next | at most 2,000 characters |

#### Filter programs

`code` is written in GLSL ES 1.00, the shader language of WebGL 1. It is the inside of this function, and it runs once for every pixel, after the controls above:

```glsl
void look(vec2 uv, inout vec3 col) {
  // your code
}
```

Change `col` to change the pixel. This is what the code can use:

| Name | What it is |
|---|---|
| `col` | The pixel's colour so far, red, green and blue from 0 to 1. Change it. |
| `uv` | Where the pixel is on the screen, 0 to 1 across and up |
| `scene(vec2)` | The picture's colour at another place on the screen |
| `pal(float)` | A colour from the current palette |
| `luma(vec3)` | The brightness of a colour |
| `pixel` | The size of one pixel, in the same units as `uv` |
| `aspect` | Screen width divided by height |
| `gl_FragCoord` | The pixel's position counted in pixels |

There is no clock and no sound level. A filter is a function of the picture and nothing else. That is deliberate: it keeps a filter from flashing by itself.

The app refuses code that breaks any of these rules:

- **Plain characters only:** letters, digits, punctuation, spaces, tabs and new lines. No comments (`//` or `/*`), no `#` lines, no backslashes or quotes.
- **One function:** braces must balance, so the code cannot end the function and start another.
- **No reaching outside:** no name that starts with `u` followed by a capital letter, a digit or `_`, and no `gl_` name except `gl_FragCoord`. Also not `texture2D`, `main`, `look`, `v`, or any name containing `__`.
- **No `while`, `do` or `discard`.**
- **Loops are counted and small:** only the form `for(int i=0;i<8;i++)`. Multiply the counts of all loops together, then multiply by the number of times `scene` appears. The result must be 64 or less.
- **It must compile** on the device that loads it.

#### Reviewed and not reviewed

Filter programs in this folder have been looked at by a person before being published, and are shown as written.

A filter program loaded from a file or pasted as text has not been reviewed. Mirrorfold shows it **smoothed over time**: each frame is blended with the one before, so any change takes about a quarter of a second to come through. This makes it impossible for unreviewed code to flash the screen, at the cost of slightly soft motion. The Library list marks these filters "not reviewed, so shown smoothed".

Filters with a program are switched off in the VR viewer, because they may move parts of the picture.

### Templates and sets

These are the same as the ones made in the app's Journey setup panel. The easiest way to write one is to make it in the app and press **Save mine as a pack file**.

A template has one entry for each of `world`, `palette`, `mirrors`, `motion`, `filter` and `overlay`. Each entry may have `mode` (`"keep"`, `"random"` or, except for worlds and palettes, `"off"`), `every` (seconds, 4 to 600) and `set` (the names allowed; leave it out to allow all). Worlds are named by id (`"julia"`), mirrors by number (`"6"`), everything else by the name shown in the app. A template can name palettes and motions from the same pack.

## What the app does with a pack

- **Wrong shape is refused.** A palette, motion or filter with a missing part, text where a number belongs, or no name is skipped. A filter whose program breaks a rule or does not compile is skipped.
- **Numbers are limited.** A value outside its range is pulled back to the nearest allowed value.
- **Unknown fields are dropped.**
- **Built-in names are kept.** An item with the same name as a built-in one is skipped. An item with the same name as one you added earlier replaces it.
- **Sizes are limited.** A pack file may be at most 200,000 characters. A browser holds at most 16 added palettes, 16 added motions and 16 added filters.
- **Names a template does not recognise are dropped** from its list of options.

## Adding a pack to this folder

1. Make your palettes, motions, filters and templates. Check them in the app with **Load a pack file**.
2. Name the file with lower-case letters, digits, `-` and `_`, ending in `.json`.
3. Add a line for it to `index.json`.
4. Run `node tools/pack.mjs`. It checks every pack with the same code the app uses, and fails if any value would be refused or changed. The same check runs automatically on every pull request.
5. Run `python3 tools/check.py` if you can. It loads every pack in this folder in a headless browser and fails if a filter program does not compile.
6. Open a pull request.

### Reviewing a pack with filter programs

Before merging, a maintainer should load the pack with **Load a pack file** and watch each filter on several worlds, with music playing and with a motion on. Refuse a filter that flashes, flickers in large areas, or makes the picture stutter. The automatic checks cannot judge these.

By adding a pack you agree to release it under the project's MIT licence.
