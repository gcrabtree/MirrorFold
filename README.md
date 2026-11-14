# Mirrorfold

> [!WARNING]
> **Photosensitivity, seizure and motion warning. Please read before use.**
>
> Mirrorfold shows constantly changing colour, moving patterns, pulsing light and fast simulated motion. A small number of people have seizures, blackouts or other reactions when they see visuals like these, **even if they have never had a seizure before**.
>
> - **Do not use Mirrorfold** if you or anyone watching has epilepsy, has ever had a seizure, or is sensitive to flashing light, patterns or motion, unless a doctor has said it is safe.
> - **Stop at once and look away** if you notice dizziness, blurred or altered vision, eye or muscle twitching, confusion, disorientation, nausea, headache, or any involuntary movement. Get medical help if it does not pass.
> - Simulated flight can cause motion sickness. The VR viewer makes this more likely. Use it seated, and take breaks.
> - To lower the risk: use it in a well-lit room, sit back from the screen, prefer a smaller screen, keep sessions short, and do not use it when tired. Turning on your device's "reduce motion" setting makes Mirrorfold calmer.
> - Video, audio and packs that you load yourself are outside the project's control and can add flashing or intense motion of their own.
>
> Mirrorfold is designed to avoid strobing, but it has **not** been tested or certified against any photosensitivity standard, and no setting makes it safe for everyone. It is not a medical device and nothing here is medical advice. It is provided "as is", without warranty of any kind, and you use it entirely at your own risk; see the [licence](LICENSE).

Fly through endless fractal worlds in your browser. Twenty worlds, kaleidoscope mirrors, feedback trails, filters, overlays, and an autopilot that reacts to music.

This project is inspired in part by the music visualizers from decades past… from Winamp plugins to the standalone visualizer MilkDrop. This has a familiar feel when in Journey mode (an autopilot that flies through the procedurally generated 3D worlds) while listening to music. 

However, this is much more. Flying through fractal 3D landscapes, unlocking features by flying through Orbs, and tweaking so many settings is a relaxing and beautiful time sink, whether on your phone or PC. 

Support for Google Cardboard like VR is also in development (very early stage) and full VR support for true VR headsets is on the way. 

You can Cast or AirPlay your mobile device to your TV as well. 

This is under active development so don’t be surprised if things change from underneath you when I get a hankering for new features. 

Report bugs and discuss features and whatnot in GitHub issues. I’ll try to address them in a timely fashion but this is a small creative side project that itches a scratch for me and I just thought I’d share it with the world. 

Relax, unwind, and enjoy!

**Try it: https://gcrabtree.github.io/MirrorFold/**

![Contact sheet of all 20 worlds](docs/worlds.jpg)

The app is one page, one stylesheet and a folder of JavaScript modules. There is no build step and no JavaScript dependency. It uses WebGL 1, so it runs in any current browser on a phone or a desktop.

## Contents

