import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Two outputs from one source:
//   vite build                 → dist/ with separate assets, what Capacitor ships
//   vite build --mode single   → dist/index.html with everything inlined, what the
//                                claude.ai artifact and any "just open it" copy use
// Source maps are off by default: cap sync copies dist/ verbatim into both
// native trees, and the maps were 260 kB of the 428 kB shipped. Set
// SOURCEMAP=1 to build with them for debugging.
export default defineConfig(({ mode }) => ({
  base: './',
  build: {
    target: ['es2019', 'safari14'],
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: mode === 'single' ? 100_000_000 : 4096,
    cssCodeSplit: mode !== 'single',
    sourcemap: process.env.SOURCEMAP === '1',
  },
  plugins: mode === 'single' ? [viteSingleFile({ removeViteModuleLoader: true })] : [],
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
}));
