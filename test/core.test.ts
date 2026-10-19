import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigError, globToRegExp, loadConfig, resolveRules } from '../src/config.js';
import { fixWorkflow, renameNode } from '../src/fix.js';
import { locatePointers, resolveLocation } from '../src/json-locate.js';
import { lintPaths, lintText } from '../src/linter.js';
import { rules } from '../src/rules/index.js';
import { findPatternSecrets, mask, shannonEntropy } from '../src/secrets.js';
import { code, http, lint, node, only, trigger, workflow } from './helpers.js';

describe('rule registry', () => {
  it('has unique ids with category prefixes and complete docs', () => {
    const ids = rules.map((r) => r.meta.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of rules) {
      expect(r.meta.id.startsWith(`${r.meta.category}/`)).toBe(true);
      expect(r.meta.summary && r.meta.rationale && r.meta.fix).toBeTruthy();
    }
  });
});

describe('inline disable', () => {
  it('disables every rule for a node with a bare marker', () => {
    const n = { ...http('HTTP Request1', { retryOnFail: false }, { url: 'http://api.acme-corp.io' }), notes: 'n8n-lint-disable' };
    expect(lint(workflow([trigger(), n])).filter((f) => f.nodeName === 'HTTP Request1')).toHaveLength(0);
  });
  it('disables only the listed rules', () => {
    const n = { ...http('HTTP Request1', {}, { url: 'http://api.acme-corp.io' }), notes: 'legacy box\nn8n-lint-disable security/insecure-http' };
    const f = lint(workflow([trigger(), n]));
    expect(only(f, 'security/insecure-http')).toHaveLength(0);
    expect(only(f, 'hygiene/default-node-name')).toHaveLength(1);
  });
  it('disables rules workflow-wide from a sticky note', () => {
    const sticky = node({ name: 'Lint', type: 'n8n-nodes-base.stickyNote', parameters: { content: 'n8n-lint-disable-workflow hygiene/default-node-name' } });
    expect(only(lint(workflow([trigger(), code('Code'), sticky])), 'hygiene/default-node-name')).toHaveLength(0);
  });
});

describe('config', () => {
  it('applies severity, options, and per-file overrides', () => {
    const r = resolveRules(
      {
        rules: { 'hygiene/default-node-name': 'off', 'reliability/large-code-node': ['error', { maxLines: 50 }] },
        overrides: [{ files: ['legacy/**'], rules: { 'security/insecure-http': 'off' } }],
      },
      'legacy/old.json',
    );
    expect(r.get('hygiene/default-node-name')!.severity).toBe('off');
    expect(r.get('reliability/large-code-node')).toEqual({ severity: 'error', options: { maxLines: 50 } });
    expect(r.get('security/insecure-http')!.severity).toBe('off');
    expect(resolveRules({ overrides: [{ files: ['legacy/**'], rules: { 'security/insecure-http': 'off' } }] }, 'prod/a.json').get('security/insecure-http')!.severity).toBe('warning');
  });
  it('rejects unknown rules and bad severities', () => {
    const dir = mkdtempSync(join(tmpdir(), 'n8nlint-'));
    const p = join(dir, '.n8nlintrc.json');
    writeFileSync(p, JSON.stringify({ rules: { 'security/nope': 'error' } }));
    expect(() => loadConfig(p)).toThrow(ConfigError);
    writeFileSync(p, JSON.stringify({ rules: { 'security/pin-data': 'loud' } }));
    expect(() => loadConfig(p)).toThrow(/invalid severity/);
  });
  it('matches globs', () => {
    expect(globToRegExp('workflows/**/*.json').test('workflows/a/b/c.json')).toBe(true);
    expect(globToRegExp('workflows/*.json').test('workflows/a/b.json')).toBe(false);
  });
});

describe('locations', () => {
  it('maps JSON pointers to line and column', () => {
    const text = '{\n  "nodes": [\n    { "name": "A" },\n    { "name": "B" }\n  ]\n}';
    const m = locatePointers(text);
    expect(m.get('/nodes/1/name')).toEqual({ line: 4, column: 15 });
    expect(resolveLocation(m, '/nodes/1/parameters/url')).toEqual({ line: 4, column: 5 });
  });
  it('points findings at the right line in a file', () => {
    const r = lintText(readFileSync('examples/bad-workflow.json', 'utf8'), 'examples/bad-workflow.json');
    const dup = only(r.findings, 'reliability/duplicate-node-name')[0]!;
    const lines = readFileSync('examples/bad-workflow.json', 'utf8').split('\n');
    expect(lines[dup.location.line - 1]).toContain('"name": "Format Reply"');
  });
});

