import { describe, expect, it } from 'vitest';
import { code, http, lint, node, only, trigger, workflow } from '../helpers.js';

describe('hygiene/default-node-name', () => {
  const R = 'hygiene/default-node-name';
  it('flags "HTTP Request1", "Code", and "If"', () => {
    const wf = workflow([trigger(), http('HTTP Request1'), code('Code'), node({ name: 'If', type: 'n8n-nodes-base.if', typeVersion: 2 })]);
    expect(only(lint(wf), R).map((f) => f.nodeName)).toEqual(['HTTP Request1', 'Code', 'If']);
  });
  it('lets a lone trigger keep its default name but not a numbered copy', () => {
    const a = node({ name: 'Webhook', type: 'n8n-nodes-base.webhook', parameters: { authentication: 'headerAuth' } });
    const b = node({ name: 'Webhook1', type: 'n8n-nodes-base.webhook', parameters: { authentication: 'headerAuth' } });
    expect(only(lint(workflow([a, code('Run')])), R)).toHaveLength(0);
    expect(only(lint(workflow([b, code('Run')])), R)).toHaveLength(1);
  });
  it('passes descriptive names', () => {
    expect(only(lint(workflow([trigger(), http('Fetch invoices'), code('Shape rows')])), R)).toHaveLength(0);
  });
});

describe('hygiene/missing-metadata', () => {
  const R = 'hygiene/missing-metadata';
  it('flags no description and no tags', () => {
    const f = only(lint(workflow([trigger()], { description: undefined, tags: [] })), R);
    expect(f[0]!.message).toMatch(/no description \(or sticky note\) and no tags/);
  });
  it('accepts a sticky note as documentation', () => {
    const sticky = node({ name: 'About', type: 'n8n-nodes-base.stickyNote', parameters: { content: '## What this does\nPulls invoices nightly.' } });
    expect(only(lint(workflow([trigger(), sticky], { description: undefined })), R)).toHaveLength(0);
  });
  it('accepts string tags and tag objects', () => {
    expect(only(lint(workflow([trigger()], { tags: ['prod'] })), R)).toHaveLength(0);
  });
});

describe('hygiene/outdated-type-version', () => {
  const R = 'hygiene/outdated-type-version';
  it('flags a node a major version behind', () => {
    const f = only(lint(workflow([trigger(), http('Old', { typeVersion: 3 })])), R);
    expect(f[0]!.message).toBe('"Old" uses httpRequest v3; latest is v4.5.');
  });
  it('ignores minor drift by default but reports it at level "minor"', () => {
    const wf = workflow([trigger(), http('Fetch', { typeVersion: 4.2 })]);
    expect(only(lint(wf), R)).toHaveLength(0);
    expect(only(lint(wf, { rules: { [R]: ['info', { level: 'minor' }] } }), R)).toHaveLength(2); // schedule trigger 1.2 too
  });
  it('ignores node types without a known latest version', () => {
    expect(only(lint(workflow([trigger(), node({ name: 'X', type: 'n8n-nodes-community.thing', typeVersion: 1 })])), R)).toHaveLength(0);
  });
});

describe('hygiene/deprecated-node', () => {
  const R = 'hygiene/deprecated-node';
  it('flags Function and Cron nodes', () => {
    const cron = node({ name: 'Nightly', type: 'n8n-nodes-base.cron' });
    const fn = node({ name: 'Transform', type: 'n8n-nodes-base.function', parameters: { functionCode: 'return items;' } });
    expect(only(lint(workflow([cron, fn])), R).map((f) => f.nodeName)).toEqual(['Nightly', 'Transform']);
  });
  it('passes Code and Schedule Trigger', () => {
    expect(only(lint(workflow([trigger(), code('Transform')])), R)).toHaveLength(0);
  });
});
