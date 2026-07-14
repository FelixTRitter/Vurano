/**
 * Testkonfiguration des Clients: vitest mit jsdom als Browser-Ersatz —
 * dieselbe Testphilosophie wie die jsdom-Suite von Immo Control.
 * Tests liegen unter client/test/, Aufruf: npm test (im Root für alles).
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
  },
});
