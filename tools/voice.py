#!/usr/bin/env python3
"""Make the lessons' voice: one sound file for each step, read from the step's own words by Kokoro.

    python3 tools/voice.py            make the files whose words have changed, or that are missing
    python3 tools/voice.py --all      make every file again
    python3 tools/voice.py --lang en  one language only (default: every language in js/lang.js)

The words are the four pieces of text of each step in lang/<language>.json, exactly as the page shows them. The files go
to voice/<language>/<track>-<step>.mp3, and voice/<language>/index.json records the mark (sayHash in js/lessons.js) of the
words each was made from. tools/unit.mjs fails when a mark no longer matches, so the voice cannot fall behind the text.

Needs: node, ffmpeg, and the Python packages kokoro and soundfile (pip install kokoro soundfile). The first run fetches
the Kokoro model.
"""
import argparse, json, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# for each language: Kokoro's letter for it, and the voice that reads it
VOICES = {"en": ("a", "af_heart")}
RATE = 24000      # Kokoro's samples a second
GAP = 0.45        # seconds of quiet between the pieces of a step
BITS = "48k"      # one voice, speech only: small files that every phone plays

# what to say: asked of the app's own modules, so that this tool and the page cannot disagree
LIST_JS = r"""
import { readFileSync } from "node:fs";
const root = process.argv[1];
const les = await import(root + "/js/lessons.js"), { LANGS } = await import(root + "/js/lang.js");
const out = [];
for (const lg of LANGS) {
  const words = JSON.parse(readFileSync(root + "/lang/" + lg + ".json", "utf8"));
  for (const T of les.TRACKS) for (const s of T.steps) {
    const parts = les.narration(words, T.id, s);
    out.push({ lang: lg, key: T.id + "-" + s, file: les.voiceName(lg, T.id, s), parts, hash: les.sayHash(parts.join("\n")) });
  }
}
console.log(JSON.stringify(out));
"""


def wanted():
    r = subprocess.run(["node", "--input-type=module", "-e", LIST_JS, ROOT], capture_output=True, text=True)
    if r.returncode:
        raise SystemExit("Could not list the lessons:\n" + r.stderr)
    return json.loads(r.stdout)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--lang")
    a = ap.parse_args()
    todo, marks = [], {}
    for it in wanted():
        if a.lang and it["lang"] != a.lang:
            continue
        if it["lang"] not in VOICES:
            raise SystemExit("No voice is chosen for the language " + it["lang"] + ": add it to VOICES in tools/voice.py")
        idx = os.path.join(ROOT, "voice", it["lang"], "index.json")
        if it["lang"] not in marks:
            try:
                marks[it["lang"]] = json.load(open(idx, encoding="utf-8"))
            except (OSError, ValueError):
                marks[it["lang"]] = {}
        if a.all or marks[it["lang"]].get(it["key"]) != it["hash"] or not os.path.exists(os.path.join(ROOT, it["file"])):
            todo.append(it)
    if not todo:
        print("every voice file is up to date")
        return
    import numpy as np
    import soundfile as sf
    from kokoro import KPipeline
    pipes = {}
    for it in todo:
        code, voice = VOICES[it["lang"]]
        if code not in pipes:
            pipes[code] = KPipeline(lang_code=code)
        quiet, bits = np.zeros(int(RATE * GAP), dtype=np.float32), []
        for part in it["parts"]:
            for _, _, audio in pipes[code](part, voice=voice, speed=1.0):
                bits.append(np.asarray(audio, dtype=np.float32))
            bits.append(quiet)
        wave = np.concatenate(bits[:-1])
        out = os.path.join(ROOT, it["file"])
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            tmp = f.name
        try:
            sf.write(tmp, wave, RATE)
            r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp, "-ac", "1", "-b:a", BITS, "-map_metadata", "-1", out],
                               capture_output=True, text=True)
            if r.returncode:
                raise SystemExit("ffmpeg failed:\n" + r.stderr)
        finally:
            os.unlink(tmp)
        marks[it["lang"]][it["key"]] = it["hash"]
        print("%-28s %5.1f s  %4d KB" % (it["file"], len(wave) / RATE, os.path.getsize(out) // 1024))
    for lg, m in marks.items():
        with open(os.path.join(ROOT, "voice", lg, "index.json"), "w", encoding="utf-8") as f:
            json.dump(dict(sorted(m.items())), f, indent=1)
            f.write("\n")


if __name__ == "__main__":
    main()
