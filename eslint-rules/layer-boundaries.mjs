/**
 * Local ESLint rule enforcing the architecture's layering (see docs/ARCHITECTURE.md).
 *
 * Every file under src/ belongs to exactly one "element". An element may only import
 * from the elements listed in ALLOWED. UI code (components, app) may only reach into
 * src/lib through a module's public barrel (`@/lib/<module>`), never deep paths.
 *
 * Zero dependencies on purpose: resolving aliases and relative paths is all we need.
 */
import path from 'node:path';

const SRC = `${path.sep}src${path.sep}`;

/** element -> elements it may import from */
const ALLOWED = {
  core: ['core'],
  series: ['core', 'series'],
  drawings: ['core', 'drawings'],
  replay: ['core', 'replay'],
  themes: ['core', 'themes'],
  data: ['core', 'data'],
  storage: ['core', 'storage'],
  lessons: ['core', 'lessons'],
  app: ['core', 'series', 'drawings', 'replay', 'themes', 'data', 'storage', 'lessons', 'app'],
  components: [
    'core',
    'series',
    'drawings',
    'replay',
    'themes',
    'data',
    'storage',
    'lessons',
    'app',
    'components',
  ],
  next: [
    'core',
    'series',
    'drawings',
    'replay',
    'themes',
    'data',
    'storage',
    'lessons',
    'app',
    'components',
    'next',
  ],
};

const LIB_ELEMENTS = new Set([
  'core',
  'series',
  'drawings',
  'replay',
  'themes',
  'data',
  'storage',
  'lessons',
  'app',
]);
const UI_ELEMENTS = new Set(['components', 'next']);
/** Packages that must never be imported from framework-agnostic lib code. */
const FRAMEWORK_PACKAGES = ['react', 'react-dom', 'next', 'zustand'];

/** Returns { element, rest } for an absolute path inside src/, else null. */
function classify(absPath) {
  const idx = absPath.lastIndexOf(SRC);
  if (idx === -1) return null;
  const parts = absPath.slice(idx + SRC.length).split(path.sep);
  if (parts[0] === 'lib' && parts[1] && LIB_ELEMENTS.has(parts[1])) {
    return { element: parts[1], rest: parts.slice(2) };
  }
  if (parts[0] === 'components') return { element: 'components', rest: parts.slice(1) };
  if (parts[0] === 'app') return { element: 'next', rest: parts.slice(1) };
  return null;
}

function resolveImport(source, fromFile) {
  if (source.startsWith('@/')) {
    const idx = fromFile.lastIndexOf(SRC);
    if (idx === -1) return null;
    return path.join(fromFile.slice(0, idx + SRC.length), source.slice(2));
  }
  if (source.startsWith('.')) return path.resolve(path.dirname(fromFile), source);
  return null;
}

function isBarrel(rest) {
  return rest.length === 0 || (rest.length === 1 && /^index(\.tsx?)?$/.test(rest[0]));
}

const rule = {
  meta: {
    type: 'problem',
    docs: { description: 'Enforce inward-only dependencies between architectural layers' },
    schema: [],
    messages: {
      layer: "Layer violation: '{{from}}' must not import from '{{to}}' ({{source}}).",
      framework: "Framework-agnostic lib code ('{{from}}') must not import '{{source}}'.",
      barrel:
        "UI code must import lib modules through their barrel '@/lib/{{to}}', not '{{source}}'.",
    },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();
    const self = classify(filename);
    if (!self) return {};

    function check(node, source) {
      if (typeof source !== 'string') return;
      if (LIB_ELEMENTS.has(self.element)) {
        const pkg = FRAMEWORK_PACKAGES.find((p) => source === p || source.startsWith(`${p}/`));
        if (pkg) {
          context.report({ node, messageId: 'framework', data: { from: self.element, source } });
          return;
        }
      }
      const resolved = resolveImport(source, filename);
      if (!resolved) return;
      const target = classify(resolved);
      if (!target) return;
      if (!ALLOWED[self.element].includes(target.element)) {
        context.report({
          node,
          messageId: 'layer',
          data: { from: self.element, to: target.element, source },
        });
        return;
      }
      if (
        UI_ELEMENTS.has(self.element) &&
        LIB_ELEMENTS.has(target.element) &&
        !isBarrel(target.rest)
      ) {
        context.report({ node, messageId: 'barrel', data: { to: target.element, source } });
      }
    }

    return {
      ImportDeclaration: (node) => check(node, node.source.value),
      ExportNamedDeclaration: (node) => node.source && check(node, node.source.value),
      ExportAllDeclaration: (node) => check(node, node.source.value),
      ImportExpression: (node) => node.source.type === 'Literal' && check(node, node.source.value),
    };
  },
};
export default rule;
