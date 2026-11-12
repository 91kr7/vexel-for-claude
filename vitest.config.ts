import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
    // The servers the tests start never ask GitHub for releases: port 9 refuses.
    env: { AI_CLIENT_RELEASE_SOURCE_URL: 'http://127.0.0.1:9/releases/latest' },
  },
});
