// Dev server used only by ads/render.mjs: no hot reload and no file
// watching, so editing a file mid-render can't reload a page being recorded.
import { defineConfig } from 'vite';
export default defineConfig({ server: { hmr: false, watch: null } });
