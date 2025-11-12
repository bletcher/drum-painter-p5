# Drum Painter v2.0

Create stunning generative art with your MIDI drums! A browser-based painting application where every drum hit becomes a visual element, powered by p5.js and the Web MIDI API.

## Features

- **8 Unique Paint Modes** - From classic pointillism to spiral chronicles
- **Device-Specific MIDI Mapping** - Use multiple MIDI devices simultaneously
- **Bank Mode** - Map global parameters to MIDI CC controls
- **Timeline Mode** - Record and playback drum patterns with staff notation
- **Video Recording** - Capture your creative sessions
- **Velocity Curves** - Customize response to drum dynamics
- **Project System** - Save and load complete setups
- **Blend Modes** - Layer effects like multiply, screen, overlay
- **Comprehensive Customization** - Color, size, shape, opacity per drum

## Quick Start

### Development Mode

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run development server:**
   ```bash
   npm run dev
   ```
   Opens automatically at http://localhost:3000

3. **Connect MIDI drums:**
   - Browser asks for MIDI permission - click "Allow"
   - Status shows "MIDI: Connected ✓"
   - Start drumming!

### Testing Without MIDI

Click and drag on the canvas to paint manually and explore visual styles before connecting drums.

### Production Build

See [BUILD.md](BUILD.md) for complete production build and deployment instructions.

## Paint Modes

Access modes via dropdown or keyboard shortcuts (1-8):

### 1. Classic Pointillism (Key: 1)
Random placement across canvas. Each drum has unique color, size controlled by velocity.

### 2. Fibonacci Spiral (Key: 2)
Dots arranged in golden ratio spiral, building outward from center.

### 3. Radial Symmetry (Key: 3)
8-fold symmetrical patterns - perfect for mandalas. Each hit creates 8 mirrored dots.

### 4. Gravity Field (Key: 4)
Dots fall downward creating flowing organic trails. Velocity controls trail length.

### 5. Organic Growth (Key: 5)
Cluster-based growth around "seed" points. Seeds migrate slowly creating natural clustering.

### 6. Velocity Mandala (Key: 6)
Symmetric patterns where velocity controls both size and radial position.

### 7. Spiral Chronicle (Key: 7)
Time flows outward in a spiral from center. Each drum has a fixed angular position (like hours on a clock).
- Adjustable tightness (5-40px)
- Adjustable rotation speed (1-12 RPM)
- Auto-resets when reaching canvas edge

### 8. Timeline Mode (Key: 8)
Musical staff notation with real-time recording and playback.
- Set BPM and subdivision (quarter, eighth, sixteenth notes)
- Auto-record option
- Start over or continue functionality

## MIDI Setup

### Direct Mode (Default)

Map each drum to a MIDI note:

1. Click "Customize Drums" panel
2. Select a drum
3. Click "Assign MIDI Note"
4. Hit your drum pad
5. Mapping confirmed!

### Bank Mode (Advanced)

Map pads to control global parameters and switch modes:

1. Click "MIDI Mapping" panel
2. Select "Bank Mode"
3. Choose parameter (Size, Opacity, Blend Mode, etc.)
4. Click "Assign" and hit pad

**Pad Assignments:**
- Trigger individual drums by assigned note
- Change paint modes
- Adjust global size

**CC Assignments:**
- Map MIDI CC knobs/sliders to parameters
- Size, Opacity, Hue, Saturation, Lightness
- Set min/max ranges for each control

### Device-Specific Mapping

Use multiple MIDI devices without conflicts:

1. In "Customize Drums", mappings show device names
2. Same MIDI note number can trigger different drums on different devices
3. "Any Device" mappings work across all connected devices

## Customization

### Per-Drum Settings

Click "Customize Drums" to adjust:

- **Color** - HSL color picker or hex input
- **Size Multiplier** - 0.1x to 5x
- **Opacity** - 0% to 100%
- **Shape** - Circle, Square, Triangle, Hexagon, Star, Cross, Ring
- **Stroke** - None, Thin, Medium, Thick
- **Rotation** - 0° to 360°

### Velocity Curves

Control how drum velocity affects visuals:

