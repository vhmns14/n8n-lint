import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';

// ajv-draft-04 is CommonJS; load it the CommonJS way so types and runtime agree
const Ajv = createRequire(import.meta.url)('ajv-draft-04') as new (o: object) => { compile(s: object): ((d: unknown) => boolean) & { errors?: unknown } };
const CLI = resolve('dist/cli.js');
const run = (args: string[], cwd = process.cwd()) => {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
};

beforeAll(() => {
  // the CLI is tested as shipped
  execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '-p', 'tsconfig.build.json']);
});

describe('CLI', () => {
  it('prints the bad example report (snapshot) and exits 1', () => {
    const r = run(['examples/bad-workflow.json']);
    expect(r.code).toBe(1);
    expect(r.stdout).toMatchSnapshot();
  });

  it('exits 0 on the good example', () => {
    const r = run(['examples/good-workflow.json']);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/no problems/);
  });

  it('honours --fail-on', () => {
    expect(run(['examples/bad-workflow.json', '--fail-on', 'none']).code).toBe(0);
    // real workflows only have warnings and info
    expect(run(['test/fixtures/real', '--fail-on', 'error']).code).toBe(0);
    expect(run(['test/fixtures/real', '--fail-on', 'warning']).code).toBe(1);
  });

  it('returns 2 on usage, config, and read errors', () => {
    expect(run(['--format', 'xml']).code).toBe(2);
    expect(run(['does-not-exist']).code).toBe(2);
    expect(run(['--rule', 'nope=off', 'examples']).code).toBe(2);
    expect(run(['package.json']).code).toBe(2);
  });

  it('emits JSON with a summary', () => {
    const out = JSON.parse(run(['examples/bad-workflow.json', '-f', 'json']).stdout);
    expect(out.summary).toMatchObject({ errors: 7, workflows: 1 });
    expect(out.results[0].findings[0]).toHaveProperty('docsUrl');
  });

  it('emits GitHub annotations', () => {
    const out = run(['examples/bad-workflow.json', '-f', 'github']).stdout;
    expect(out).toMatch(/^::error file=examples\/bad-workflow.json,line=\d+,col=\d+,title=n8n-lint security\/hardcoded-secret::/m);
    expect(out).toMatch(/^::notice file=/m);
  });

  it('writes valid SARIF 2.1.0', () => {
    const dir = mkdtempSync(join(tmpdir(), 'n8nlint-sarif-'));
    const file = join(dir, 'out.sarif');
    run(['examples', 'test/fixtures/real', '--sarif', file, '--fail-on', 'none']);
    const sarif = JSON.parse(readFileSync(file, 'utf8'));
    const ajv = new Ajv({ allErrors: true, strict: false, logger: false });
    const validate = ajv.compile(JSON.parse(readFileSync('test/fixtures/sarif-schema-2.1.0.json', 'utf8')));
    expect(validate(sarif), JSON.stringify(validate.errors, null, 2)).toBe(true);
    expect(sarif.runs[0].results.length).toBeGreaterThan(20);
    const rule = sarif.runs[0].tool.driver.rules.find((r: { id: string }) => r.id === 'security/hardcoded-secret');
    expect(rule.properties['security-severity']).toBe('8.0');
    for (const r of sarif.runs[0].results) expect(r.locations[0].physicalLocation.region.startLine).toBeGreaterThan(0);
  });

  it('--fix strips pinData and reports what is left', () => {
    const dir = mkdtempSync(join(tmpdir(), 'n8nlint-fix-'));
    copyFileSync('examples/bad-workflow.json', join(dir, 'bad.json'));
    const r = run(['bad.json', '--fix', '--fix-disabled', '--fix-names'], dir);
    expect(r.stderr).toMatch(/removed pinData/);
    expect(r.stderr).toMatch(/removed disabled node "Debug Logger"/);
    expect(r.stderr).toMatch(/renamed "HTTP Request1" → "POST crm.acme-corp.io"/);
    const fixed = JSON.parse(readFileSync(join(dir, 'bad.json'), 'utf8'));
    expect(fixed.pinData).toEqual({});
    expect(fixed.nodes.some((n: { name: string }) => n.name === 'Debug Logger')).toBe(false);
    expect(r.stdout).not.toMatch(/security\/pin-data|reliability\/disabled-node/);
  });

  it('lists rules', () => {
    const out = run(['--list-rules']).stdout;
    expect(out.trim().split('\n')).toHaveLength(17);
  });
});
