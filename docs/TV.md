# Mirrorfold on a TV

Mirrorfold is a web page. Roku, Apple TV and most other TV boxes have no web browser that can run it, and there is no Mirrorfold app or channel for any of them. The way to get it onto a TV is **screen mirroring**: your phone, tablet or computer runs Mirrorfold and sends a copy of its screen, with sound, to the TV.

These steps come from each maker's documentation. They have not been tried by the author on real devices, and menu names change between software versions. If a step is wrong for your device, please open an issue.

## Which phone works with which TV box

| TV device | iPhone or iPad | Android phone | Computer |
|---|---|---|---|
| Apple TV | Yes, AirPlay | No | Mac: yes, AirPlay |
| Roku | Yes, AirPlay, on most recent models | Yes, screen mirroring, except Google Pixel phones | Windows: yes. Mac: yes, AirPlay |
| Chromecast or Google TV | No | Yes, Cast | Yes, from the Chrome browser |
| Amazon Fire TV | Only on Fire TV models that list AirPlay | On Fire TV models that list display mirroring; not Google Pixel phones | Windows: on the same models |
| Smart TV with AirPlay built in (many Samsung, LG, Sony and Vizio sets from 2019 on) | Yes, AirPlay | Depends on the TV | Mac: yes, AirPlay |
| Any TV with an HDMI socket | With an HDMI adapter | With an HDMI adapter, if the phone supports video out | Yes, with an HDMI cable |

AirPlay is Apple's system and only Apple devices can send with it. Android phones use one of two other systems: **Cast**, which works with Chromecast and Google TV, and **Miracast**, which works with Roku and some Fire TV devices. Google Pixel phones support Cast only.

## Before you start

1. **Use the same Wi-Fi.** Put the phone and the TV device on the same Wi-Fi network.
2. **Stop the phone from locking.** Mirroring ends when the phone's screen locks. Mirrorfold only keeps the screen awake in VR viewer mode, so change the phone's setting while you watch:
   - iPhone or iPad: Settings → Display & Brightness → Auto-Lock → Never.
   - Android: Settings → Display → Screen timeout, and choose the longest time.

   Set it back afterwards.
3. **Allow the screen to rotate.** Turn off the rotation lock, so the picture can turn sideways and fill the TV.
4. **Plug the phone in.** Drawing the worlds and mirroring at the same time uses a lot of battery.

## Set up Mirrorfold

1. Open https://gcrabtree.github.io/MirrorFold/ on the phone. On an iPhone, opening it from a home-screen icon gives a fuller picture, because Safari's bars are not mirrored. See "Full screen" in the [README](../README.md#full-screen).
2. Choose **Enter with music** or **Enter silent**.
3. Turn on **Journey**, so Mirrorfold flies and changes by itself. Leave **VR viewer** off.
4. Start mirroring, using the steps for your devices below.
5. Turn the phone sideways.

The controls fade from the screen, and from the TV, after five seconds. Tap the phone to bring them back.

## From an iPhone or iPad

### To an Apple TV

1. Open Control Center: swipe down from the top right corner of the screen. On an iPhone with a Home button, swipe up from the bottom edge.
2. Tap **Screen Mirroring**. The button shows two overlapping rectangles.
3. Choose your Apple TV.
4. If a code appears on the TV, type it into the phone.

To stop: open Control Center, tap **Screen Mirroring**, then **Stop Mirroring**.

### To a Roku

Most Roku players and Roku TVs sold since about 2019 support AirPlay.

1. On the Roku, open Settings → **Apple AirPlay and HomeKit** and check that AirPlay is on. If that menu is missing, update the Roku in Settings → System → Software update. If it is still missing, this Roku does not support AirPlay.
2. On the phone, open Control Center and tap **Screen Mirroring**.
3. Choose your Roku.
4. Type in the code shown on the TV.

### To a smart TV with AirPlay

If your TV lists AirPlay in its settings, follow the Apple TV steps and choose the TV by name.

### To an Amazon Fire TV

Some Fire TV televisions and a few Fire TV players support AirPlay. Most Fire TV sticks do not. On the Fire TV, look in Settings → Display & Sounds for **AirPlay & HomeKit**. If it is there, turn it on and follow the Apple TV steps.

