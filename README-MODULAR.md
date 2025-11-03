# Drum Painter - Modular Architecture

This is the refactored version using ES6 modules for better code organization and maintainability.

## 🚀 Quick Start

### Option 1: Using Python (Recommended)
```bash
# From the project directory
python -m http.server 8080

# Or use npm script
npm run dev
```

Then open: http://localhost:8080/index-modular.html

### Option 2: Using Node.js http-server
```bash
npx http-server -p 8080
```

Then open: http://localhost:8080/index-modular.html

## 📁 New Project Structure

```
drum-painter-p5/
├── index-modular.html      # New modular version entry point
├── index.html              # Original monolithic version (still works)
├── sketch.js               # Original code (still works)
├── package.json            # NPM scripts for dev server
└── src/                    # New modular code
    ├── main.js             # Main orchestrator
    ├── config/
    │   ├── constants.js    # All configuration constants
    │   └── drumKit.js      # Drum kit configuration
    ├── modes/
    │   ├── ModeBase.js     # Base class for modes
    │   ├── ClassicMode.js  # Classic Pointillism
    │   └── FibonacciMode.js # Fibonacci Spiral
    ├── canvas/
    │   ├── DrawingUtils.js # Shape drawing functions
    │   └── Particle.js     # Particle effects
    └── utils/
        ├── scaling.js      # Velocity scaling curves
        └── drumHelpers.js  # Drum property accessors
```

## 🧪 Test Version (Current)

The test version includes:
- ✅ 2 paint modes (Classic, Fibonacci)
- ✅ MIDI input
- ✅ Mouse testing (click to paint)
- ✅ Basic keyboard controls
- ⏳ Full UI (pending)
- ⏳ Remaining 6 modes (pending)
- ⏳ State management (pending)

## 🎮 Controls

- **Click**: Test painting (simulates MIDI)
- **1-2**: Switch between modes
- **SPACE**: Clear canvas
- **S**: Save painting
- **H**: Hide/Show UI

## 🔍 Testing Checklist

1. [ ] Open http://localhost:8080/index-modular.html
2. [ ] Check browser console for module loading
3. [ ] Click canvas - should paint dots
4. [ ] Press 1 - switch to Classic mode
5. [ ] Press 2 - switch to Fibonacci mode
6. [ ] Connect MIDI device - should see "Connected" status
7. [ ] Hit drums - should paint

## 🐛 Troubleshooting

### "CORS error" or modules not loading
- Make sure you're running from a local server (not `file://`)
- Use `python -m http.server 8080` or `npx http-server`

### Nothing paints when clicking
- Check browser console for errors
- Try pressing 1 or 2 to switch modes
- Check MIDI status in top-left panel

### MIDI not connecting
- Original version still works with MIDI: open `index.html`
- MIDI support will be fully migrated next

## 📝 Next Steps

Once testing confirms the architecture works:
1. Extract remaining 6 paint modes
2. Migrate full MIDI system
3. Migrate state management (save/load/undo)
4. Migrate UI panels (customization, MIDI mapping)
5. Migrate timeline mode features
6. Full testing with all features

## 🔙 Rollback

If you need the original version:
- Just open `index.html` instead
- Original `sketch.js` is untouched
