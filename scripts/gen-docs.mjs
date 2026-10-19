// Generates docs/rules/*.md and the rule table in README.md from rule metadata.
// Run after `npm run build`: node scripts/gen-docs.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { rules } from '../dist/rules/index.js';

mkdirSync('docs/rules', { recursive: true });
const fixLabel = { yes: '`--fix`', 'opt-in': 'opt-in flag', no: '—' };

for (const r of rules) {
  const m = r.meta;
  const opts = m.options
    ? `\n## Options\n\n| Option | Default | Description |\n| --- | --- | --- |\n${Object.entries(m.options)
        .map(([k, v]) => `| \`${k}\` | \`${JSON.stringify(v.default)}\` | ${v.description} |`)
        .join('\n')}\n\n\`\`\`json\n{ "rules": { "${m.id}": ["${m.defaultSeverity}", { ${Object.entries(m.options)
        .map(([k, v]) => `"${k}": ${JSON.stringify(v.default)}`)
        .join(', ')} }] } }\n\`\`\`\n`
    : '';
  const body = `# ${m.id}

${m.summary}

- **Category:** ${m.category}
- **Default severity:** ${m.defaultSeverity}
- **Autofix:** ${fixLabel[m.fixable ?? 'no']}

## Why

${m.rationale}

## How to fix

${m.fix}
${opts}
## Disabling

For one node, add this line to the node's **Notes** (Settings → Notes):

\`\`\`
n8n-lint-disable ${m.id}
\`\`\`

For the whole project, in \`.n8nlintrc.json\`:

\`\`\`json
{ "rules": { "${m.id}": "off" } }
\`\`\`
`;
  writeFileSync(`docs/rules/${m.id.replace('/', '-')}.md`, body);
}

const table = [
  '| Rule | Default | Fix | What it catches |',
  '| --- | --- | --- | --- |',
  ...rules.map(
    (r) =>
      `| [\`${r.meta.id}\`](docs/rules/${r.meta.id.replace('/', '-')}.md) | ${r.meta.defaultSeverity} | ${
        r.meta.fixable === 'yes' ? '✓' : r.meta.fixable === 'opt-in' ? 'opt-in' : ''
      } | ${r.meta.summary} |`,
  ),
].join('\n');

const readme = readFileSync('README.md', 'utf8');
const next = readme.replace(/<!-- rules:start -->[\s\S]*<!-- rules:end -->/, `<!-- rules:start -->\n${table}\n<!-- rules:end -->`);
writeFileSync('README.md', next);
console.log(`wrote ${rules.length} rule docs and README table`);
