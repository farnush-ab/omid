import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
// @ts-expect-error -- plain ESM rule module without type declarations
import rule from '../../eslint-rules/layer-boundaries.mjs';

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

const f = (p: string) => `/repo/src/${p}`;

tester.run('layer-boundaries', rule, {
  valid: [
    { code: "import { x } from './scales/time-scale';", filename: f('lib/core/engine.ts') },
    { code: "import { x } from '@/lib/core/util/math';", filename: f('lib/drawings/a.ts') },
    { code: "import { x } from '@/lib/drawings';", filename: f('components/Toolbar.tsx') },
    { code: "import { x } from '@/lib/drawings/tools/trend-line';", filename: f('lib/app/x.ts') },
    { code: "import { x } from '../core/events';", filename: f('lib/replay/x.ts') },
    { code: "import React from 'react';", filename: f('components/A.tsx') },
  ],
  invalid: [
    {
      code: "import { x } from '@/lib/drawings';",
      filename: f('lib/core/engine.ts'),
      errors: [{ messageId: 'layer' }],
    },
    {
      code: "import { x } from '../drawings/x';",
      filename: f('lib/replay/x.ts'),
      errors: [{ messageId: 'layer' }],
    },
    {
      code: "import React from 'react';",
      filename: f('lib/core/x.ts'),
      errors: [{ messageId: 'framework' }],
    },
    {
      code: "import { x } from '@/lib/drawings/tools/trend-line';",
      filename: f('components/A.tsx'),
      errors: [{ messageId: 'barrel' }],
    },
    {
      code: "import { x } from '@/components/A';",
      filename: f('lib/app/x.ts'),
      errors: [{ messageId: 'layer' }],
    },
    {
      code: "import { x } from '@/lib/storage';",
      filename: f('lib/data/x.ts'),
      errors: [{ messageId: 'layer' }],
    },
  ],
});
