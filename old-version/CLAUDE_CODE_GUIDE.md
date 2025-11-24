# Using Claude Code with Drum Painter

This guide shows you how to effectively use Claude Code in VS Code to iterate on your drum painting project.

## The Workflow

```
1. Open project in VS Code
2. Start Live Server (right-click index.html)
3. Connect MIDI drums
4. Ask Claude Code to make changes
5. Save file (Ctrl+S / Cmd+S)
6. Browser auto-reloads
7. Test with drums immediately
```

## Example Conversations with Claude Code

### Beginner Modifications

**You:** "Make the kick drum dots bigger"

**Claude Code will:**
- Find the `paintClassic()` function
- Locate the size calculation
- Increase the multiplier
- Explain what changed

**You:** "Change all the colors to be more pastel"

**Claude Code will:**
- Modify `getDrumColor()` function
- Add white to make colors lighter
- Show you the before/after

### Intermediate Modifications

**You:** "Add a mode where dots spiral outward from where I click"

**Claude Code will:**
- Create a new paint function
- Track mouse position
- Add spiral math
- Hook it into the mode system
- Update UI

**You:** "Make velocity affect color instead of size"

**Claude Code will:**
- Modify paint functions
- Use velocity for HSB brightness
- Keep size constant
- Test and verify

### Advanced Modifications

**You:** "Create a density-based system where dots avoid crowded areas"

**Claude Code will:**
- Add a density grid tracking system
- Implement spatial checking
- Modify paint functions to query density
- Add visualization of density map
- Optimize for performance

**You:** "Add physics so dots bounce off each other"

**Claude Code will:**
- Create a physics simulation
- Add collision detection
- Implement bounce response
- Update drawing to show movement
- Add damping/friction

## Pro Tips for Working with Claude Code

### Be Specific About What You Want to See

❌ "Make it look better"
✅ "Make the snare create 5 small dots in a circle instead of 1 big dot"

❌ "Add some randomness"
✅ "Add randomness to the x position but keep y position fixed"

### Iterate in Small Steps

Instead of: "Create a complex physics system with gravity, wind, and collision"

Try:
1. "Add gravity that makes dots fall slowly"
2. Test it, see how it feels
3. "Make gravity stronger near the bottom"
4. Test again
5. "Add horizontal wind that changes direction"
6. Keep building...

### Use the Live Feedback

```
You: "Make kick drum dots blue"
Claude: [modifies code]
You: [Ctrl+S, see result]
You: "Actually, make it cyan instead"
Claude: [quick adjustment]
You: [Ctrl+S, see result]
You: "Perfect!"
```

### Ask Claude to Explain

**You:** "Explain how the Fibonacci mode works"

Claude will walk through the math and show you which parts control the spiral.

**You:** "Why are my dots not showing up?"

Claude will debug with you, checking MIDI mapping, canvas bounds, opacity, etc.

## Common Modification Patterns

### Changing Visual Parameters

**Size:**
```javascript
let size = 10 + velocity * 30;
//         ^^   ^^^^^^^^ ^^
//         base  velocity mult
```

**Opacity:**
```javascript
paintCanvas.fill(r, g, b, 150 * velocity);
//                        ^^^ opacity base
```

**Position:**
```javascript
let x = random(paintCanvas.width);  // Uniform random
let x = random(paintCanvas.width * 0.2, paintCanvas.width * 0.8);  // Center bias
let x = paintCanvas.width/2 + randomGaussian() * 200;  // Gaussian center
```

### Adding New Behaviors

**Pattern:**
1. Create function: `function paintMyIdea(note, velocity) { }`
2. Add to router in `paintDrum()`
3. Add to MODE_NAMES array
4. Test with number key

**Claude Code can generate entire new modes** - just describe what you want!

### Debugging with Claude

**You:** "My MIDI isn't working"

**Claude will help you:**
- Add console.log() statements
- Check MIDI note numbers
- Verify WebMIDI connection
- Test with mouse input

