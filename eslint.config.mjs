import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';
import layerBoundaries from './eslint-rules/layer-boundaries.mjs';

const architecture = { rules: { 'layer-boundaries': layerBoundaries } };

/** Deterministic domain code: time and randomness must be injected (Clock / Rng). */
const determinism = {
  'no-restricted-properties': [
    'error',
    { object: 'Date', property: 'now', message: 'Inject a Clock instead of Date.now().' },
    {
      object: 'Math',
      property: 'random',
      message: 'Inject a seeded Rng instead of Math.random().',
    },
    { object: 'performance', property: 'now', message: 'Inject a Clock instead.' },
  ],
  'no-restricted-syntax': [
    'error',
    {
      selector: "NewExpression[callee.name='Date'][arguments.length=0]",
      message: 'new Date() reads the wall clock. Inject a Clock.',
    },
  ],
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { architecture },
    rules: {
      'architecture/layer-boundaries': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['src/lib/{core,series,drawings,replay}/**/*.ts'],
    rules: determinism,
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'coverage/**', 'next-env.d.ts']),
]);
