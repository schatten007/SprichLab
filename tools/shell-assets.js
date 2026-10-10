/** Static imports belong to the initial shell; genuinely dynamic feature entries load on demand. */
export function shellAssets(bundle) {
  const core = new Set();
  const visit = name => {
    if (core.has(name) || !bundle[name]) return;
    core.add(name);
    const item = bundle[name];
    if (item.type === 'chunk') {
      item.imports.forEach(visit);
      for (const css of item.viteMetadata?.importedCss ?? []) visit(css);
    }
  };
  Object.values(bundle).filter(item => item.type === 'chunk' && item.isEntry).forEach(item => visit(item.fileName));
  const html = String(bundle['index.html']?.source ?? '');
  for (const match of html.matchAll(/(?:src|href)="(?:\.\/)?([^"]+\.(?:js|css))"/g)) visit(match[1]);
  const code = Object.keys(bundle).filter(name => name !== 'sw.js' && /\.(js|css)$/.test(name));
  return { core: code.filter(name => core.has(name)), optional: code.filter(name => !core.has(name)) };
}
