/**
 * ESM-compatibility guard for the mocha test suite.
 *
 * This project runs its tests through `@babel/register`, which transpiles every
 * spec down to CommonJS at load time. That works for `import ... from ...` and
 * bare `require(...)`, but it CANNOT handle a handful of native-ESM-only
 * constructs. When one sneaks into a spec, mocha silently falls back to loading
 * the file as native ESM (bypassing babel) and dies with a cryptic
 * `require is not defined` / `exports is not defined` far from the real cause.
 *
 * This guard runs before any spec is loaded (it's wired in via `.mocharc.json`'s
 * `require`) and fails fast with a precise, actionable message instead.
 *
 * Forbidden in a mocha-loaded spec:
 *   - `import.meta`      (illegal in CJS output)
 *   - top-level `export` (module-scope export is illegal in CJS output)
 *   - top-level `await`  (require() cannot load an ESM graph with top-level await;
 *                         caught even when indented inside a try/if block)
 *
 * Standalone ESM utility scripts that legitimately use these belong in
 * `.mocharc.json`'s `ignore` list, not in the spec set.
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const TEST_DIR = path.join(__dirname);
const REPO_ROOT = path.join(__dirname, '..');

// Single source of truth for what is NOT a spec: .mocharc.json's ignore list.
function loadIgnoredPaths() {
  try {
    const rc = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, '.mocharc.json'), 'utf8'));
    const ignore = rc.ignore || rc.exclude || [];
    return new Set(
      (Array.isArray(ignore) ? ignore : [ignore]).map((p) => path.resolve(REPO_ROOT, p))
    );
  } catch (e) {
    return new Set();
  }
}

function listSpecFiles(dir, ignored, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listSpecFiles(full, ignored, acc);
    } else if (entry.name.endsWith('.js') && !ignored.has(full)) {
      // mocha's default glob only picks up *.js (not .cjs/.mjs) here, and dotfiles
      // like this guard are skipped by the extension check above anyway.
      acc.push(full);
    }
  }
  return acc;
}

function findViolations(file) {
  const code = fs.readFileSync(file, 'utf8');
  const violations = [];

  let ast;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['topLevelAwait', 'importMeta', 'classProperties', 'objectRestSpread'],
    });
  } catch (e) {
    return [{ line: e.loc ? e.loc.line : 0, msg: `failed to parse: ${e.message.split('\n')[0]}` }];
  }

  traverse(ast, {
    MetaProperty(p) {
      if (p.node.meta && p.node.meta.name === 'import' && p.node.property.name === 'meta') {
        violations.push({ line: p.node.loc.start.line, msg: 'uses `import.meta` (illegal after babel→CJS transpile)' });
      }
    },
    ExportNamedDeclaration(p) {
      violations.push({ line: p.node.loc.start.line, msg: 'has a top-level `export` (illegal in CJS output)' });
    },
    ExportDefaultDeclaration(p) {
      violations.push({ line: p.node.loc.start.line, msg: 'has a top-level `export default` (illegal in CJS output)' });
    },
    ExportAllDeclaration(p) {
      violations.push({ line: p.node.loc.start.line, msg: 'has a top-level `export * from` (illegal in CJS output)' });
    },
    AwaitExpression(p) {
      // getFunctionParent() is null only when the await is at module scope.
      if (p.getFunctionParent() === null) {
        violations.push({ line: p.node.loc.start.line, msg: 'has a top-level `await` (require() cannot load an ESM graph with top-level await)' });
      }
    },
  });

  return violations;
}

const ignored = loadIgnoredPaths();
const specs = listSpecFiles(TEST_DIR, ignored, []);
const offenders = [];

for (const file of specs) {
  const violations = findViolations(file);
  if (violations.length) offenders.push({ file, violations });
}

if (offenders.length) {
  const lines = [
    '',
    '  ✖ ESM-incompatibility detected in mocha spec file(s).',
    '',
    '  These tests run through @babel/register (transpiled to CommonJS). The',
    '  constructs below cannot survive that transpile, so mocha would fall back',
    '  to native-ESM loading and crash with a misleading error.',
    '',
  ];
  for (const { file, violations } of offenders) {
    lines.push(`    ${path.relative(REPO_ROOT, file)}`);
    for (const v of violations) {
      lines.push(`      - line ${v.line}: ${v.msg}`);
    }
  }
  lines.push('');
  lines.push('  Fix: use `import ... from ...` + bare synchronous `require(...)`/`__dirname`');
  lines.push('  (as the other specs do). If this file is a standalone ESM script and NOT a');
  lines.push('  test, add it to the "ignore" list in .mocharc.json.');
  lines.push('');
  process.stderr.write(lines.join('\n') + '\n');
  process.exit(1);
}
