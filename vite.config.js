import { defineConfig } from 'vite';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  // Path the app is served from. Set BASE_PATH when deploying, e.g.
  //   BASE_PATH=/drum-painter/ npm run build   (a sub-folder, like GitHub Pages)
  //   BASE_PATH=/ npm run build                (a domain root)
  base: process.env.BASE_PATH || '/drum-painter/',

  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  },

  build: {
    outDir: 'dist',
    assetsDir: 'assets',

    // Minification settings
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep errors/warnings visible for bug reports
        pure_funcs: ['console.log', 'console.debug'],
        drop_debugger: true
      }
    },

    // Source maps help when someone reports a bug from the deployed site
    sourcemap: true,

    rollupOptions: {
      output: {
        // Cache busting - adds hash to filenames
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',

        // Chunk splitting for better caching
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  },

  // Exclude FFmpeg from dep optimization — it uses Web Workers which Vite can't pre-bundle
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
  },

  server: {
    port: 3000,
    open: true
  },

  preview: {
    port: 4173
  },

  test: {
    environment: 'node',
    include: ['tests/**/*.test.js']
  }
});
