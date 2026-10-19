import { lintWorkflow } from '../src/linter.js';
import type { Config } from '../src/config.js';
import type { Finding, N8nNode, N8nWorkflow } from '../src/types.js';

let seq = 0;

export function node(partial: Partial<N8nNode> & { type: string; name?: string }): N8nNode {
  seq++;
  return {
    id: `n${seq}`,
    name: partial.name ?? `Node ${seq}`,
    typeVersion: 1,
    position: [seq * 200, 0],
    parameters: {},
    ...partial,
  } as N8nNode;
}

export const trigger = (name = 'Every Hour') =>
  node({ name, type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, parameters: { rule: { interval: [{}] } } });

export const code = (name: string, jsCode = 'return $input.all();') =>
  node({ name, type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode } });

export const http = (name: string, extra: Partial<N8nNode> = {}, params: Record<string, unknown> = {}) =>
  node({
    name,
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    retryOnFail: true,
    maxTries: 3,
    parameters: { method: 'GET', url: 'https://api.acme-corp.io/v1/items', options: { timeout: 10000 }, ...params },
    ...extra,
  });

/** Chain nodes in order with main connections. */
export function chain(...nodes: N8nNode[]): N8nWorkflow['connections'] {
  const c: N8nWorkflow['connections'] = {};
  for (let i = 0; i < nodes.length - 1; i++) {
    c[nodes[i]!.name] = { main: [[{ node: nodes[i + 1]!.name, type: 'main', index: 0 }]] };
  }
  return c;
}

/** A tidy workflow: tagged, described, error workflow set, nodes chained from a trigger. */
export function workflow(nodes: N8nNode[], extra: Partial<N8nWorkflow> = {}): N8nWorkflow {
  return {
    name: 'Test workflow',
    description: 'Fixture for unit tests.',
    nodes,
    connections: chain(...nodes),
    settings: { executionOrder: 'v1', errorWorkflow: 'err1' },
    tags: [{ name: 'test' }],
    pinData: {},
    ...extra,
  };
}

export function lint(wf: N8nWorkflow, config: Config = {}): Finding[] {
  return lintWorkflow(wf, { file: 'wf.json', config });
}

export function only(findings: Finding[], ruleId: string): Finding[] {
  return findings.filter((f) => f.ruleId === ruleId);
}

/** Build strings at runtime so the repo never contains a scannable token. */
export const j = (...parts: string[]) => parts.join('');
