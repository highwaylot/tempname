import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The creator page as one self-contained HTML file (dist-creator/creator/index.html):
// the game, the creator layer and every flag inlined, so it can be hosted as a
// claude.ai artifact and opened on a phone. `serve` runs it on the dev server.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export default defineConfig({
  root,
  base: './',
  build: {
    target: ['es2019', 'safari14'],
    outDir: 'dist-creator',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: { input: path.join(root, 'creator/index.html') },
  },
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  server: { host: true, port: 5174 },
});
