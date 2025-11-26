# Drum Painter v2.0

Create stunning generative art with your MIDI drums! A browser-based painting application where every drum hit becomes a visual element, powered by p5.js and the Web MIDI API.

## Features

- **Three-Group Mode System** - Staff (time-based), Freeform (random), Chronicle (point-based sequential)
- **Device-Specific MIDI Mapping** - Use multiple MIDI devices simultaneously
- **Bank Mode** - Map global parameters to MIDI CC controls
- **Staff & Chronicle Modes** - Record and playback drum patterns with multiple visual layouts
- **Video Recording** - Capture your creative sessions
- **Velocity Curves** - Customize response to drum dynamics with 5 scaling options
- **Project System** - Save and load complete setups
- **Blend Modes** - 8 layering effects including Add, Difference, Multiply, Screen
- **Comprehensive Customization** - Color, size, shape, opacity, hue variation per drum

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

### Deployment & Cache Invalidation

After building and uploading to your server:

**1. Build the production files:**
```bash
npm run build
```

**2. Upload `dist/` contents to your server** (S3, CloudFront, etc.)

**3. Clear CloudFront cache** (if using AWS CloudFront):
```powershell
.\invalidate-cache.ps1
```

The script will:
- Verify AWS credentials
- Create invalidation for `/drum-painter/*`
- Monitor progress (typically 1-5 minutes)
- Notify when complete

**Note**: The vite.config.js includes automatic cache-busting via filename hashing, but CloudFront invalidation ensures immediate updates for users.

**First time setup**: Edit `invalidate-cache.ps1` and set your CloudFront distribution ID.

## Paint Modes

The application uses a **three-group mode system**:

1. **Main Mode Type** (Staff, Freeform, or Chronicle) - Radio buttons
2. **Style/Layout Selection** - Dropdown menu for specific variations within each mode

### Staff Mode (Time-Based Recording)

Timeline-based recording where position depends on elapsed time. Requires pressing Start button. Choose from 2 layouts:

#### Staff Notation
Traditional horizontal DAW-style sequencer with musical grid. Each drum on its own horizontal lane, time flows left to right with BPM sync and metronome.

#### Spiral Timeline
Archimedean spiral pattern expanding from center. Time flows outward with rotation synchronized to beats. Completes one full rotation per measure, matching the visual metronome. Drums are offset radially for clarity.

### Freeform Mode (Random Placement)

Immediate visual response - each drum hit creates instant random patterns. Choose from 5 styles:

#### Classic Pointillism
Random placement across canvas. Each drum has unique color, size controlled by velocity. Supports all shapes including complex brushstrokes, splatter, and ink blot effects.

#### Gravity Field
Dots fall downward creating flowing organic trails. Velocity controls trail length and horizontal drift. Features fading multi-stroke effects. Complex shapes (brushstroke/splatter/inkblot) automatically convert to circles for performance optimization.

#### Organic Growth
Cluster-based growth around "seed" points. Seeds migrate slowly creating natural clustering patterns. Supports all shapes.

#### Dendritic Spreading
Realistic river drainage networks based on Horton's Laws:
- Hierarchical tributary branching (convergent)
- Width increases downstream (stream order)
- Natural meandering with sinusoidal curves
- Flows away from canvas edges
- Velocity controls length and branching complexity
- Complex shapes auto-convert to circles for performance

#### Lightning
Realistic electrical discharge with fractal branching:
- Cloud-to-ground strikes (originates from top)
- Stepped leader physics with sharp angular zigzags
- Divergent branching (main bolt splits into thinner branches)
- Multiple splits from same point (1-3 branches)
- Width decreases along branches (energy dissipation)
- Bright core with electric corona glow
- Velocity controls complexity and branch count
- Complex shapes auto-convert to circles for performance

### Chronicle Mode (Point-Based Sequential)

Sequential visual patterns where position is based on note count, not time. Paint immediately without starting timeline. Choose from 5 layouts:

#### Fibonacci Spiral
Dots arranged in golden ratio spiral, building outward from center. Creates organic growth patterns expanding with each hit.

#### Radial Symmetry
8-fold symmetrical patterns radiating from center - perfect for mandalas. Each hit creates 8 mirrored dots simultaneously.

#### Rings (Radial Spokes)
Drums positioned on spokes radiating from center. Distance from center increases with each hit, creating star/burst patterns.

