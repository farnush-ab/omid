import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/lib\/(.*)$/, replacement: `${src}/lib/$1` },
      { find: /^@\/components\/(.*)$/, replacement: `${src}/components/$1` },
      { find: /^@\/(.*)$/, replacement: `${src}/$1` },
    ],
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
