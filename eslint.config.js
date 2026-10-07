const globals = Object.fromEntries([
  'window', 'document', 'navigator', 'localStorage', 'location', 'crypto', 'console',
  'SpeechSynthesisUtterance', 'MediaRecorder', 'URL', 'Blob', 'FormData', 'Event',
  'EventTarget', 'DOMException', 'indexedDB', 'setTimeout', 'clearTimeout',
  'setInterval', 'clearInterval', 'performance', 'matchMedia', 'confirm',
  'process', 'Buffer', 'setImmediate', 'AbortController', 'structuredClone',
  'innerWidth', 'getComputedStyle', 'TextEncoder', 'TextDecoder', 'fetch', 'Request', 'Response', 'Headers', 'btoa', 'atob', 'Audio',
].map(name => [name, 'readonly']));

export default [
  { ignores: ['dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**', '.playwright-cli/**', '.playwright-trace/**', '.local/**', '.wrangler/**'] },
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-unreachable': 'error',
      'no-dupe-args': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-constant-condition': 'error',
      'no-async-promise-executor': 'error',
      'no-promise-executor-return': 'error',
      'eqeqeq': ['error', 'always'],
    },
  },
];
