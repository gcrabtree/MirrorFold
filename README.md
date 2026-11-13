# Mirrorfold

Fly through endless fractal worlds in your browser. Kaleidoscope mirrors, feedback trails, filters, overlays and an autopilot that reacts to music.

## Run it

Open `index.html`. That is the whole app.

To host it on GitHub Pages, put these files at the root of the published branch and enable Pages. No build is needed.

## Controls

**Phone:** left thumb moves, right thumb looks. Two fingers on the right side: pinch for speed, twist to roll. Double-tap for a burst of speed.

**Desktop:** click to capture the mouse. W A S D to fly, Space and Shift for up and down, Q and E to roll, wheel for speed. `[` and `]` change world, P palette, M mirrors, J journey, T tap tempo, B boost.

## Music

- **Built-in music:** a generative track the visuals react to.
- **My audio file:** pick an MP3 or M4A you own. Files over 15 minutes are streamed rather than loaded whole.
- **Tap tempo:** for music playing in another app, such as Apple Music. Enter silent, start your song, choose Tap tempo and tap the beat.

## Files

| Path | What it is |
|---|---|
| `index.html` | The app |
| `docs/ARCHITECTURE.md` | How it works: pipeline, math, audio, journey engine, known issues |
| `docs/worlds.jpg` | Contact sheet of all 17 worlds |
| `CLAUDE.md` | Working notes for Claude Code sessions |
| `tools/` | Headless test harness and renderer (see `CLAUDE.md` for commands) |

## Testing

```
node tools/unit.mjs
python3 tools/check.py
```
