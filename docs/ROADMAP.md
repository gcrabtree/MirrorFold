# Mirrorfold: roadmap

Ten pieces of work that came out of a survey of similar apps (November 2026), in the order they were built. Each has what it is for, how it was meant to work, and where it stands. How each one works now is in `ARCHITECTURE.md`; what is still open is listed here, under its heading or in the table. Everything was checked in headless Chrome only. Nothing here has run on a phone, in a VR viewer, with a MIDI controller or on GitHub.

The survey looked at MilkDrop descendants (Butterchurn, projectM, NestDrop), fractal explorers (GMT, Fractal Garden, Marble Marcher, Yedoma Globula, MandelCraft), VJ tools (Synesthesia, Plane9), Electric Sheep, and the Quest fractal apps (Recombination, Cosmic Flow). None of them is an endless fly-through with a feedback chain and your own music in a phone browser, so the ideas below are borrowed parts, not a change of direction.

| # | Work | From | State |
|---|---|---|---|
| 1 | Hold still: a pause that sharpens the picture | GMT | built; architecture doc, section 8b |
| 2 | More like this, less like this | Electric Sheep | built; architecture doc, section 11, Likes. Mixing liked items into new ones is still open |
| 3 | A picture that opens as the scene | GMT | built; architecture doc, section 11, Packs |
| 4 | The gallery: journeys and packs from other people, through GitHub | GMT, Electric Sheep | built, not yet tried on GitHub; see below |
| 5 | Motions driven by a slow wave or by the sound | GMT, Synesthesia | built; architecture doc, section 8, Drivers |
| 6 | Recording a flight as a video | Fractal Garden, MandelCraft | first step built (real-time recording, with the app's own sound); architecture doc, section 8c. Replaying a stored path at full sharpness is still open |
| 7 | Hybrid worlds | GMT | two built, in `packs/hybrids.json`; see below |
| 8 | Comfort in the VR viewer | Plane9 | built; architecture doc, section 13, VR viewer |
| 9 | A light to throw | Marble Marcher | built; architecture doc, section 5, The thrown light. It is a toy so far: nothing is scored |
| 10 | Knobs: a MIDI controller | Synesthesia | built, never tried with a controller; architecture doc, section 13 |

## 1. Hold still

**For.** Box and Fortress are grainy, and every world speckles a little at fine detail (architecture doc, section 15). A picture worth keeping needs a clean frame.

**How.** A **Hold still** switch stops everything that moves by itself: the clocks, the morph, the drift, Journey. Looking and flying by hand still work. Whenever the camera is not moving, each frame draws the world with its rays shifted by a different fraction of a pixel and averages it into a kept picture, so the grain goes within about a second. The effects after the scene (trails, glow, filter) keep working on the averaged picture, and the glow still follows the music.

**Rules it must keep.** The average is of the scene before the effects, so it adds no time input to any filter. Nothing about it is centred on the screen, so it stays on in the VR viewer.

## 2. More like this, less like this

**For.** Journey picks evenly from what a template allows. People have favourites.

**How.** Two buttons beside the journey template. **More like this** raises the weight of everything Journey chose that is showing now. **Less like this** lowers the weight of the last thing Journey changed and changes it again at once. Weights are kept in this browser only, between a fifth and four times the even chance, so nothing is ever shut out. The setup panel can forget them.

**Later.** Use the liked combinations as parents: make a new motion or palette by mixing two liked ones (through the cleaners, so the result is something a pack could hold).

## 3. A picture that opens as the scene

**For.** Share spot gives a link. A picture is what people actually pass around, and a link cannot carry a palette or filter the other person does not have.

**How.** **Save picture** writes the frame as a PNG with a small pack inside it (a `tEXt` chunk named `mirrorfold`): the place, and whatever of the look is not built in. Loading that PNG where a pack file is loaded, or dropping it on the page, adds those items and goes to the place. This is also the "save the current look" idea from the architecture doc: a pack may now carry a `scene`.

**Rules it must keep.** What is read from a picture goes through `loadPack` and the cleaners like any pack, is never marked reviewed, and names nothing that is used as a URL or as HTML. Many sites strip this data when a picture is uploaded; the picture is then only a picture.

## 4. The gallery

**For.** Journeys and packs made by other people, findable from inside the app, without a server.

**How.** GitHub is the server.

- **Reading.** The gallery is the `packs/` folder of the repository, served by Pages with the app. `packs/index.json` lists each pack with its name, author, a sentence about it and what is inside. It is written by `tools/gallery.mjs` from the pack files, and the check workflow fails if it is out of date. The setup panel shows the list as cards with **Add** on each.
- **Offering.** The setup panel lists what the user has made, and the scene showing now, each with a tick box. **Offer what is ticked** opens a new issue on the repository with a pack of only those things filled in, and whatever of the user's own they use (an issue form, `.github/ISSUE_TEMPLATE/pack.yml`). A workflow (`.github/workflows/offer.yml`) runs `tools/offer.mjs` on it: the same cleaners the app uses. A pack that passes becomes a pull request that adds one file and the index line; one that does not gets a comment saying why.
- **Review.** Merging is the review. Only packs in the page's own folder are marked reviewed, as now, so a person has looked at any code before it runs without the flash limiter.

**Still open.**

- The workflow has never run. It needs a `pack` label and the setting that lets Actions open pull requests (`packs/README.md`, For maintainers).
- What came from the gallery is known by kind and name only (`fromGal`). Something loaded from another person's pack file is not known to be theirs: the form's own tick box ("I made this") is the only guard.
- The gallery has no pictures. A pack with a `scene` could show one, made by `tools/render.py` when the index is written.
- The pack's name, author and sentence are typed into the form on GitHub, not in the app.

**Rules it must keep.** The workflow treats the issue as data: it never puts issue text into a command, writes only the cleaned pack under a file name it makes itself, and has no secrets beyond the token GitHub gives it.

## 5. Motions driven by a slow wave or by the sound

**For.** A motion is a fixed set of numbers. GMT and Synesthesia let any number be driven.

**How.** A motion may carry up to two drivers: which of its numbers, what drives it (a slow wave, the bass, the mids or the treble), how far, and for the wave how many seconds a cycle takes (8 at the quickest). The driven number is held inside the same range the cleaner allows, so a driven motion cannot do anything a plain one could not. The motion editor gets the controls. Filters are left out: a filter number that follows the beat (Negative, for one) would flash.

## 6. Recording a flight as a video

**For.** Showing someone what it looks like in motion.

**How, first step.** **Record video** captures the canvas as it plays with the browser's own recorder and saves the file when stopped. Picture only.

**Later.** Store the camera's path and replay it frame by frame at full sharpness, so a phone can make a clean video slower than real time. Sound from the built-in music.

## 7. Hybrid worlds

**For.** New kinds of space from the folds that are already here.

**How.** GMT alternates two formulas inside one iteration loop. Here that is a pack world, which needs no JavaScript `de`, so a hybrid is content and not engine work. `packs/hybrids.json`, in the gallery, has two: **Tetra bulbs** (Sierpinski tetrahedron folds, each followed by a sphere fold) and **Kleinian cage** (the Apollonian inversion of Lattice with an octahedral sort before it).

**Still open.** A box fold with a Menger step was tried three ways and gave either flat grainy walls or a blur, so it is not in the pack. Each of the two was looked at in stills and one short flight in headless Chrome only: how well the autopilot flies them, and their frame rate on a phone (five or six fold steps on every ray step, through the probe), are untested.

## 8. Comfort in the VR viewer

**For.** Plane9 marks the scenes that work in a headset. Here the cloud worlds have no depth for two eyes, and the autopilot turns as fast as on a flat screen.

**How.** The cloud worlds (`volume: true`: Nebula, Aurora) are the ones two eyes see nothing more in than one. While the VR viewer is on, Journey leaves them out unless they are all a template allows, and the autopilot turns at half speed. Chosen by reasoning, not on a device: no one has yet looked through a viewer to say which worlds are comfortable.

## 9. A light to throw

**For.** Something to do in a world besides look for the orb, using the distance estimator the way Marble Marcher does.

**How.** **Throw a light** sends a small glowing ball forward. It flies straight, bounces off the surfaces (the surface's direction comes from `de`), slows a little at each bounce and fades after about twenty seconds. Not in pack worlds, which have no `de` to ask every frame.

## 10. Knobs

**For.** People who perform with it.

**How.** Where the browser has Web MIDI, the first four knobs turned set speed, overlay strength and the look across and up; pads change world, palette, motion and filter.

**Still open.** It has only been fed made-up messages. A way to choose what each knob does, and to remember it, would follow once someone has used it with a real controller.

## Left out on purpose

- **MilkDrop `.milk` presets.** They are programs. Packs never carry JavaScript, and a per-pixel equation system would be a second language to keep safe.
- **Multiplayer, and a gallery with its own server.** Both need something running that is not a folder of files.
