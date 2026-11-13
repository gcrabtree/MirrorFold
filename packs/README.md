# Mirrorfold packs

A pack is one JSON file of palettes, motions, Journey templates and sets. It holds names and numbers only. Mirrorfold never runs anything from a pack as program code.

Packs in this folder are offered to everyone in the app: press **Library**, choose a pack, and press **Add this pack**. Anyone can also load a pack file from their own device with **Load a pack file**, without it being in this folder.

Worlds, filters and overlays cannot be put in a pack yet. They are shader programs and need more checking than numbers do.

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

### Templates and sets

These are the same as the ones made in the app's Journey setup panel. The easiest way to write one is to make it in the app and press **Save mine as a pack file**.

A template has one entry for each of `world`, `palette`, `mirrors`, `motion`, `filter` and `overlay`. Each entry may have `mode` (`"keep"`, `"random"` or, except for worlds and palettes, `"off"`), `every` (seconds, 4 to 600) and `set` (the names allowed; leave it out to allow all). Worlds are named by id (`"julia"`), mirrors by number (`"6"`), everything else by the name shown in the app. A template can name palettes and motions from the same pack.

## What the app does with a pack

- **Wrong shape is refused.** A palette or motion with a missing part, text where a number belongs, or no name is skipped.
- **Numbers are limited.** A value outside its range is pulled back to the nearest allowed value.
- **Unknown fields are dropped.**
- **Built-in names are kept.** An item with the same name as a built-in one is skipped. An item with the same name as one you added earlier replaces it.
- **Sizes are limited.** A pack file may be at most 200,000 characters. A browser holds at most 16 added palettes and 16 added motions.
- **Names a template does not recognise are dropped** from its list of options.

## Adding a pack to this folder

1. Make your palettes, motions and templates. Check them in the app with **Load a pack file**.
2. Name the file with lower-case letters, digits, `-` and `_`, ending in `.json`.
3. Add a line for it to `index.json`.
4. Run `node tools/pack.mjs`. It checks every pack with the same code the app uses, and fails if any value would be refused or changed.
5. Open a pull request.

By adding a pack you agree to release it under the project's MIT licence.
