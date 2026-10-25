import test from 'node:test';
import assert from 'node:assert/strict';
import { shellAssets } from '../tools/shell-assets.js';

test('the core budget includes entry, static dependencies and their CSS, but not lazy assessment code', () => {
  const chunk = (fileName, imports, isEntry = false, css = []) => ({ fileName, type: 'chunk', imports, isEntry, viteMetadata: { importedCss: new Set(css) } });
  const bundle = {
    'app.js': { ...chunk('app.js', ['state.js'], true, ['base.css']), dynamicImports: ['assessments.js'] },
    'state.js': chunk('state.js', [], false, ['state.css']),
    'assessments.js': chunk('assessments.js', ['state.js'], false, ['assessment.css']),
    'base.css': { type: 'asset' }, 'state.css': { type: 'asset' }, 'assessment.css': { type: 'asset' },
    'sw.js': { type: 'asset' },
    'index.html': { type: 'asset', source: '<script src="./app.js"></script><link href="./base.css" rel="stylesheet">' },
  };
  assert.deepEqual(shellAssets(bundle), { core: ['app.js', 'state.js', 'base.css', 'state.css'], optional: ['assessments.js', 'assessment.css'] });
});

test('HTML styles count in the budget even when a bundler omits CSS metadata', () => {
  const bundle = { 'app.js': { type: 'chunk', fileName: 'app.js', isEntry: true, imports: [] },
    'app.css': { type: 'asset' }, 'index.html': { source: '<link rel="stylesheet" href="./app.css">' } };
  assert.deepEqual(shellAssets(bundle).core, ['app.js', 'app.css']);
});
