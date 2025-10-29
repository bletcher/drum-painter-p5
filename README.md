# Drum Painter - p5.js Version

Paint pointillistic art with your MIDI drum triggers in the browser!

## Quick Start (VS Code + Claude Code)

### 1. Open in VS Code
```bash
# Open this folder in VS Code
code .
```

### 2. Install Live Server Extension
1. In VS Code, click Extensions (⇧⌘X / Ctrl+Shift+X)
2. Search for "Live Server" by Ritwick Dey
3. Install it

### 3. Launch the App
1. Right-click on `index.html`
2. Select "Open with Live Server"
3. Browser opens automatically at http://localhost:5500

### 4. Connect MIDI Drums
1. Plug in your MIDI drum triggers
2. Browser will ask for MIDI permission - click "Allow"
3. Status in top-left should show "MIDI: Connected ✓"
4. **Start drumming!**

## Testing Without MIDI

If you don't have drums connected:
- Just click and drag in the browser to paint
- This lets you test the visual styles before connecting MIDI

## Controls

| Key | Action |
|-----|--------|
| **SPACE** | Clear canvas and start fresh |
| **S** | Save current painting as PNG |
| **1-5** | Switch painting modes |
| **H** | Hide/show UI overlay |

## The 5 Painting Modes

### 1. Classic Pointillism (Press 1)
- Random placement across canvas
- Different drums = different colors
- Velocity controls size and opacity

### 2. Fibonacci Spiral (Press 2)
- Dots arranged in golden ratio spiral
- Builds outward from center
- Creates natural-looking patterns

### 3. Radial Symmetry (Press 3)
- 8-fold symmetrical patterns
- Perfect for mandalas
- Each hit creates 8 mirrored dots

### 4. Gravity Field (Press 4)
- Dots fall downward
- Creates flowing, organic trails
- Velocity controls trail length

### 5. Organic Growth (Press 5)
- Cluster-based growth around "seed" points
- Seeds slowly migrate
- Creates natural clustering

## Customization with Claude Code

This is where it gets fun! You can ask Claude Code to modify anything:

### Example Requests:

**"Make the kick drum create bigger dots"**
```javascript
// Claude will find and modify this line in paintClassic():
let size = 10 + velocity * 30;  // ← Increase these numbers
```

**"Change snare color to blue"**
```javascript
// Claude will update getDrumColor():
case MIDI_NOTES.SNARE:
  return color(200, 40, 50);  // ← Change to color(40, 100, 200)
```

**"Add a new mode that creates triangles instead of circles"**
```javascript
// Claude will add a new paint function and update the mode list
```

**"Make dots fade over time instead of staying permanent"**
```javascript
// Claude will modify the Particle class or add time-based rendering
```

## File Structure

```
drum-painter-p5/
├── index.html          # Main HTML page with UI
├── sketch.js           # All the painting logic
└── README.md          # This file
```

Everything is in one JavaScript file for easy editing!

## How It Works

### The Flow:
1. **MIDI Input** → WebMIDI API captures drum hits
2. **Note + Velocity** → Mapped to visual parameters
3. **Paint Function** → Draws to off-screen canvas (1920x1080)
4. **Display** → Scaled to fit browser window
5. **Save** → Export high-res PNG

### Key Concepts:

**Off-screen Canvas:**
```javascript
paintCanvas = createGraphics(1920, 1080);  // High-res painting surface
// Everything you paint stays here
```

**MIDI Mapping:**
```javascript
const MIDI_NOTES = {
  KICK: 36,      // Bass drum
  SNARE: 38,     // Snare
  CLOSED_HAT: 42 // Hi-hat
  // etc...
};
```

**Velocity Sensitivity:**
```javascript
let vel = map(velocity, 0, 127, 0.3, 1.0);  // Convert MIDI range
let size = 10 + vel * 30;  // Harder hit = bigger dot
```

## Troubleshooting

### "MIDI: No devices found"
- Ensure drum triggers are plugged in
- Refresh the page after connecting
- Check your MIDI device is powered on

### "MIDI: Not supported"
- WebMIDI requires Chrome, Edge, or Opera
- Safari/Firefox don't support WebMIDI yet
- Use Chrome for best results

### "Browser doesn't ask for MIDI permission"
- Must use HTTPS or localhost
- Live Server automatically uses localhost ✓

### Colors/sizes not right
- Check MIDI note numbers match your drums
- Add `console.log(note, velocity)` in handleMIDIMessage() to debug
- Different drum modules use different note mappings

## Extending the Project

### Add Your Own Mode:

1. Create new paint function:
```javascript
function paintMyMode(note, velocity) {
  // Your creative code here
  let x = paintCanvas.width / 2;
  let y = paintCanvas.height / 2;
  // ...
}
```

2. Add to router in `paintDrum()`:
```javascript
case 5:
  paintMyMode(note, velocity);
  break;
```

3. Add mode name:
```javascript
const MODE_NAMES = [
  // ... existing modes
  'My Custom Mode'
];
```

### Use Different Colors:

```javascript
// RGB values
color(255, 0, 0)        // Red
color(0, 255, 0)        // Green
color(0, 0, 255)        // Blue

// With transparency
color(255, 0, 0, 128)   // 50% transparent red

// HSB mode for easier color control
colorMode(HSB);
color(180, 80, 100)     // Cyan
```

### Add Physics:

```javascript
// Make dots drift
let vx = random(-2, 2);
let vy = random(-2, 2);
for (let i = 0; i < 50; i++) {
  x += vx;
  y += vy;
  vy += 0.1;  // Gravity
  paintCanvas.circle(x, y, 5);
}
```

## Performance Tips

- If laggy, reduce particle feedback count
- High stroke counts may slow down (especially mode 2)
- Close other browser tabs
- Canvas is 1920x1080 - reduce if needed

## Going Further

Once comfortable:
- Add blend modes (MULTIPLY, SCREEN, etc.)
- Implement color palettes
- Add tempo-synced effects
- Create rule systems (only paint in certain areas)
- Add post-processing (blur, grain)
- Connect to other Web APIs (audio analysis, etc.)

## Resources

- [p5.js Reference](https://p5js.org/reference/)
- [WebMIDI API Docs](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API)
- [Live Server Extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)

---

Happy drumming! 🥁🎨

Use Claude Code to iterate and experiment - that's where the magic happens!
