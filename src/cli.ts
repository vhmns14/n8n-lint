#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { type Config, ConfigError, findConfig, loadConfig } from './config.js';
import { detectIndent, fixWorkflow } from './fix.js';
import { count, format, type Format, FORMATS, formatSarif, VERSION } from './formatters/index.js';
import { lintPaths } from './linter.js';
import { rules } from './rules/index.js';
import { SEVERITY_RANK, type Severity } from './types.js';

const HELP = `n8n-lint ${VERSION}
Static checks for n8n workflow JSON exports.

Usage
  n8n-lint [paths...] [options]        paths default to "."

Options
  -f, --format <name>    pretty (default), json, sarif, github
  -o, --output <file>    write the report to a file instead of stdout
      --sarif <file>     also write a SARIF report to <file>
      --fail-on <level>  exit 1 when a finding is at least: error (default), warning, info, none
  -c, --config <file>    config file (default: nearest .n8nlintrc.json)
      --rule <id=level>  override a rule, e.g. --rule hygiene/default-node-name=off (repeatable)
      --fix              apply safe fixes in place (strips pinData)
      --fix-disabled     with --fix: also remove disabled nodes, bridging their connections
      --fix-names        with --fix: rename default-named HTTP Request nodes to "METHOD host"
      --list-rules       print all rules and exit
  -q, --quiet            only report errors
  -v, --version          print version
  -h, --help             print this help

Exit codes
  0 no findings at or above --fail-on
  1 findings at or above --fail-on
  2 usage, config, or read error
`;

function main(argv: string[]): number {
  let args;
  try {
    args = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        format: { type: 'string', short: 'f' },
        output: { type: 'string', short: 'o' },
        sarif: { type: 'string' },
        'fail-on': { type: 'string' },
        config: { type: 'string', short: 'c' },
        rule: { type: 'string', multiple: true },
        fix: { type: 'boolean' },
        'fix-disabled': { type: 'boolean' },
        'fix-names': { type: 'boolean' },
        'list-rules': { type: 'boolean' },
        quiet: { type: 'boolean', short: 'q' },
        version: { type: 'boolean', short: 'v' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (e) {
    process.stderr.write(`n8n-lint: ${(e as Error).message}\n\n${HELP}`);
    return 2;
  }
  const o = args.values;
  if (o.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (o.version) {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }
  if (o['list-rules']) {
    for (const r of rules) process.stdout.write(`${r.meta.id.padEnd(34)} ${r.meta.defaultSeverity.padEnd(8)} ${r.meta.summary}\n`);
    return 0;
  }

  const fmt = (o.format ?? 'pretty') as Format;
  if (!FORMATS.includes(fmt)) {
    process.stderr.write(`n8n-lint: unknown format "${fmt}" (use ${FORMATS.join(', ')})\n`);
    return 2;
  }

  const cwd = process.cwd();
  let config: Config = {};
  try {
    const cfgPath = o.config ? resolve(cwd, o.config) : findConfig(cwd);
    if (cfgPath) config = loadConfig(cfgPath);
  } catch (e) {
    process.stderr.write(`n8n-lint: ${e instanceof ConfigError ? e.message : (e as Error).message}\n`);
    return 2;
  }
  for (const r of o.rule ?? []) {
    const m = /^([a-z]+\/[a-z0-9-]+)=(error|warning|info|off)$/.exec(r);
    if (!m || !rules.some((x) => x.meta.id === m[1])) {
      process.stderr.write(`n8n-lint: bad --rule "${r}" (expected <rule-id>=<error|warning|info|off>)\n`);
      return 2;
    }
    config = { ...config, rules: { ...config.rules, [m[1]!]: m[2] as Severity } };
  }

  const failOn = (o['fail-on'] ?? config.failOn ?? 'error') as Severity | 'none';
  if (!['error', 'warning', 'info', 'none'].includes(failOn)) {
    process.stderr.write(`n8n-lint: --fail-on must be error, warning, info, or none\n`);
    return 2;
  }

  const paths = args.positionals.length ? args.positionals : ['.'];
  let results;
  try {
    results = lintPaths(paths, { config, cwd });
  } catch (e) {
    process.stderr.write(`n8n-lint: ${(e as Error).message}\n`);
    return 2;
  }

  if (o.fix) {
    for (const r of results) {
      if (!r.workflows || r.error) continue;
      const reports = r.workflows.map((wf) => fixWorkflow(wf, { pinData: true, disabled: !!o['fix-disabled'], names: !!o['fix-names'] }));
      const changed = reports.some((x) => x.pinDataRemoved.length || x.nodesRemoved.length || x.renamed.length);
      if (!changed) continue;
      const data = r.isArray ? r.workflows : r.workflows[0];
      const trailing = r.text?.endsWith('\n') ? '\n' : '';
      writeFileSync(resolve(cwd, r.file), JSON.stringify(data, null, detectIndent(r.text ?? '')) + trailing);
      for (const x of reports) {
        if (x.pinDataRemoved.length) process.stderr.write(`fixed ${r.file}: removed pinData (${x.pinDataRemoved.length} node(s))\n`);
        for (const n of x.nodesRemoved) process.stderr.write(`fixed ${r.file}: removed disabled node "${n}"\n`);
        for (const [a, b] of x.renamed) process.stderr.write(`fixed ${r.file}: renamed "${a}" → "${b}"\n`);
      }
    }
    // report what is left after fixing
    results = lintPaths(paths, { config, cwd });
  }

  if (o.quiet) for (const r of results) r.findings = r.findings.filter((f) => f.severity === 'error');

  const report = format(results, fmt);
  if (o.output) {
    mkdirSync(dirname(resolve(cwd, o.output)), { recursive: true });
    writeFileSync(resolve(cwd, o.output), report);
  } else {
    process.stdout.write(report);
  }
  if (o.sarif) {
    mkdirSync(dirname(resolve(cwd, o.sarif)), { recursive: true });
    writeFileSync(resolve(cwd, o.sarif), formatSarif(results));
  }

  const c = count(results);
  if (!c.files) process.stderr.write(`n8n-lint: no n8n workflow files found in ${paths.join(', ')}\n`);
  if (results.some((r) => r.error)) return 2;
  if (failOn === 'none') return 0;
  const threshold = SEVERITY_RANK[failOn];
  return results.some((r) => r.findings.some((f) => SEVERITY_RANK[f.severity] >= threshold)) ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
