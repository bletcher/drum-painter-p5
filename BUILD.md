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

## File Size

Typical build sizes:
- **Uncompressed:** ~500KB
- **Gzipped:** ~150KB (if server compression enabled)

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