- **Linear** - Direct 1:1 response
- **Exponential** - Emphasizes harder hits
- **Logarithmic** - Compresses dynamic range
- **S-Curve** - Smooth acceleration
- **Inverted** - Softer hits = larger/brighter

Separate curves for:
- Size scaling
- Opacity scaling

### Global Settings

- **Global Size Multiplier** - Scale all dots (0.1x to 5x)
- **Background Color** - Black, white, or custom
- **Blend Mode** - 14 modes including Multiply, Screen, Overlay, Difference

## Keyboard Shortcuts

Press **?** to see all shortcuts, or **U** for the complete User Guide.

### General
- **SPACE** - Start/stop video recording
- **BACKSPACE** - Clear canvas
- **S** - Save image as PNG
- **D** - Save settings to clipboard
- **Z** - Undo last action
- **Y** - Redo
- **H** - Hide/show UI
- **?** - Show keyboard shortcuts
- **U** - Show user guide

### Paint Modes
- **1-8** - Switch between paint modes

### Timeline Mode (when active)
- **P** - Start/pause playback
- **R** - Toggle recording
- **C** - Clear timeline

## Recording & Export

### Video Recording

1. Press **SPACE** to start recording
2. Paint your session
3. Press **SPACE** to stop
4. Video downloads automatically as WebM

### Save Image

Press **S** to save current canvas as high-resolution PNG (1920x1080).

### Undo/Redo

- **Z** - Undo last paint action
- **Y** - Redo
- Up to 50 undo levels maintained

## Projects

### Save Project

1. Enter project name
2. Click "Save Project"
3. Stores all settings, mappings, and mode configurations

### Load Project

1. Select from dropdown
2. Click "Load Project"
3. Everything restored exactly as saved

### Delete Project

Select project and click "Delete Project" to remove from storage.

## Settings Import/Export

### Export Settings

1. Click "Export Settings"
2. JSON file downloads automatically
3. Share with others or back up

### Import Settings

1. Click "Import Settings"
2. Select JSON file
3. All customizations applied

### Bundle Default Settings in Production Builds

**NEW:** Include your customized settings in the production build so they load automatically for all users:

