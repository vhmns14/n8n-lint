import { describe, expect, it } from 'vitest';
import { code, http, lint, node, only, trigger, workflow } from '../helpers.js';

describe('reliability/unhandled-errors', () => {
  const R = 'reliability/unhandled-errors';
  const noErr = { settings: { executionOrder: 'v1' as const } };
  it('flags risky nodes when no error workflow is set', () => {
    const f = only(lint(workflow([trigger(), http('Fetch'), code('Shape')], noErr)), R);
    expect(f).toHaveLength(1);
    expect(f[0]!.message).toContain('"Fetch"');
    expect(f[0]!.message).not.toContain('"Shape"');
  });
  it('counts LLM root nodes and SaaS nodes as risky', () => {
    const agent = node({ name: 'Agent', type: '@n8n/n8n-nodes-langchain.agent' });
    const sheets = node({ name: 'Sheet', type: 'n8n-nodes-base.googleSheets', typeVersion: 4.5 });
    expect(only(lint(workflow([trigger(), agent, sheets], noErr)), R)[0]!.message).toMatch(/2 node/);
  });
  it('passes with an error workflow set', () => {
    expect(only(lint(workflow([trigger(), http('Fetch')])), R)).toHaveLength(0);
  });
  it('passes when every risky node handles its own errors', () => {
    const a = http('A', { onError: 'continueErrorOutput' });
    const b = http('B', { continueOnFail: true });
    expect(only(lint(workflow([trigger(), a, b], noErr)), R)).toHaveLength(0);
  });
  it('does not ask an error workflow to have an error workflow', () => {
    const et = node({ name: 'Error Trigger', type: 'n8n-nodes-base.errorTrigger' });
    const tg = node({ name: 'Alert', type: 'n8n-nodes-base.telegram', typeVersion: 1.2 });
    expect(only(lint(workflow([et, tg], noErr)), R)).toHaveLength(0);
  });
});

describe('reliability/http-resilience', () => {
  const R = 'reliability/http-resilience';
  it('flags missing retry and missing timeout', () => {
    const f = only(lint(workflow([trigger(), http('Fetch', { retryOnFail: false }, { options: {} })])), R);
    expect(f).toHaveLength(1);
    expect(f[0]!.message).toBe('HTTP Request "Fetch" has no retry on fail and no timeout.');
  });
  it('flags only the missing part', () => {
    expect(only(lint(workflow([trigger(), http('Fetch', {}, { options: {} })])), R)[0]!.message).toMatch(/no timeout\.$/);
  });
  it('passes with both set, and can be relaxed', () => {
    expect(only(lint(workflow([trigger(), http('Fetch')])), R)).toHaveLength(0);
    const wf = workflow([trigger(), http('Fetch', {}, { options: {} })]);
    expect(only(lint(wf, { rules: { [R]: ['warning', { requireTimeout: false }] } }), R)).toHaveLength(0);
  });
});

describe('reliability/unreachable-node', () => {
  const R = 'reliability/unreachable-node';
  it('flags a node with no connections', () => {
    const wf = workflow([trigger(), code('A')]);
    wf.nodes.push(code('Lonely'));
    const f = only(lint(wf), R);
    expect(f).toHaveLength(1);
    expect(f[0]!.message).toMatch(/not connected to anything/);
  });
  it('flags a chain that no trigger reaches', () => {
    const t = trigger();
    const a = code('A');
    const b = code('B');
    const wf = workflow([t, a, b], { connections: { [a.name]: { main: [[{ node: b.name, type: 'main', index: 0 }]] } } });
    expect(only(lint(wf), R).map((f) => f.nodeName)).toEqual(['A', 'B']);
  });
  it('treats AI sub-nodes attached to a reachable agent as reachable', () => {
    const t = node({ name: 'Chat', type: '@n8n/n8n-nodes-langchain.chatTrigger' });
    const agent = node({ name: 'Agent', type: '@n8n/n8n-nodes-langchain.agent' });
    const model = node({ name: 'Model', type: '@n8n/n8n-nodes-langchain.lmChatOpenAi' });
    const wf = workflow([t, agent, model], {
      connections: {
        Chat: { main: [[{ node: 'Agent', type: 'main', index: 0 }]] },
        Model: { ai_languageModel: [[{ node: 'Agent', type: 'ai_languageModel', index: 0 }]] },
      },
    });
    expect(only(lint(wf), R)).toHaveLength(0);
  });
  it('ignores sticky notes', () => {
    const wf = workflow([trigger(), code('A')]);
    wf.nodes.push(node({ name: 'Readme', type: 'n8n-nodes-base.stickyNote', parameters: { content: 'hello' } }));
    expect(only(lint(wf), R)).toHaveLength(0);
  });
});

describe('reliability/disabled-node', () => {
  const R = 'reliability/disabled-node';
  it('flags disabled nodes', () => {
    expect(only(lint(workflow([trigger(), code('A', undefined), { ...code('B'), disabled: true }])), R)).toHaveLength(1);
  });
  it('passes with none disabled', () => {
    expect(only(lint(workflow([trigger(), code('A')])), R)).toHaveLength(0);
  });
});

describe('reliability/duplicate-node-name', () => {
  const R = 'reliability/duplicate-node-name';
  it('flags the second node with a repeated name', () => {
    const f = only(lint(workflow([trigger(), code('Same'), code('Same')])), R);
    expect(f).toHaveLength(1);
    expect(f[0]!.pointer).toBe('/nodes/2/name');
  });
  it('passes with unique names', () => {
    expect(only(lint(workflow([trigger(), code('A'), code('B')])), R)).toHaveLength(0);
  });
});

describe('reliability/no-trigger', () => {
  const R = 'reliability/no-trigger';
  it('flags a workflow with no trigger', () => {
    expect(only(lint(workflow([code('A'), code('B')])), R)[0]!.message).toBe('Workflow has no trigger node.');
  });
  it('flags when every trigger is disabled', () => {
    expect(only(lint(workflow([{ ...trigger(), disabled: true }, code('A')])), R)[0]!.message).toMatch(/disabled/);
  });
  it('recognises webhook, cron, app triggers, and sub-workflow triggers', () => {
    for (const type of ['n8n-nodes-base.webhook', 'n8n-nodes-base.cron', 'n8n-nodes-base.telegramTrigger', 'n8n-nodes-base.executeWorkflowTrigger', 'n8n-nodes-base.manualTrigger']) {
      expect(only(lint(workflow([node({ name: 'T', type }), code('A')])), R), type).toHaveLength(0);
    }
  });
});

describe('reliability/large-code-node', () => {
  const R = 'reliability/large-code-node';
  it('flags code over the line limit', () => {
    const src = Array.from({ length: 200 }, (_, i) => `const v${i} = ${i};`).join('\n');
    expect(only(lint(workflow([trigger(), code('Big', src)])), R)).toHaveLength(1);
  });
  it('respects configured limits', () => {
    const src = Array.from({ length: 20 }, (_, i) => `const v${i} = ${i};`).join('\n');
    const wf = workflow([trigger(), code('Small', src)]);
    expect(only(lint(wf), R)).toHaveLength(0);
    expect(only(lint(wf, { rules: { [R]: ['warning', { maxLines: 10 }] } }), R)).toHaveLength(1);
  });
});
