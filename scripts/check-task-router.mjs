// Fails when a path in an AGENTS.md routing table does not exist or an AGENTS.md exceeds its line budget.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const files = [
  { file: 'AGENTS.md', budget: 150 },
  ...['app', 'core', 'db', 'ui'].map((p) => ({ file: `packages/${p}/AGENTS.md`, budget: 120 })),
];
let failed = false;

for (const { file, budget } of files) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n').length - 1;
  if (lines > budget) {
    console.error(`${file}: ${lines} lines, budget ${budget}`);
    failed = true;
  }
  if (file !== 'AGENTS.md' && readFileSync(join(dirname(file), 'CLAUDE.md'), 'utf8').trim() !== '@AGENTS.md') {
    console.error(`${dirname(file)}/CLAUDE.md must contain only @AGENTS.md`);
    failed = true;
  }
}

const root = readFileSync('AGENTS.md', 'utf8');
for (const row of root.split('\n').filter((l) => /^\|(?!\s*[-:]|\s*Task\s*\|)/.test(l))) {
  const cell = row.split('|')[2] ?? '';
  for (const [, path] of cell.matchAll(/`([^`]+)`/g)) {
    if (!/[./]/.test(path) || path.startsWith('packages/app/src/app/api/**') || path.includes('**')) continue;
    if (!existsSync(path)) {
      console.error(`AGENTS.md routes to missing path: ${path}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log('task router ok');
