# Developing and deploying Drum Painter

## Setup

Requires Node.js 20 or newer.

```bash
npm install
npm run dev        # http://localhost:3000/drum-painter/ with hot reload
```

Useful scripts:

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run lint` | ESLint over the source |
| `npm test` | Unit tests (Vitest) for timing maths, settings validation, MIDI helpers |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run check` | Lint, test and build: what CI runs |

Web MIDI only works on `https://` or `localhost`, so test MIDI with the dev server or `npm run preview`, not by opening `index.html` from disk.

Add `?debug` to the URL to show the Debug Panel button. For verbose console logging, set `DEBUG_MODE = true` in `src/config/constants.js`.

## Project layout

```text
src/
  main.js               p5 sketch: setup, render loop, settings, keyboard/mouse input
  app/                  UI sections split out of main.js (recordings, session, MIDI devices)
  features/             Kit Setup wizard, latency calibration, keyboard pads, demo groove
  midi/                 Web MIDI input/output, device tracking across reconnects
  timing/               Tempo maths, metronome click scheduling, worker ticker
  modes/                Freeform styles and the Timeline (staff, spiral, rings, …) layouts
  canvas/               Shape drawing, brush/splatter/ink textures, particles
  state/                Saving, loading, validating settings and projects; undo
  ui/                   Panels (customize, MIDI mapping, timeline controls, video), toasts
  styles/               CSS (theme variables, light/dark)
tests/                  Vitest unit tests
public/                 Copied as-is into the build (default-settings.json)
presets/                Example settings files people can import
```

### How a drum hit flows through the app

1. `MidiManager.handleMIDIMessage` receives a Note On, with the browser's timestamp of when it arrived.
2. `handlePaint` (main.js) finds which drum the note belongs to (`findDrumByMidiNote`) and **queues** the hit. Nothing is drawn inside the MIDI callback, so a fast roll never blocks incoming MIDI.
3. At the start of the next frame `processHitQueue` paints each hit with the current mode.
4. Timeline layouts place the hit using its timestamp, not the time it was drawn, so its position and the timing graph are exact even if the frame was late.

### Timing model

- Everything uses `performance.now()` milliseconds: the same clock as MIDI timestamps.
- The metronome is scheduled ahead of time on the Web Audio clock (`ClickPlayer`), driven by a Web Worker timer (`Ticker`), so clicks are sample-accurate and keep going when the tab is in the background. `getOutputTimestamp()` converts between the audio clock and `performance.now()`, including output latency, so click times and hit times can be compared directly.
- Tempo changes (automation or edits during a take) are applied on bar lines and stored in a tempo map; `src/timing/tempoMath.js` converts between time and beats.
- The **Offset** setting (Calibrate…) subtracts any remaining delay between hitting a pad and the message reaching the browser.

## Settings file format

`StateManager.serialize()` is the single definition of the settings format used for browser storage, exported files and projects. Everything loaded from those places goes through `validateSettings()` (types checked, numbers clamped, unknown keys dropped) before `applySettings()` in main.js.

### Shipping default settings

If there are no saved settings in the browser, the app loads `public/default-settings.json`. To ship your own setup: configure the app, use **Customize Drums → Export to File**, save the file as `public/default-settings.json`, and build. Avoid shipping device-specific mappings: other people's kits will have different devices and notes.

## Deploying

### GitHub Pages (recommended)

`.github/workflows/deploy-pages.yml` lints, tests, builds and publishes on every push to `main`.

One-time setup: in the repository's **Settings → Pages**, set **Source** to **GitHub Actions**. The site will be at `https://<user>.github.io/<repo>/`.

### Any static host

```bash
BASE_PATH=/drum-painter/ npm run build   # the path the app will be served from ("/" for a domain root)
```

Upload the contents of `dist/`. Hashed asset names make caching safe. Only `index.html` needs a short cache lifetime.

For the existing AWS (S3 + CloudFront) setup, `invalidate-cache.ps1` invalidates CloudFront after an upload (`.\invalidate-cache.ps1 -DistributionId <id>`, or set `CLOUDFRONT_DISTRIBUTION_ID`).

The audio/video merge feature downloads FFmpeg (WebAssembly, ~30 MB) from unpkg.com the first time it's used.
