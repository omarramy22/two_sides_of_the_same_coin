import { defineConfig } from 'vite';

// Generated art (npm run art) is served from the site root: /manifest.json, /chars/sol/head@2x.png...
export default defineConfig({ publicDir: 'assets' });
