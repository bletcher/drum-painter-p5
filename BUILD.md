# Drum Painter P5 - Production Build Guide

## Prerequisites

- Node.js 18+ and npm installed
- Access to your AWS S3 bucket or web server

## Initial Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

## Configuration

### Set Deployment Path

Before building, configure the subdirectory path in `vite.config.js`:

```javascript
// For https://yoursite.com/drum-painter/
base: '/drum-painter/'

// For https://yoursite.com/apps/drum-painter/
base: '/apps/drum-painter/'

// For root deployment
base: '/'
```

## Development

Run local development server:
```bash
npm run dev
```

Opens at `http://localhost:3000` with hot module replacement.

## Including Your Customized Settings in the Build

**NEW FEATURE:** You can now bundle your customized drum settings with the production build so they load automatically for all users.

### Steps to Include Default Settings:

1. **Configure your settings** in the app (colors, sizes, MIDI mappings, etc.)

2. **Save your settings** using the "Save" button in the customization panel

3. **Export settings to file:**
   - Click "Export Settings" button
   - A JSON file will download: `drum-painter-settings-[timestamp].json`

4. **Add to build:**
   - Rename the file to: `default-settings.json`
   - Place it in the `/public` directory (create if it doesn't exist)

5. **Build normally:**
   ```bash
   npm run build
   ```
   The `default-settings.json` will be included in the dist folder

6. **Test before deploying:**
   ```bash
   npm run preview
   ```
   Open http://localhost:4173/drum-painter/ in an incognito window (to bypass localStorage) and verify your settings load correctly. Check browser console for: `✓ Loaded settings from default-settings.json`

7. **Deploy:**
   Upload the entire `dist/` folder contents to your server. The file structure will be:
   ```
   /drum-painter/
   ├── default-settings.json  (at root of subdirectory)
   ├── index.html
   └── assets/
   ```

8. **How it works:**
   - Users with existing localStorage settings will use those
   - New users will automatically load from `default-settings.json`
   - File is fetched from the correct path using Vite's base URL
   - Perfect for deploying with pre-configured settings!

## Production Build

### Build for production:
```bash
npm run build
```

This creates an optimized build in the `dist/` directory with:
- ✅ Minified JavaScript
- ✅ Optimized assets
- ✅ All console.log statements removed
- ✅ Source maps disabled (smaller size)
- ✅ Chunked bundles for better caching
- ✅ Default settings included (if you added default-settings.json)
- ✅ FFmpeg.wasm dependencies bundled (loaded on-demand for audio/video merging)

### Preview the build locally:
```bash
npm run preview
```

Opens at `http://localhost:4173` to test the production build.

## Deployment to AWS

### Option 1: AWS S3 + CloudFront (Static Site)

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Upload to S3:**
   ```bash
   # Replace with your bucket and path
   aws s3 sync dist/ s3://your-bucket-name/drum-painter/ --delete
   ```

3. **Invalidate CloudFront cache (if using CDN):**
   ```bash
   aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/drum-painter/*"
   ```

### Option 2: Manual Upload to Web Server

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Upload the `dist/` folder contents** to your AWS subdirectory:
   - Using FTP/SFTP client (FileZilla, Cyberduck, etc.)
   - Or SCP: `scp -r dist/* user@yourserver:/var/www/html/drum-painter/`
   - Or AWS CLI: `aws s3 sync dist/ s3://bucket/drum-painter/`

3. **Verify the deployment:**
   - Visit `https://yoursite.com/drum-painter/` (or your configured path)
   - Check browser console for errors
   - Test MIDI functionality
   - Verify all features work

## Build Output

The `dist/` folder will contain:
```
dist/
├── index.html              # Minified HTML entry point
├── assets/
│   ├── index-[hash].js    # Bundled & minified JavaScript
│   ├── index-[hash].css   # Bundled CSS (if any)
│   └── [other-assets]     # Images, fonts, etc.
└── ...
```

## Important Notes

### Path Configuration
- **CRITICAL:** The `base` path in `vite.config.js` must match your deployment subdirectory
- Wrong path = broken asset links and blank page

### File Permissions
If deploying to a Unix server, ensure files have correct permissions:
```bash
find dist -type d -exec chmod 755 {} \;
find dist -type f -exec chmod 644 {} \;
```

### Cache Busting
- Vite automatically adds hashes to filenames (e.g., `index-a1b2c3d4.js`)
- This ensures browsers fetch new versions after updates
- No manual cache clearing needed for assets

### Audio/Video Merge Feature
- **FFmpeg.wasm** loads on-demand from unpkg.com CDN when user first merges audio/video
- Requires internet connection for first-time FFmpeg load (~10MB download)
- After initial load, FFmpeg is cached by the browser for subsequent merges
- Processing happens entirely client-side—no server uploads required
- Supports all common audio formats (MP3, WAV, OGG, M4A, etc.)
- Output is MP4 format with AAC audio encoding

### Version Updates
When releasing a new version:
1. Update version in `package.json`
2. Update version in `index.html` (bottom right corner)
3. Rebuild and redeploy

## Troubleshooting

### Blank Page After Deployment
- Check browser console for 404 errors
- Verify `base` path in `vite.config.js` matches deployment path
- Ensure all files uploaded correctly

### Assets Not Loading
- Check network tab for 404s
- Verify subdirectory path is correct
- Clear browser cache

### MIDI Not Working
- MIDI requires HTTPS (or localhost)
- Check browser console for permission errors
- Ensure user granted MIDI access

### Audio/Video Merge Not Working
- Check browser console for FFmpeg loading errors
- Verify internet connection (required for first-time FFmpeg download)
- Ensure sufficient memory available (~100MB for processing)
- Try with smaller video/audio files first
- Check that audio file format is supported (MP3, WAV, OGG, M4A, etc.)
- Clear browser cache and try again if FFmpeg fails to load

## File Size

Typical build sizes:
- **Main Bundle (Uncompressed):** ~500-600KB
- **Main Bundle (Gzipped):** ~150-180KB (if server compression enabled)
- **FFmpeg.wasm:** Loaded dynamically from CDN (~10MB, one-time download when user first merges audio/video)

**Note:** The audio/video merge feature uses FFmpeg.wasm, which is loaded on-demand from unpkg.com CDN. This keeps the initial bundle size small while providing powerful browser-based video processing when needed.

## Clean Build

To remove all build artifacts:
```bash
# Windows
rmdir /s /q dist node_modules

# Unix/Mac
rm -rf dist node_modules

# Then reinstall
npm install
```

## Support

For issues or questions, check the console for error messages and ensure:
1. Node.js version is 18+
2. All npm packages installed successfully
3. `vite.config.js` base path is correct
4. Deployment target supports HTTPS
