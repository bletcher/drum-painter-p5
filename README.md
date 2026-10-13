# Drum Painter

Turn what you play on an electronic drum kit into paintings, in the browser.

Every hit becomes a mark on the canvas: its color and shape come from the drum, its size and opacity from how hard you hit. Play freely and get an abstract painting, or switch to **Timeline** and get a picture of your groove, with every hit placed exactly where it landed against the click and a graph of how early or late you were.

**Try it:** <https://bletcher.github.io/drum-painter-p5/>

## What you need

- An electronic drum kit, drum pad or any MIDI controller connected by USB (or a MIDI interface)
- A desktop browser with Web MIDI: **Chrome, Edge, Opera, or Firefox** (Firefox asks you to approve a small permission add-on the first time)
- Safari and iPhone/iPad browsers don't support MIDI. You can still try the app with **Keyboard pads** or the **Demo beat**.

No kit handy? Click **⌨️ Keyboard pads** and play with `A S D F G H J K L ;` (hold Shift for accents), or click **▶ Demo beat**.

## Getting started

1. Plug in your kit and open the app. Click **Connect**, then **Allow** when the browser asks about MIDI devices. If it was blocked, the app shows how to unblock it for your browser.
2. Hit a few drums. The default mapping follows the General MIDI drum map that most kits (Roland, Alesis, Yamaha, …) use, so many kits work immediately.
3. If a pad doesn't paint, click **🥁 Kit Setup**, then hit each drum when it's named. That's all the mapping there is.
4. Play. Press **S** to save the painting, **Space** to record a video, **Backspace** to start over (**Ctrl/⌘+Z** brings it back).

## Ways to paint

**Freeform** styles place marks loosely, for abstract pieces:

| Style | Looks like |
| --- | --- |
| Classic | Pointillism: dots scattered over the canvas |
| Gravity | Drips that fall and fade |
| Organic | Clusters that slowly wander |
| Dendritic | River-like branching networks |
| Lightning | Branching electric strikes |

**Timeline** layouts place marks by *when* you played:

| Layout | Looks like |
| --- | --- |
| Staff | A drum score: one line per drum, bars and beats on a grid |
| Spiral | One turn per bar, spiralling outward |
| Rings | A ring per drum, the bar goes round like a clock |
| Petals, Polygon | Flower and geometric variations |
| Fibonacci, Radial | Advance with every hit rather than with time |

Each drum's color, shape (circle, star, brush stroke, ink blot, splatter, …), size, opacity, rotation and how much velocity matters are set in **Customize Drums**. Blend modes, background color and a glow effect change the overall look.

## Practicing with the timeline

1. Choose **Timeline → Staff**, set the BPM, time signature and grid (quarters, eighths, triplets, sixteenths).
2. Turn on **Metronome** and **Timing Graph**, and optionally one or more **warm-up** bars before painting starts.
3. Press **Start** (or **P**) and play along.

Each hit lands on the staff at the moment you played it. The graph below shows each hit's distance from the nearest grid line in milliseconds (**+** late, **−** early), with per-drum averages and spread. **Auto Tempo** raises (or lowers) the tempo every few bars and reports your accuracy at each tempo.

**About timing accuracy:** the metronome is scheduled on the audio clock and hits are placed using the timestamp the browser gives each MIDI message, so neither depends on the screen's frame rate. Your kit and audio output still add some delay. Run **Offset → Calibrate…** once (play 16 clicks with any pad) and that delay is subtracted from every hit.

## Recording

- **Video:** **Space** or **Start Recording**. Videos are MP4 where the browser supports it (WebM otherwise) and exclude the on-screen controls. **Sync & Merge** adds an audio track (for example your kit's audio, recorded in a DAW) with an offset slider to line it up, all inside the browser.
- **DAW sync:** select a virtual MIDI port (e.g. loopMIDI) under Recording Options. Drum Painter sends a note when recording starts and stops, and can send MIDI Clock so the DAW follows its tempo.
- **Session data:** **Session Recording** saves every hit (time, drum, velocity) as JSON for your own analysis.

## Saving and sharing setups

Settings save automatically in your browser. **Projects** keep named setups. **Customize Drums → Export to File** saves everything to a JSON file that someone else can **Import**. Imported files are checked before use. [`presets/`](presets/) has an example kit setup.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| Space | Start/stop video recording |
| S | Save image |
| Backspace / Delete | Clear canvas |
| Ctrl/⌘+Z, Ctrl/⌘+Shift+Z | Undo, redo |
| P / C | Start or pause / clear the timeline |
| ← → | Switch Freeform / Timeline |
| ↑ ↓ | Previous / next style or layout |
| B | Cycle blend mode |
| 1–9 | Edit a drum |
| \` | Keyboard pads on/off |
| H / F | Hide controls / fullscreen |
| ? / U | Shortcuts / user guide |

## Troubleshooting

- **"MIDI isn't available":** use Chrome, Edge, Opera or Firefox on a computer, and open the app over `https://` (or `localhost`).
- **Kit connected but nothing paints:** check the MIDI status box at the top left. Its numbers change when the browser receives anything. If they change but nothing paints, run **Kit Setup**. If they don't change, check the kit's USB/MIDI settings and close other apps that might hold the port.
- **Timing graph shows everything consistently late:** run **Calibrate…** next to Offset. Avoid Bluetooth headphones for the click.
- **Slow on an older computer:** brush stroke, splatter and ink blot shapes cost the most, and so does the glow effect. Try circles.

## Development

See [BUILD.md](BUILD.md) for setup, project structure, how timing works, and deployment (GitHub Pages workflow included).

```bash
npm install
npm run dev
```

## License

[MIT](LICENSE)

Built with [p5.js](https://p5js.org/) and [FFmpeg.wasm](https://ffmpegwasm.netlify.app/).