#### Petals (Flower Petals)
Organic flower-like curves. Each drum traces a petal path with sinusoidal oscillation for natural flowing patterns.

#### Polygon (Rotating Expanding Polygon)
Spiraling geometric pattern with breathing effect. Drums positioned at polygon vertices that rotate and pulse as they expand outward. Creates a hypnotic spiral-polygon hybrid - one full rotation every 60 hits with subtle pulsing. Number of vertices equals number of drums.

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
- **Size Multiplier** - 30% to 300%
- **Opacity** - 10% to 100%
- **Shape** - Circle, Square, Triangle, Hexagon, Star, Diamond, Brushstroke, Splatter, Ink Blot
- **Hue Variation** - 0° to 60° directional shift (harder hits shift more, with velocity scaling curves)
- **Rotation** - 0° to 360°
- **Stroke** - Enable/disable with custom weight (1-10px) and color

### Velocity Curves

Control how drum velocity affects visuals:

- **Fixed** - Uses slider value regardless of velocity (constant size/opacity)
- **1:1** - Direct linear response
- **Boost Soft** - Amplifies soft hits (logarithmic)
- **Gate Soft** - Suppresses soft hits (exponential)
- **Gate Loud** - Smooth quadratic suppression

Separate curves for:
- Size scaling
- Opacity scaling
- Hue variation scaling

### Global Settings

- **Global Size Multiplier** - Scale all dots (0.1x to 5x)
- **Background Color** - Black, white, or custom
- **Blend Mode** - 8 modes: Normal, Multiply, Screen, Overlay, Dodge, Burn, Add, Difference

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
- **F** - Toggle fullscreen
- **?** - Show keyboard shortcuts
- **U** - Show user guide

### Paint Modes
Mode switching is done via UI radio buttons (Staff/Freeform/Chronicle) and dropdown menus for specific styles/layouts.

### Staff Mode (when active)
- **P** - Start/pause playback
- **R** - Toggle recording
- **C** - Clear timeline

## Recording & Export

### Video Recording

1. Press **SPACE** to start recording
2. Paint your session
3. Press **SPACE** to stop
4. Video appears in Recent Recordings list

### Recording Management

Each recording can be:
- **Downloaded** - Save original video as WebM
- **Merged with Audio** - Upload an audio file (MP3, WAV, etc.) to create a synchronized MP4 with sound
- **Deleted** - Remove from the list

The app stores up to 10 recent recordings. Use FFmpeg.wasm (loaded on first merge) to combine video and audio entirely in your browser—no server uploads required.

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
│       ├── drumHelpers.js    # MIDI note lookups
│       ├── scaling.js        # Velocity curves
│       ├── colorHelpers.js   # Color utilities
│       └── AudioVideoMerger.js # FFmpeg.wasm integration
└── dist/                  # Production build output
```

### Key Technologies

- **p5.js** - Canvas rendering and creative coding framework
- **Web MIDI API** - Real-time MIDI input from drum triggers
- **MediaRecorder API** - Video capture of canvas
- **FFmpeg.wasm** - Browser-based audio/video merging (WebAssembly)
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

Each drum can have independent curves for size, opacity, and hue:

```javascript
// In DrumCustomizationPanel.js
settings.sizeScaling = 'gate-soft';      // Suppress soft hits
settings.opacityScaling = 'boost-soft';  // Amplify soft hits
settings.hueScaling = 'fixed';           // Ignore velocity, use slider value
```

Available curves: `'fixed'`, `'1:1'`, `'boost-soft'`, `'gate-soft'`, `'gate-loud'`

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

Use Staff Mode (Staff Notation or Spiral layouts) to record rhythmic patterns with precise timing, then export as video for looping animations. Chronicle Mode layouts (Fibonacci, Radial, Rings, Petals, Polygon) create sequential point-based patterns perfect for geometric animations.

### Color Palettes

Use HSL mode to create harmonious color schemes:
- Fix Hue, vary Lightness for monochrome
- Fix Saturation and Lightness, vary Hue for rainbow
- Use complementary hues (opposite on color wheel)

### Layering

Use blend modes to create complex overlays:
- **Multiply** - Darkens, like ink layers
- **Screen** - Lightens, like projecting light
- **Overlay** - Combines multiply and screen for contrast boost
- **Add** - Additive light for bright glowing overlaps
- **Difference** - Inverts colors for psychedelic effects
- **Dodge/Burn** - Brightens highlights or deepens shadows

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
