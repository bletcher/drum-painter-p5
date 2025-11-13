import { defineConfig } from 'vite';

export default defineConfig({
  // IMPORTANT: Change this to match your AWS subdirectory path
  // Examples:
  //   base: '/drum-painter/'
  //   base: '/apps/drum-painter/'
  //   base: '/' (if deploying to root)
  base: '/drum-painter/',

  build: {
    outDir: 'dist',
    assetsDir: 'assets',

    // Minification settings
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,  // Remove console.log in production
        drop_debugger: true
      }
    },

    // Source maps for debugging (set to false for smaller build)
    sourcemap: false,

    // Rollup options for cache busting and chunk splitting
    rollupOptions: {
      output: {
        // Cache busting - adds hash to filenames
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',

        // Chunk splitting for better caching
        manualChunks(id) {
          // Split vendor modules into separate chunk
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  },

  // Server config for development
  server: {
    port: 3000,
    open: true
  },

  // Preview server config
  preview: {
    port: 4173
  }
});