describe('file handling', () => {
  it('lints array exports (n8n export:workflow --all) with indexed pointers', () => {
    const text = JSON.stringify([workflow([trigger(), code('Code')]), workflow([trigger(), code('Fine')])], null, 2);
    const r = lintText(text, 'all.json');
    expect(r.workflows).toHaveLength(2);
    expect(only(r.findings, 'hygiene/default-node-name')[0]!.pointer).toBe('/0/nodes/1/name');
  });
  it('reports invalid JSON and non-workflow files given explicitly', () => {
    expect(lintText('{ nope', 'x.json').error).toMatch(/invalid JSON/);
    expect(lintText('{"a":1}', 'x.json', { strict: true }).error).toMatch(/not an n8n workflow/);
    expect(lintText('{"a":1}', 'x.json').skipped).toBe(true);
  });
  it('walks directories and skips package.json and non-workflow JSON', () => {
    const files = lintPaths(['.'], { cwd: process.cwd() }).filter((r) => !r.skipped).map((r) => r.file);
    expect(files).toContain('examples/bad-workflow.json');
    expect(files).not.toContain('package.json');
    expect(files.some((f) => f.includes('node_modules'))).toBe(false);
  });
});

describe('--fix', () => {
  it('strips pinData', () => {
    const wf = workflow([trigger()], { pinData: { 'Every Hour': [{ json: { a: 1 } }] } });
    expect(fixWorkflow(wf).pinDataRemoved).toEqual(['Every Hour']);
    expect(wf.pinData).toEqual({});
  });
  it('removes disabled nodes only when asked, bridging their connections', () => {
    const t = trigger();
    const a = code('A');
    const d = { ...code('Debug'), disabled: true };
    const b = code('B');
    const wf = workflow([t, a, d, b]);
    fixWorkflow(wf);
    expect(wf.nodes).toHaveLength(4);
    const rep = fixWorkflow(wf, { disabled: true });
    expect(rep.nodesRemoved).toEqual(['Debug']);
    expect(wf.connections.A!.main![0]).toEqual([{ node: 'B', type: 'main', index: 0 }]);
    expect(wf.connections.Debug).toBeUndefined();
    expect(lint(wf).filter((f) => f.ruleId.startsWith('reliability/'))).toHaveLength(0);
  });
  it('renames default HTTP Request names and rewrites references', () => {
    const t = trigger();
    const h = http('HTTP Request1', {}, { method: 'POST', url: 'https://api.acme-corp.io/v1/x' });
    const c = code('Use', "return [{ json: { a: $('HTTP Request1').first().json, b: $node[\"HTTP Request1\"].json } }];");
    const wf = workflow([t, h, c]);
    const rep = fixWorkflow(wf, { names: true });
    expect(rep.renamed).toEqual([['HTTP Request1', 'POST api.acme-corp.io']]);
    expect(String(wf.nodes[2]!.parameters!.jsCode)).toContain("$('POST api.acme-corp.io')");
    expect(String(wf.nodes[2]!.parameters!.jsCode)).toContain('$node["POST api.acme-corp.io"]');
    expect(wf.connections['POST api.acme-corp.io']).toBeDefined();
    expect(wf.connections[t.name]!.main![0]![0]!.node).toBe('POST api.acme-corp.io');
  });
  it('renameNode leaves unrelated names alone', () => {
    const wf = workflow([trigger(), code('A', "$('AB').first()"), code('AB')]);
    renameNode(wf, 'A', 'Alpha');
    expect(wf.nodes[1]!.parameters!.jsCode).toBe("$('AB').first()");
  });
  it('rewrites the file through the CLI path without touching formatting style', () => {
    const dir = mkdtempSync(join(tmpdir(), 'n8nlint-fix-'));
    const p = join(dir, 'wf.json');
    writeFileSync(p, JSON.stringify(workflow([trigger()], { pinData: { 'Every Hour': [{ json: {} }] } }), null, 2) + '\n');
    const r = lintPaths([p], { cwd: dir });
    expect(only(r[0]!.findings, 'security/pin-data')).toHaveLength(1);
  });
});

describe('secrets helpers', () => {
  it('masks without revealing the value', () => {
    expect(mask('abcdefghijklmnop')).toBe('abcd…op (16 chars)');
    expect(mask('short')).toBe('****');
  });
  it('computes entropy', () => {
    expect(shannonEntropy('aaaa')).toBe(0);
    expect(shannonEntropy('abcd')).toBe(2);
  });
  it('skips placeholder URLs with credentials', () => {
    expect(findPatternSecrets('https://user:{{ $json.pw }}@host.io')).toHaveLength(0);
    expect(findPatternSecrets('https://user:YOUR_PASSWORD@host.io')).toHaveLength(0);
  });
});
