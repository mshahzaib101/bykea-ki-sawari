import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  build: {
    // downlevel syntax for older low-end Android webviews (the bulk of players)
    target: 'es2020',
    // three.js is ~640 KB on its own — that single chunk is expected, not a smell
    chunkSizeWarningLimit: 800,
  },
  server: {
    port: Number(process.env.PORT) || 5173,
    strictPort: false,
    host: true, // expose on LAN so the game can be play-tested on a phone
  },
});
