import { defineConfig } from 'vitest/config';

// Deliberately narrow scope for now — see ROADMAP.md/CHANGELOG.md: this
// covers pure-logic modules only (no React components, no Supabase/API
// calls), since those need no environment setup at all and are exactly
// the highest-value, lowest-effort place to start. `npm test` (added in
// package.json) runs this once; `npm run test:watch` re-runs on save.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.js'],
    // running-app/ is the separate Expo project (its own `npm test`); without
    // this, its node_modules' own *.test.js files get swept in.
    exclude: ['node_modules/**', '.next/**', 'running-app/**'],
  },
});