- [What it does](#what-it-does)
- [Run it](#run-it)
- [Controls](#controls)
- [The buttons](#the-buttons)
- [The land](#the-land)
- [On a TV](#on-a-tv)
- [VR viewer](#vr-viewer)
- [Music](#music)
- [Journey](#journey)
- [The zoom worlds](#the-zoom-worlds)
- [Orbs and share links](#orbs-and-share-links)
- [Performance](#performance)
- [Motion and privacy](#motion-and-privacy)
- [How it works](#how-it-works)
- [Developing](#developing)
- [What has not been tested](#what-has-not-been-tested)
- [Licence](#licence)

## What it does

- **20 worlds.** Sixteen are solid fractal surfaces; two (Nebula and Aurora) are glowing volumes; two (Mandelbrot zoom and Julia zoom) are flat pictures seen from above that zoom in and out. Every world you fly through repeats forever in all directions.
- **Zooms a trillion times deep.** The two zoom worlds magnify the Mandelbrot set and Julia sets up to about a trillion times, on points where there is always something to see. See [The zoom worlds](#the-zoom-worlds).
- **Free flight** in any direction, with roll. Your speed drops as you approach a surface, so you can never hit a wall.
- **Morph.** Each world slowly changes shape as you fly.
- **Kaleidoscope mirrors**: off, or 3, 4, 6, 8 or 12 segments.
- **13 colour palettes.** Seven are available from the start. Six are unlocked by finding orbs.
- **6 feedback motions, 17 filters, 7 overlays and 8 transitions**, in the style of the MilkDrop music visualiser.
- **Music reactivity** from a built-in track, your own audio file, another browser tab such as Spotify or YouTube, the microphone, or a tapped tempo.
- **Journey**, an autopilot that flies for you and changes the world, palette, mirrors, motion, filter, overlay and land over time. You control what it may change with templates.
- **Share spot** links that take someone to the exact place you are looking at.
- **Hold still**, a pause that sharpens the picture, **Save picture**, which saves a picture that opens again as the scene it shows, and **Record video**.
- **A gallery** of journeys and packs that people have shared, and a way to offer your own.
- **A light to throw**, which bounces off the surfaces of the world.
- **VR viewer** mode for a phone in a Cardboard-style holder: a picture for each eye, and you look around by turning your head.

The worlds, in menu order: Lattice, Sponge, Halls, Box, Citadel, Coral, Bulbs, Shards, Crystal, Julia, Web, Temple, Nebula, Fortress, Hive, Gates, Aurora, Mandelbrot, Mandelbrot zoom, Julia zoom.

## Run it

**Online:** open https://gcrabtree.github.io/MirrorFold/.

**From a copy of this repository:** run `python3 -m http.server` in the folder and open `http://localhost:8000`. Opening `index.html` straight from the file system no longer works, because browsers do not load JavaScript modules that way.

**From a local web server:**

```
python3 -m http.server 8000
```

Then open http://localhost:8000/.

**Host your own copy:** put `index.html`, `css/` and `js/` (and `packs/` if you want the starter pack offered) on any static web host. For GitHub Pages, keep them at the root of the published branch and keep the empty `.nojekyll` file, which stops Pages from running Jekyll over the repository.

On the start card, choose **Enter with music** or **Enter silent**.

### Full screen

On a desktop, Android or iPad, press the **Fullscreen** button.

Safari on iPhone does not let a web page go full screen, so the button is hidden there. Instead, add Mirrorfold to your home screen: open the site in Safari, press the Share button, then **Add to Home Screen**. Opening it from the new icon runs it without Safari's bars. The home-screen copy keeps its own saved templates and orb progress, separate from Safari's; save a pack file from the Library to move templates across.

## Controls

### Phone or tablet

| Action | Gesture |
|---|---|
| Move | Left thumb, anywhere in the left 45% of the screen. A ring appears under your thumb. |
| Look | Right thumb, anywhere else. |
| Change speed | Two fingers on the right side, pinch. |
| Roll | Two fingers on the right side, twist. |
| Burst of speed | Double-tap on the right side. |

### Mouse and keyboard

Click the picture to capture the mouse. Where the browser does not allow that, drag to look.

| Action | Key |
|---|---|
| Fly | `W` `A` `S` `D` |
| Up, down | `Space`, `Shift` |
| Roll | `Q`, `E` |
| Look | Mouse, or arrow keys |
| Change speed | Mouse wheel |
| Burst of speed | `B`, or double-click |
| Next or previous world | `]`, `[` |
| Jump to one of the first nine worlds | `1` to `9` |
| Next palette | `P` |
| Next mirror setting | `M` |
| Journey on or off | `J` |
| Tap tempo | `T` |
| Hold still | `H` |
| Throw a light | `G` |

The controls at the top of the screen fade after five seconds without input and come back on any touch or click.

## The buttons

The controls fade after five seconds and come back when you touch the picture.

**First row:** World, Palette and Music.

**Second row:** three buttons, then four that each open a group of controls under the row. One group is open at a time; pressing its button again closes it, and it closes when the controls fade.

| Button | What it does |
|---|---|
| Journey | Turns the autopilot on or off. |
| Hold still | Stops everything that moves by itself: the clocks, the breathing of the world, the drift and Journey. You can still look and fly by hand. Whenever you are not moving, the picture sharpens over about a second, because each frame looks through a different part of every pixel and the frames are averaged. Key **H**. Turning Journey on lets go. |
| Throw a light | Sends a small glowing ball ahead of you. It flies straight, bounces off the surfaces, loses a fifth of its speed at each bounce and shrinks away after twenty seconds. Throwing again takes it back. Not in the two cloud worlds, in a world from a pack, or with the land alone. Key **G**. |

**Look**

| Control | What it does |
|---|---|
| Feedback motion | none, Melt, Vortex, Tunnel, Implode, Ripple, Drift. Each one smears the previous frame in a different way. |
| Filter | none, Echo, Neon, Solar, Negative, Poster, Mosaic, Liquid, Prism, Quad, Tiles, Bulge, Twirl, Thermal, CRT, Halftone, Contour, Noir, Comic, Two-tone, Tape, Streaks, Emboss, Glass. The last six were made with video in mind. |
| Overlay | none, Ring, Scope, Spectrum, Spokes, Rings, Spiral, Orbit. These draw the sound on top of the picture. |
| Overlay strength | 15%, 30%, 50%, 75% or 100%. |
| Mirrors | Steps through off, 3, 4, 6, 8 and 12 segments. |
| FX | Steps through glow, trails and clean. Sets the base amount of trail and bloom. |
| Morph | Turns the slow change of each world's shape on or off. |
| Drift | Turns the slow forward drift on or off when you are not steering. The drift nearly stops while you turn the view, and picks up again when you stop. |

**Land and video**

| Button | What it does |
|---|---|
| Land | Steps through **Land off**, **Land alone** and **Land over world**. See [The land](#the-land). |
| Land is | Shown while the land is on. Steps through the landscapes: **the Alps**, **canyon country**, **a strange planet**, **a steel ball** and **a city**. |
| Land colours | Shown while the land is on. **Land colours natural**, **Palette on sky and light**, or **Palette on everything**. |
| Effects on | Shown for **Land over world**. Whether motions, filters and overlays act on **everything**, **the sky** (the world behind) or **the land**. |
| Video off / on | An experiment. Opens a row of controls for showing a video in the picture: choose a video file from this device or use the camera, pick where it shows (on the surfaces, through the shapes, in the distance, in the overlay, as the colours, or filling the screen with no world at all, where the mirrors, motions, filters and overlays all work on the video and the land can stand in front), how strongly, and pause it. **Video sound off / on** chooses whether the video's own sound is the music. Off, the video plays silently while whatever is chosen under Music carries on (useful for ambient footage); on, the picture pulses to the video's sound. When a file is chosen and Music is off, the video's sound is turned on for you. The video is never uploaded, and is slowed where needed so that it cannot make the screen flash. Pressing the button again turns the video off. |

**Save and share**

| Button | What it does |
|---|---|
| Save picture | Saves the picture as a PNG file. The file also holds the place and the look, so loading it in Mirrorfold (**Gallery and library**, **Load a pack file or a saved picture**, or drop it on the page) comes back to the same scene, with any palette, motion, filter, overlay or world of your own that it uses. Many websites remove that part when a picture is uploaded; the picture is then only a picture. Use **Hold still** first for a clean frame. |
| Record video | Records the picture as it plays, and saves it as a video file when you press the button again. The controls are not in the video. The sound is recorded when Mirrorfold itself is playing it (the built-in music, your audio file, your video's sound), and not when it is only listening (a tab, the microphone, tap tempo). It stops itself after five minutes. The video is as sharp and as smooth as the picture on your screen, no better. The button is missing in browsers that cannot record. |
| Share spot | Makes a link to where you are. |
| Gallery and library | Opens the setup panel at the gallery. See [Library and packs](#library-and-packs). |

**More**

| Button | What it does |
|---|---|
| Orbs | Shows or hides the orbs. |
| Detail | Steps through auto, sharp and fast. See [Performance](#performance). |
| Stats | Shows a readout in the top left corner: pictures drawn each second and the slowest one, how long the page's own script takes for each picture, the sharpness and size of the picture, the name of the graphics chip drawing it, and a trial of the distance probe (how long the page waits for the chip to answer one question, and the chip's answer beside the script's). Useful when the picture stutters. |
| Fullscreen | Fills the screen. |
| VR viewer | Phones and tablets only. Draws a picture for each eye, for a phone in a viewer. See [VR viewer](#vr-viewer). |
| Knobs | For a MIDI controller, in browsers that have Web MIDI (Chrome and Edge; the button is missing elsewhere). The browser asks for permission. The first four knobs you turn are given, in order: speed, overlay strength, look left and right, look up and down. A look knob turns the view steadily while it is away from its middle. Pads and keys change the world, palette, motion or filter, by turn. Nothing is sent to the controller. |
| Help and source | Opens this page on GitHub in a new tab. |

## The land

The land is an endless landscape you fly over. **Land is** chooses which one:

- **The Alps**: snow peaks, glaciers, waterfalls and streams, lakes, meadows and conifer forest. From far off a forest is a dark patch. Close up it becomes separate trees, and meadows gain bushes and boulders.
- **Canyon country**: a plateau of banded red rock cut by stepped gorges with a river at the bottom, with mesas and buttes standing on the plain, and rock arches and balanced rocks. You can fly under the arches.
- **A strange planet**: sharp peaks over rippled plains, veins of light in the ground, glowing pools, glowing horns and bulbs, and crystals, rings and slabs that float and turn slowly in the air. Land alone gives it a dark sky with stars and a ringed planet.
- **A steel ball**: one huge polished ball that mirrors the sky. The horizon curves away on every side, more so the higher you fly. Over a world it mirrors the world.
- **A city**: square blocks of buildings with roads, pavements, parks and parked cars. Glass buildings mirror the sky, or the world. You fly along the streets or above the roofs, and are pushed round a building if you fly into one. This and the steel ball are much lighter to draw than the other three.

Each landscape can be shown two ways:

- **Land alone** shows the land under its own sky. No world is drawn.
- **Land over world** shows the land with the current world as the sky. Water mirrors the world, and far land thins into it. The world is only drawn where the land leaves it showing.

You fly over the land the same way as through a world: the stick, **W A S D**, **Drift** and **Journey** all move you forward the way you face, and the land keeps you clear of the ground. **Space** and **Shift** raise and lower how high you fly. With Journey movement set to travel, the autopilot follows the valleys. The horizon is kept level. You are pushed gently aside if you fly into an arch or a floating shape.

**Land colours** decides what the palette does: nothing, tint the sky, sun and haze, or recolour the land and water as well. Mirrors apply to the land. **Effects on** decides what the motion, filter and overlay act on when the land is over a world.

The land is the heaviest thing Mirrorfold draws: about three times the work of a world. With **Detail auto**, when the pictures come too slowly the sharpness drops to 60% first, then the land alone is drawn smaller (70%, then 50% of the picture's size) and spread out, so the land goes soft while the world behind stays as sharp as it was, and only then does the whole picture go on down to 35%. **Detail fast** draws the land at 70%. **Stats** shows the land's size when it is reduced. It is switched off in the VR viewer.

Journey templates have a **Land** entry: leave the land as you set it, keep it off, or change it at random among the landscapes you tick, each alone or over the world. The built-in template **Landscapes** does this.

## On a TV

Roku, Apple TV and other TV boxes cannot run Mirrorfold themselves, and there is no app or channel for them. You can still watch it on a TV by mirroring the screen of a phone, tablet or computer: AirPlay from an iPhone, iPad or Mac, and Cast or screen mirroring from Android.

[`docs/TV.md`](docs/TV.md) has step-by-step instructions for Apple TV, Roku, Chromecast, Google TV, Fire TV and smart TVs, a table of which phone works with which device, and fixes for common problems.

## VR viewer

This mode is for a phone in a Cardboard-style viewer: a holder with two lenses that you look into. It has not been tried on a real phone or viewer yet, so treat it as experimental.

1. Open Mirrorfold on the phone. On iPhone, open it from the home-screen icon so Safari's bars are out of the way (see [Full screen](#full-screen)).
2. Choose what you want first: world, palette, music, and Journey or Drift.
3. Press **VR viewer**. On iPhone, allow motion access when asked.
4. Turn the phone sideways and put it in the viewer.

Turning your head turns the view. With **Drift** on you glide toward wherever you look, and the glide nearly stops while your head is turning. With **Journey** on and **Movement travel**, the autopilot also steers, and it stops steering while your head is turning. With **Movement drift**, Journey changes the worlds and leaves all the turning to you. Touch still works: tap the screen to bring the controls back, and press **VR viewer** again to leave. The screen is kept awake while the mode is on, where the browser allows it.

While the mode is on:

- Feedback motions, trails and overlays are not drawn. They are centred on the screen, not on each eye.
- These filters are not drawn, for the same reason: Echo, Mosaic, Liquid, Prism, Quad, Tiles, Bulge, Twirl. The others work.
- Changes of world always use the blink transition.
- The slow automatic roll is off.
- Mirrors work, and both eyes see the same mirrored scene.

The picture is shaped for the lenses of a Google Cardboard viewer (lenses 64 mm apart, 39 mm from the screen). A browser cannot find out how big the screen is, so the size is estimated. If the two pictures do not merge into one, or the world looks stretched, please open an issue and say which phone and viewer you used.

If moving through the world makes you feel unwell, stop. **Movement drift** is gentler than travel, because then the view only turns when your head does.

## Music

Three bands of the sound drive different parts of the picture. Bass drives zoom kicks, bloom and flight speed. Mids drive the morph speed, rotation and the bands on surfaces. Treble drives highlights, colour fringing and how fast the colours drift.

| Setting | What it does |
|---|---|
| Built-in music | A dance track at 126 beats per minute, made up in the browser as it plays, not a recording: kick, pumping bass, claps, hats, chords, an arpeggio and a tune, moving through intro, build, drop and breakdown. After 72 bars it starts a new song in another key. |
| My audio file | Plays a file you choose, with pause and a scrubber. Files longer than 15 minutes or larger than 80 MB are streamed instead of loaded whole. |
| Tap tempo | Makes no sound. Use it when music is playing in another app, such as Apple Music or Spotify: enter silent, start your song there, choose Tap tempo and tap the beat. |
| Listen to a tab | Reacts to the sound of another browser tab, such as Spotify's web player or YouTube. Chrome and Edge on a computer only. |
| Microphone | Reacts to whatever the microphone hears in the room. |
| Music off | The worlds still move, without reacting to sound. |

### Music from Spotify, YouTube or another tab

This works in Chrome and Edge on a computer. Other browsers do not show the option.

1. Start the music in another tab of the same browser.
2. In Mirrorfold, set Music to **Listen to a tab**.
3. The browser asks what to share. Choose the tab with the music, and turn on **Also share tab audio**.

The music keeps playing from its own tab, and Mirrorfold only listens. To stop, change the Music setting or press the browser's **Stop sharing** button. The browser asks again each time.

The source has to be a browser tab, so use Spotify's web player, not the Spotify app. On Windows you can choose **Entire screen** with system audio to hear any app. It has been tested with a simulated share only; if Spotify's web player gives no reaction, please open an issue.

### Microphone

Set Music to **Microphone** and allow access when the browser asks. Mirrorfold reacts to what the microphone hears: speakers in the room, the Spotify app, an instrument. It works in any browser that has a microphone, but the signal is rougher than a shared tab and it also reacts to talking. On a phone, the browser may quieten or stop music playing from another app while the microphone is in use; if it does, use Tap tempo.

While listening to a tab or the microphone, Mirrorfold plays no sound of its own. The sound is analysed in your browser as it arrives. It is not recorded, stored or sent anywhere.

For music Mirrorfold cannot hear at all, use Tap tempo.

## Journey

Journey flies for you. It steers toward open space and changes things on separate clocks, so no two minutes are the same. While Journey is on, the screen is kept awake, where the browser allows it.

With Journey on, a **Movement** button appears beside the template list:

| Setting | What it does |
|---|---|
| Movement travel | Journey flies and steers for you. This is the default. |
| Movement drift | Journey only changes the scenery: world, palette, mirrors, motion, filter and overlay. It does not move or turn you. You fly yourself, and the **Drift** button decides whether you glide slowly forward when you are not steering. |

Two more buttons sit beside it. **More like this** makes Journey choose what is showing now more often. **Less like this** makes it choose the last thing it changed less often, and changes it again at once. Nothing is ever shut out: a disliked option still comes up now and then. Your likes are kept in this browser only; **Forget what I liked** in the journey setup panel clears them.

In both settings you can take over at any moment. While you turn the view, by dragging, with the arrow keys, or by turning your head in the VR viewer, the autopilot stops steering and the automatic forward motion nearly stops. About a second after you stop turning, it carries on from where you are looking. The choice of travel or drift is remembered in your browser.

A **template** says what Journey may change and how often. For each of world, palette, mirrors, motion, filter, overlay and land you choose whether it changes, how many seconds between changes, and which options are allowed. Worlds can also change when the music changes instead of on a clock.

A **set** plays several templates in turn, each for a number of minutes.

Built-in templates: Classic, Everything, Clean flight, MilkDrop, Kaleidoscope, Calm, Landscapes, Follow the music. Built-in set: Grand tour.

Turn Journey on and press **Edit journeys** to make your own. Built-in templates cannot be edited; use **Duplicate** to start from one. Your templates and sets are saved in your browser only. To keep a copy or move them to another device, save them as a pack; see [Library and packs](#library-and-packs).

## Library and packs

A **pack** is a small file of worlds, palettes, motions, filters, overlays, Journey templates and sets. Almost all of it is names and numbers, which Mirrorfold checks and pulls back into range. A world, filter or overlay also holds a short picture program for the graphics chip. The starter pack has two worlds, Column hall and Bead curtain. Such a program cannot reach the page, your files or the network, and Mirrorfold refuses it unless it keeps to a strict set of rules. Nothing in a pack is ever run as JavaScript.

Programs in packs published with Mirrorfold have been reviewed. A program you load from a file or paste as text has not, so while it is in use Mirrorfold shows the picture smoothed over time, which makes it impossible for it to flash the screen. The Library list marks those items.

Press **Gallery and library** to open that part of the setup panel. The **gallery** comes first: journeys and packs that people have shared, each with **Add**. They are files in this project's `packs` folder, so the list is missing when the page is opened straight from a file. Under **Offer to the gallery** is a list of what you have made or loaded yourself, and the scene showing now, each with a tick box. **Offer what is ticked** opens a form on GitHub with only those things in it; you need a GitHub account to send it. What you added from the gallery is someone else's and is not in the list. If a journey or the scene you tick uses a world, palette, motion, filter or overlay in the list, that goes with it, and the message says so. A check runs there, and a maintainer looks at the pack before it appears in the gallery. See [packs/README.md](packs/README.md).

The **library** is below it:

| Control | What it does |
|---|---|
| **Load a pack file or a saved picture** | Adds a pack from a file on your device. A picture saved with **Save picture** also works: it goes to the place in the picture. You can also drop either kind of file on the page. |
| **Save mine as a pack file** | Saves everything you have added or made as one pack file, to keep or to share. |
| **New palette**, **New motion**, **New filter** | Makes a copy of what is showing now and opens the editor on it. The motion editor also has two **drivers**: each can make one control move by itself, following a slow wave or the bass, middle notes or treble of the music. |
| **Edit** | Opens the editor on one added palette, motion or filter. |
| **Remove** | Removes one added item. |
| **Copy mine as text**, **Load from text** | The same as saving and loading a file, through the text box. |

Added palettes, motions, filters and overlays appear at the end of their lists and in the Journey template editor. They are saved in your browser only.

### Making your own

The editor is a sheet of controls along the bottom of the screen, or down the right side on a phone held sideways. The picture stays in view beside it and changes as you move a control, and every change is saved at once. Type a name, press **Help** to read what each control does, and press **Done** to close it.

| Editor | Controls |
|---|---|
| Palette | First colour and Second colour, which the palette runs between, then Colour changes, Slide and Rainbow. A strip shows the whole palette. **Fine tuning** opens Level, Range, Waves and Offset, each for red, green and blue. |
| Motion | Trail length, Zoom, Turn, Swirl, Wobble, Ripple, Slide sideways, Slide up or down, Beat push |
| Filter | Outlines, Brightness steps, Solarise, Negative, Echo, Mosaic blocks, Liquid, Colour turn, Colour fringing, Built-in effect |

Sliders stop at the same limits a pack is held to. Filter and overlay programs are written by hand; there is no editor for those.

Worlds cannot be put in a pack yet. The file format, the allowed ranges and how to offer a pack for inclusion are in [packs/README.md](packs/README.md).

## The zoom worlds

**Mandelbrot zoom** and **Julia zoom** are not spaces to fly through. Each is the flat set seen from above, and the controls move the view over it:

| To do this | Phone or tablet | Mouse and keyboard |
|---|---|---|
| Zoom in and out | Stick up and down | W and S |
| Slide the picture | Drag, or stick left and right | Move the mouse, arrow keys, A and D, Space and Shift |
| Turn the picture | Twist with two fingers | Q and E |
| Zoom faster or slower | Pinch | Mouse wheel |

Left alone with **Drift** on, the view zooms slowly in on its middle. With **Journey** on (and **Movement travel**), it takes a tour instead:

- **Mandelbrot zoom** goes to one of eight places on the edge of the set: the three-way branch, a seahorse's spiral, the long needle, an elephant's trunk, the sceptre, the top branch, the four-way spiral, and the small copy of the whole set that sits on the needle. It zooms in as far as the device allows, rests, backs out until the next place is in view, and goes there. Seven of the eight are points where the pattern repeats itself all the way down, so the tour can go on to about a trillion times.
- **Julia zoom** shows ten Julia sets in turn. For each it zooms in on a point where the set's arms meet (or, for some, on its tip), rests, backs out, and then the set changes smoothly into the next one.

How deep it goes depends on the device. A computer takes up to 1,024 steps for each pixel and a phone or tablet 384, so a phone stops sooner at the places that need many steps (the seahorse and the elephant most of all). Away from the tour's places you can zoom wherever you like, but a middle chosen by hand usually ends in plain colour or in the black inside of the set.

Mirrors, motions, filters, overlays, the land and **Hold still** all work on the zoom worlds. There is no orb in them and no light to throw, and Journey leaves them out in the VR viewer. **Share spot** keeps a place the tour has centred exactly; any other view comes back right only while it is magnified less than about a thousand times.

## Orbs and share links

Each world hides a glowing orb. Fly into it to collect it. The first six orbs each unlock a new palette. After that, collecting an orb takes you to another world. Progress is saved in your browser.

**Share spot** makes a link that records the world, palette, mirror setting, your position, the direction you are facing and the world's current shape. Opening the link puts the viewer in the same place. Roll is not recorded.

A link ending in `#` and a world id opens that world, for example https://gcrabtree.github.io/MirrorFold/#julia. The ids are the world names in lower case.

## Performance

Every pixel is computed by stepping a ray through a fractal, which is heavy work for a graphics chip. The **Detail** button trades sharpness for speed:

| Mode | Behaviour |
|---|---|
| auto | Starts at 85% resolution and adjusts between 60% and 100% to hold the frame rate. This is the default. With the land on it gives up more: see [The land](#the-land). |
| sharp | Full resolution, up to three device pixels per CSS pixel. |
| fast | Half resolution. |

Bulbs, Julia, Box and Fortress are the heaviest worlds. If the picture stutters, try **Detail fast** or **FX clean**. A video playing in another tab (for **Listen to a tab**) is decoded by the same graphics chip, and on a laptop's built-in chip that can take several times longer per picture than the same scene with the other tab paused. Turning that video's quality down, or playing sound only, gives the time back.

## Motion and privacy

**Motion.** Read the warning at the top of this page first. Colour and motion shift constantly. Pulses are designed to be soft and slow and the app is built not to strobe, but this has not been tested against any photosensitivity standard. A tapped tempo above about 165 beats per minute is halved. A video you load is slowed where needed so its brightness cannot change quickly. If your device is set to reduce motion, all reactions to sound are cut to a quarter and several motions are disabled.

**Privacy.** Mirrorfold makes no network requests of its own. The page loads two fonts from Google Fonts, and that is all. The VR viewer reads the phone's motion sensor to follow your head; the readings stay on the phone. **Listen to a tab** and **Microphone** only run when you choose them and the browser's permission prompt is accepted; the sound is analysed in the browser and never recorded or sent. An audio file you choose is read by your browser and is not uploaded. Templates, orb progress and the orbs setting are kept in your browser's local storage.

## How it works

Each frame draws five passes:

1. **Scene.** A fragment shader marches one ray per pixel through a distance estimator for the current world (sphere tracing). Mirrors fold the ray direction, so the kaleidoscope is a true view of a 3D scene and not a folded image.
2. **Feedback.** The previous frame is warped, faded and combined with the new one. This gives the trails and motions.
3. **Bloom.** A bright pass is blurred at quarter resolution.
4. **Final.** Filters, colour fringing, bloom and transitions are applied on the way to the screen.

Each world's distance estimator is written twice: once in GLSL for drawing, and once in JavaScript so the app can scale flight speed, steer the autopilot and place orbs. Every world is exactly periodic, and the camera position is wrapped by that period each frame to keep floating-point precision.

Sound goes through one Web Audio analyser. Three bands each keep a level and a soft pulse. A change detector compares short and long averages to decide when the music has changed enough to change world.

[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) covers all of this in detail: the render pipeline, the math of every world, the audio analysis, the journey engine, known weaknesses, ideas not yet built and a suggested split into modules.

## Developing

### Files

| Path | What it is |
|---|---|
| `index.html` | The page's markup |
| `css/app.css` | The styling |
| `js/` | The app, as about 35 modules; the architecture document lists what each holds |
| `docs/ARCHITECTURE.md` | How it works, in detail |
| `docs/TV.md` | How to show Mirrorfold on a TV by screen mirroring |
| `docs/worlds.jpg` | Contact sheet of all 20 worlds |
| `packs/` | Packs published with the site, the list of them (`index.json`) and the pack format (`README.md`) |
| `tools/unit.mjs` | Tests for the change detector, the weighted picker, the head-turn math, the steering handoff and the pack cleaners |
| `tools/pack.mjs` | Checks pack files with the same code the app uses |
| `tools/check.py` | Headless smoke test |
| `tools/probe.py` | Checks each world's two distance functions against each other |
| `tools/render.py` | Headless screenshots |
| `tools/harness.py` | Shared code for the Python tools |
| `CLAUDE.md` | Working notes for Claude Code sessions |
| `apple-touch-icon.png` | Icon used when the site is added to a phone's home screen |
| `.github/workflows/check.yml` | Runs the Node checks on every push and pull request |
| `.nojekyll` | Stops GitHub Pages from running Jekyll |

### Tests and tools

```
node tools/unit.mjs                     # pure-logic tests
node tools/pack.mjs                     # check every pack in packs/
```

GitHub runs `unit.mjs` and `pack.mjs` on every push and pull request (`.github/workflows/check.yml`). The browser tools below are run by hand:

```
python3 tools/check.py                  # all shaders compile, no script or WebGL errors
python3 tools/render.py --world julia -o out.png          # screenshot one world
python3 tools/render.py --all -o sheet.jpg                # contact sheet of every world
python3 tools/render.py --world temple --js "setLook(2)" -o neon.png
```

`unit.mjs` needs Node. The Python tools need `google-chrome` or `chromium` on your PATH; they run it headless with software WebGL. `--all` also needs Pillow.

### Rules that are easy to break

- A world's GLSL `map` and JavaScript `de` must compute the same distance. If they drift apart, the camera clips through walls or crawls in open space.
- A world's field must repeat exactly at its `period`, or the camera wrap shows as a jump.
- Journey templates store options by name. Renaming a world id, motion, filter, overlay or palette silently removes it from people's saved templates.
- Code that runs at start-up belongs in a file's `init()`, every value is set by one file only, and a frame is a list of steps in `js/loop.js`. The architecture document, section 3, explains each.
- After any shader change, run `check.py`, then render the affected world and look at it. Shaders can compile cleanly and still look wrong.

The code is ES modules, written in ES5 style inside each file: `var`, function declarations, no classes. Shaders are GLSL ES 1.00. The architecture document has a checklist for adding a world.

## What has not been tested

The app was developed against headless Chrome with software rendering. These have not been checked on a real device:

- Frame rate on phones.
- Multi-touch gestures. The twist direction may feel reversed.
- How the built-in music sounds, and how strong each reaction should be.
- The change detector on real songs.
- Seeking in files over 15 minutes on iOS.
- Whether iOS keeps another app's music playing in Tap tempo mode.
- Typing in the journey editor on iOS.
- The home-screen full-screen mode on iPhone, including whether the controls clear the notch.
- The screen mirroring steps in `docs/TV.md`, on any TV device.
- **The zoom worlds** on any real graphics chip. The 1,024-step loop that reads a picture of numbers has only been compiled and run by software rendering; how long a Windows machine takes to build that shader, the frame rate deep in a zoom, and whether a phone has the kind of picture it needs (without it the two worlds say so and are skipped) are all unknown. The controls for them have never been tried by hand.
- Everything added in November 2026 on anything but headless Chrome: **Hold still** (whether a phone keeps its frame rate while it sharpens), **Save picture** and **Record video** on a phone (a download link may open the file instead of saving it), the **gallery's** offer form and its GitHub workflow (never run), the two **hybrid worlds** in flight, the **VR comfort** rules in a viewer, and **Knobs** with a real MIDI controller (only made-up messages were tried).
- Whether the screen really stays awake with Journey or the VR viewer on, in Safari and from the home-screen icon.
- **Listen to a tab** with real Spotify and YouTube tabs, and **Microphone** with a real microphone. Both were tested with simulated devices only.
- The VR viewer mode: whether the two pictures merge in a real viewer, whether head turning goes the right way, and whether it is comfortable.

Known weak spots: Box and Fortress look grainy, and the controls cover a lot of a phone screen until they fade. Reports from real devices are welcome as issues.

## Licence

[MIT](LICENSE).