1. **Configure and save** your desired settings in the app
2. **Export settings** - click "Export Settings" to download the JSON file
3. **Rename file** to `default-settings.json`
4. **Place in `/public` directory** (create if it doesn't exist)
5. **Build normally** with `npm run build`
6. **Deploy** - the settings file is included in the `dist` folder

**How it works:**
- Users with existing localStorage settings will keep using those
- New users automatically load from `default-settings.json`
- Perfect for deploying with pre-configured drum mappings and visual settings

See [BUILD.md](BUILD.md) for complete instructions.

## Architecture

### Modular ES6 Structure

```
drum-painter-p5/
├── index.html              # Main HTML + UI
├── vite.config.js          # Build configuration
├── package.json            # Dependencies
├── src/
│   ├── main.js            # Application entry point
│   ├── config/
│   │   ├── constants.js   # Global constants
│   │   └── drumKit.js     # Default drum configurations
│   ├── modes/
│   │   ├── ModeBase.js      # Base class for all modes
│   │   ├── FreeformMode.js  # Freeform wrapper (delegates to style modes)
│   │   ├── ClassicMode.js   # Classic pointillism style
│   │   ├── FibonacciMode.js # Fibonacci spiral style
│   │   ├── RadialMode.js    # Radial symmetry style
│   │   ├── GravityMode.js   # Gravity field style
│   │   ├── OrganicMode.js   # Organic growth style
│   │   ├── DendriticMode.js # River dendritic style
│   │   ├── LightningMode.js # Lightning branching style
│   │   └── TimelineMode.js  # Chronicle mode (staff/rings/spiral/radial/flower/polygon)
│   ├── midi/
│   │   └── MidiManager.js # MIDI input handling
│   ├── state/
│   │   ├── HistoryManager.js # Undo/redo system
│   │   └── projects.js    # Project save/load
│   ├── ui/
│   │   ├── DrumCustomizationPanel.js
│   │   ├── MidiMappingPanel.js
│   │   ├── TimelineControls.js
│   │   └── NotificationSystem.js
│   ├── canvas/
│   │   ├── DrawingUtils.js # Paint functions
│   │   ├── Particle.js    # Particle effects
│   │   └── VideoRecorder.js
│   └── utils/
│       ├── drumHelpers.js # MIDI note lookups
│       ├── scaling.js     # Velocity curves
│       └── colorHelpers.js # Color utilities
└── dist/                  # Production build output
```

### Key Technologies

- **p5.js** - Canvas rendering and creative coding framework
- **Web MIDI API** - Real-time MIDI input from drum triggers
- **MediaRecorder API** - Video capture of canvas
- **localStorage** - Project and settings persistence
- **Vite** - Modern build tooling with optimizations

## Browser Compatibility

**Recommended: Chrome, Edge, Opera**

Web MIDI API support required:
- ✅ Chrome/Chromium
- ✅ Edge
- ✅ Opera
- ❌ Firefox (MIDI not supported)
- ❌ Safari (MIDI not supported)

## Troubleshooting

### MIDI Issues

**"No devices found"**
- Ensure drums are plugged in and powered on
- Refresh page after connecting
- Check device appears in OS MIDI settings

**"Can't assign drum in Customize panel"**
- First map the drum in Direct Mode (MIDI Mapping panel)
- Or use Bank Mode to assign pads

**"Unmapped MIDI note"**
- Check console for note number
- Verify device-specific mapping is correct
- Try "Any Device" mapping for testing

### Performance

**Lag or slow performance:**
- Reduce particle count in modes
- Use simpler shapes (circles are fastest)
- Lower global size multiplier
- Close other browser tabs
- Reduce canvas size in constants.js if needed

### Build Issues

**"Could not resolve entry module"**
- Run `npm install` first
- Check vite.config.js has correct base path
- See [BUILD.md](BUILD.md) for detailed troubleshooting

## Advanced Customization

### Velocity Curves

Each drum can have independent curves for size and opacity:

```javascript
// In DrumCustomizationPanel.js
settings.sizeScaling = 'exponential';    // Harder hits emphasized
settings.opacityScaling = 'logarithmic'; // Compress dynamic range
```

### Custom Shapes

Extend DrawingUtils.js to add new shapes:

```javascript
export function paintDot(canvas, x, y, size, col, alpha, shape, stroke, rotation) {
  // Add your custom shape case
  case 'myShape':
    // Drawing code here
    break;
}
```

### New Paint Modes

1. Create class extending ModeBase.js
2. Implement `paint(note, velocity, context)` method
3. Add to modes array in main.js
4. Add to UI dropdown in index.html

### MIDI CC Mapping

Map any CC parameter in Bank Mode:

1. Select parameter (Size, Opacity, Hue, etc.)
2. Click "Assign CC"
3. Move knob/slider on MIDI controller
4. Set min/max range for scaling

## Tips & Tricks

### Creating Animations

Use Timeline Mode to record rhythmic patterns, then export as video for looping animations.

### Color Palettes

Use HSL mode to create harmonious color schemes:
- Fix Hue, vary Lightness for monochrome
- Fix Saturation and Lightness, vary Hue for rainbow
- Use complementary hues (opposite on color wheel)

### Layering

Use blend modes to create complex overlays:
- **Multiply** - Darkens, like ink layers
- **Screen** - Lightens, like projecting light
- **Overlay** - Combines multiply and screen

### Performance Recording

1. Clear canvas
2. Start video recording (SPACE)
3. Play your pattern
4. Stop recording (SPACE)
5. Share your visual performance!

## Resources

- [p5.js Reference](https://p5js.org/reference/)
- [Web MIDI API](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API)
- [Vite Documentation](https://vitejs.dev/)
- [Project Repository](https://github.com/yourusername/drum-painter-p5)

## License

MIT License - Feel free to fork, modify, and share!

## Credits

Built with p5.js, powered by the Web MIDI API.

---

**Happy drumming and painting!** 🥁🎨

Press **U** in the app for the comprehensive 3-level User Guide, or **?** for keyboard shortcuts.
