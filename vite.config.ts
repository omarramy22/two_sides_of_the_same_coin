import { defineConfig } from 'vite';

// Generated art (npm run art) is served from the site root: /manifest.json, /chars/sol/head@2x.png...
// base './': the build works from any subfolder (itch.io, GitHub Pages, a preview link).
export default defineConfig({ publicDir: 'assets', base: './' });
