import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Two outputs from one source:
//   vite build                 → dist/ with separate assets, what Capacitor ships
//   vite build --mode single   → dist/index.html with everything inlined, what the
//                                claude.ai artifact and any "just open it" copy use
export default defineConfig(({ mode }) => ({
  base: './',
  build: {
    target: ['es2019', 'safari14'],
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: mode === 'single' ? 100_000_000 : 4096,
    cssCodeSplit: mode !== 'single',
    sourcemap: mode !== 'single',
  },
  plugins: mode === 'single' ? [viteSingleFile({ removeViteModuleLoader: true })] : [],
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
}));