### To a Chromecast or Google TV

An iPhone cannot mirror its screen to these without an app from another company. Use a computer with the Chrome browser instead; see [From a computer](#from-a-computer).

## From an Android phone

The mirroring button is in Quick Settings: swipe down from the top of the screen, twice if needed. Its name depends on who made the phone:

| Phone | Button name |
|---|---|
| Samsung | Smart View |
| Google Pixel | Screen Cast (Chromecast and Google TV only) |
| OnePlus, Motorola, Xiaomi and others | Cast, Screen Cast or Wireless display |

If the button is not there, edit the Quick Settings panel to add it, or search the phone's Settings for "cast".

### To a Roku

Not possible from a Google Pixel phone.

1. On the Roku, open Settings → System → **Screen mirroring** and set the mode to **Prompt** or **Always allow**.
2. On the phone, tap the mirroring button.
3. Choose your Roku.
4. If the TV asks, choose **Allow**.

### To a Chromecast or Google TV

1. On the phone, tap **Screen Cast**. Or open the Google Home app, choose the TV device, and tap **Cast my screen**.
2. Choose your Chromecast or Google TV.

### To an Amazon Fire TV

Not possible from a Google Pixel phone, and not every Fire TV model supports it.

1. On the Fire TV, hold the Home button on the remote and choose **Mirroring**. If that choice is missing, look in Settings → Display & Sounds → **Enable Display Mirroring**. If neither is there, this Fire TV does not support it.
2. On the phone, tap the mirroring button and choose the Fire TV.

### To an Apple TV

Android phones cannot send to an Apple TV without an app from another company.

## From a computer

A computer usually gives the sharpest and smoothest picture, because it has more graphics power than a phone. Open https://gcrabtree.github.io/MirrorFold/, press **Fullscreen**, turn on **Journey**, then:

- **Mac to an Apple TV, a Roku or an AirPlay TV:** open Control Center in the menu bar, click **Screen Mirroring**, and choose the device.
- **Windows to a Roku or a Fire TV:** press the Windows key and K, and choose the device. Turn on screen mirroring on the TV device first, as in the Android steps.
- **Chrome browser to a Chromecast or Google TV:** open the menu with three dots, choose **Cast, save and share** → **Cast**, and choose the device. In the **Sources** list choose **Cast tab**.
- **HDMI cable:** connect the computer to the TV and choose that HDMI input on the TV. This needs no Wi-Fi and has no delay.

## Sound

Mirroring sends the phone's sound to the TV along with the picture.

- **Built-in music** and **My audio file** play through the TV, and the picture reacts to them.
- **Music from another app** (Apple Music, Spotify and so on) also plays through the TV, but Mirrorfold cannot hear it. Set Music to **Tap tempo** and tap the beat. The TV picture runs a moment behind the phone, so tap along with what you hear, not what you see.

## If something goes wrong

| Problem | What to try |
|---|---|
| The TV device is not in the list | Check that both are on the same Wi-Fi network. Some guest networks stop devices from seeing each other. Restart the TV device. |
| The picture is upright with black bars at the sides | Turn the phone sideways, and check that the rotation lock is off. |
| There are thin black bars even when sideways | A phone screen is longer and narrower than a TV screen. This is normal. |
| The picture stutters | Press **Detail** until it says **Detail fast**, or set **FX** to **clean**. Move the phone closer to the Wi-Fi router. Bulbs, Julia, Box and Fortress are the heaviest worlds. |
| The picture stops after a few minutes | The phone locked. See step 2 of [Before you start](#before-you-start). |
| There is no sound from the TV | Turn up the volume on the phone as well as the TV. On an iPhone, check the silent switch. |
| The TV shows two pictures side by side | **VR viewer** is on. Tap the phone and press **VR viewer** to turn it off. |

## Why there is no Roku channel or Apple TV app

Mirrorfold computes every pixel with small programs that run on the graphics chip, through a browser feature called WebGL.

- **Roku** has no web browser, and Roku channels cannot run programs on the graphics chip. A Roku channel could only play recorded videos of Mirrorfold, without flying, controls or reaction to your music.
- **Apple TV** has no web browser either. Its apps can use the graphics chip, so an Apple TV app is possible, but it would be a separate program written from the start, not this web page.
