'use strict';
// Regenerates src/config/example-config.ts from the repo-level example YAML.
const fs = require('fs');
const path = require('path');

const source = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'extra-features',
  'highlighter.example.yaml'
);
const target = path.resolve(
  __dirname,
  '..',
  'src',
  'config',
  'example-config.ts'
);
const yaml = fs.readFileSync(source, 'utf8');
const escaped = yaml
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$\{/g, '\\${');
fs.writeFileSync(
  target,
  `// Generated from extra-features/highlighter.example.yaml. Keep the two in
// sync: \`example-config.spec.ts\` fails when they drift. Regenerate with
// \`npm run sync-example -w @mongodb-js/compass-highlighter\`.
export const EXAMPLE_CONFIG_YAML = \`${escaped}\`;
`
);
console.log('Wrote', path.relative(process.cwd(), target));
