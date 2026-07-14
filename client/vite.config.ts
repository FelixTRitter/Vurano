import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // Im Dev-Modus laufen Client (5173) und Server (3000) getrennt;
    // der Proxy leitet API-Aufrufe samt Cookies weiter.
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
});