**You:** "Why is mode 3 so slow?"

**Claude will:**
- Profile the code
- Find bottlenecks
- Suggest optimizations
- Implement caching if needed

## Advanced Claude Code Use Cases

### Generate Variations

**You:** "Create 3 variations of the gravity mode with different physics parameters"

Claude will create:
- `paintGravityLight()` - slow fall
- `paintGravityNormal()` - current behavior  
- `paintGravityHeavy()` - fast drop

### Refactor for Performance

**You:** "This is getting slow with many strokes. Optimize it."

Claude will:
- Identify expensive operations
- Add spatial hashing if needed
- Implement LOD (level of detail)
- Add stroke count limits

### Add Features

**You:** "Add an 'undo last 10 strokes' feature"

Claude will:
- Track stroke history
- Add undo keybinding
- Implement redraw logic
- Update UI

### Create Export Options

**You:** "Add a way to export at 4K resolution"

Claude will:
- Add resolution parameter
- Create temporary high-res canvas
- Redraw everything
- Export and restore

## Example Session

```
You: Hey, I want to make mode 1 (Fibonacci) look more organic

Claude: I can help with that! What aspects would make it more organic?

You: Add some randomness to the placement so it's not perfectly mathematical

Claude: [adds random offset to spiral positions]

You: [Tests] Nice! But can the dots also vary in size more?

Claude: [adds size variation based on noise function]

You: [Tests] Good! Now make them slightly elliptical instead of circles

Claude: [modifies to use ellipse() with random width/height variation]

You: [Tests] Perfect! Can you save this as a new mode "Organic Spiral"?

Claude: [creates new function, adds to mode list]

You: [Tests] Awesome, thanks!
```

## Keyboard Shortcuts While Developing

| Shortcut | Action |
|----------|--------|
| **Ctrl/Cmd + S** | Save → auto-reload in browser |
| **Ctrl/Cmd + /** | Comment/uncomment code |
| **Ctrl/Cmd + D** | Select next occurrence |
| **Alt + Up/Down** | Move line up/down |
| **Ctrl/Cmd + /** | Toggle comment |

## Tips for Experimenting

### Make Backups of Good States

```
You: "I like how this looks. Can you save the current state?"
Claude: [saves current function as paintMode1_v2()]
```

Now you can switch between versions!

### Use Console for Real-Time Data

```javascript
// Add to see what's happening
console.log(`Note: ${note}, Velocity: ${velocity}, Mode: ${currentMode}`);
```

### Comment Out Instead of Delete

```javascript
// Old version (keep for reference)
// let size = 10 + velocity * 30;

// New version (testing)
let size = randomGaussian() * 20 + velocity * 50;
```

### Test Edge Cases

```
You: "What happens if I hit 100 drums at once?"
Claude: [adds rate limiting or optimization]

You: "What if velocity is 0?"
Claude: [adds safety check]
```

## Getting Unstuck

If something breaks:

**You:** "Nothing is painting anymore"

**Claude will:**
1. Check browser console for errors
2. Verify MIDI connection
3. Add debug logging
4. Test each function individually
5. Find and fix the issue

**You:** "I changed something and forgot what"

**Claude will:**
1. Show you the git diff (if using git)
2. Or help restore from description
3. Or revert to last working state

## Next Level: Combining Features

Once you're comfortable, try combining ideas:

**You:** "Make mode 4 (Gravity) but with the symmetry from mode 3"

Claude will merge the two systems.

**You:** "Create a mode that transitions between Fibonacci and Organic based on velocity"

Claude will create a hybrid that morphs between styles.

## Remember

- **Small iterations** = faster learning
- **Test immediately** = see results now
- **Explain your vision** = Claude adapts to your aesthetic
- **Don't be afraid to experiment** = it's just code, you can undo!

The combination of Claude Code + Live Server + MIDI drums gives you **instant creative feedback loops**. Use it!

---

Have fun experimenting! 🎨🥁✨
