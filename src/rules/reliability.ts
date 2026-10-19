import type { Rule } from '../types.js';
import {
  buildGraph,
  hasNodeErrorHandling,
  isErrorWorkflow,
  isRisky,
  isSticky,
  isTrigger,
  reachableNodes,
} from '../workflow.js';

const list = (names: string[], max = 4) =>
  names.slice(0, max).map((n) => `"${n}"`).join(', ') + (names.length > max ? `, and ${names.length - max} more` : '');

export const unhandledErrors: Rule = {
  meta: {
    id: 'reliability/unhandled-errors',
    category: 'reliability',
    defaultSeverity: 'warning',
    summary: 'Nodes that call external services, with no error workflow and no per-node error handling.',
    rationale:
      'HTTP calls, LLMs, and SaaS APIs fail: rate limits, timeouts, expired tokens. With no error workflow set and no `On Error` setting on the node, a failure stops the run silently and you find out when someone complains.',
    fix: 'Set **Settings → Error workflow** to a workflow that starts with an Error Trigger and alerts you, or set **On Error** on each risky node to "Continue (using error output)" and handle that branch.',
    fixable: 'no',
  },
  check(ctx) {
    const wf = ctx.workflow;
    if (wf.settings?.errorWorkflow || isErrorWorkflow(wf)) return;
    const risky = wf.nodes.filter((n) => !n.disabled && isRisky(n) && !hasNodeErrorHandling(n));
    if (!risky.length) return;
    ctx.report({
      pointer: wf.settings ? '/settings' : '',
      message: `No error workflow set, and ${risky.length} node(s) that call external services have no error handling: ${list(risky.map((n) => n.name))}.`,
      hint: 'Set settings.errorWorkflow, or set onError on those nodes.',
    });
  },
};

const HTTP = 'n8n-nodes-base.httpRequest';

export const httpResilience: Rule = {
  meta: {
    id: 'reliability/http-resilience',
    category: 'reliability',
    defaultSeverity: 'warning',
    summary: 'HTTP Request nodes without Retry On Fail or a timeout.',
    rationale:
      'Most HTTP failures are transient (a 502, a reset connection, a 429). One retry with a short wait fixes them. Without a timeout, a hung server holds the execution open until the instance-wide limit, if there is one.',
    fix: 'In the node\'s **Settings** turn on **Retry On Fail** (3 tries, 1–5 s wait is a sane start). In **Options** add **Timeout** (e.g. 30000 ms).',
    options: {
      requireRetry: { description: 'Report nodes without retryOnFail.', default: true },
      requireTimeout: { description: 'Report nodes without options.timeout.', default: true },
    },
    fixable: 'no',
  },
  check(ctx) {
    const needRetry = ctx.options.requireRetry !== false;
    const needTimeout = ctx.options.requireTimeout !== false;
    for (const node of ctx.workflow.nodes) {
      if (node.type !== HTTP || node.disabled) continue;
      const missing: string[] = [];
      if (needRetry && node.retryOnFail !== true) missing.push('retry on fail');
      const opts = (node.parameters?.options ?? {}) as Record<string, unknown>;
      if (needTimeout && opts.timeout === undefined) missing.push('timeout');
      if (!missing.length) continue;
      ctx.report({
        node,
        pointer: ctx.nodePointer(node),
        message: `HTTP Request "${node.name}" has no ${missing.join(' and no ')}.`,
        hint: 'Enable Retry On Fail in Settings and set Options → Timeout.',
      });
    }
  },
};

export const unreachableNode: Rule = {
  meta: {
    id: 'reliability/unreachable-node',
    category: 'reliability',
    defaultSeverity: 'warning',
    summary: 'Nodes no trigger can reach (orphaned or disconnected).',
    rationale:
      'A node with no path from a trigger never runs. It usually means a connection was deleted by accident, which silently drops a step (the "send confirmation email" that stopped happening).',
    fix: 'Reconnect the node, or delete it if it is left over.',
    fixable: 'no',
  },
  check(ctx) {
    const wf = ctx.workflow;
    if (!wf.nodes.some((n) => isTrigger(n) && !n.disabled)) return; // reliability/no-trigger covers this
    const g = buildGraph(wf);
    const reach = reachableNodes({ ...wf, nodes: wf.nodes.filter((n) => !n.disabled) }, g);
    for (const node of wf.nodes) {
      if (isSticky(node) || node.disabled || reach.has(node.name)) continue;
      const isolated = !g.out.has(node.name) && !g.inMain.has(node.name);
      ctx.report({
        node,
        pointer: ctx.nodePointer(node),
        message: isolated
          ? `"${node.name}" is not connected to anything.`
          : `"${node.name}" cannot be reached from any trigger.`,
        hint: 'Connect it or delete it.',
      });
    }
  },
};

export const disabledNode: Rule = {
  meta: {
    id: 'reliability/disabled-node',
    category: 'reliability',
    defaultSeverity: 'warning',
    summary: 'Disabled nodes left in the workflow.',
    rationale:
      'A disabled node passes data through untouched. Left in a production workflow it hides a skipped step, and it often marks debugging that was never cleaned up.',
    fix: 'Delete the node, or re-enable it. `--fix --fix-disabled` removes disabled nodes and wires their inputs straight to their outputs, which is what n8n already does at run time.',
    fixable: 'opt-in',
  },
  check(ctx) {
    for (const node of ctx.workflow.nodes) {
      if (!node.disabled || isSticky(node)) continue;
      ctx.report({
        node,
        pointer: `${ctx.nodePointer(node)}/disabled`,
        message: `"${node.name}" is disabled.`,
        hint: 'Remove it or enable it. If it is intentionally optional, say so in its notes and disable this rule there.',
        fixable: true,
      });
    }
  },
};

export const duplicateNodeName: Rule = {
  meta: {
    id: 'reliability/duplicate-node-name',
    category: 'reliability',
    defaultSeverity: 'error',
    summary: 'Two nodes with the same name.',
    rationale:
      'n8n keys connections and `$(\'Node\')` expressions by node name. Duplicate names (usually from hand-edited or merged JSON) make connections and expressions resolve to the wrong node, or fail on import.',
    fix: 'Rename one of the nodes and update any expressions that referenced it.',
    fixable: 'no',
  },
  check(ctx) {
    const seen = new Map<string, number>();
    for (const node of ctx.workflow.nodes) {
      const n = seen.get(node.name) ?? 0;
      seen.set(node.name, n + 1);
      if (n >= 1) {
        ctx.report({
          node,
          pointer: `${ctx.nodePointer(node)}/name`,
          message: `Node name "${node.name}" is used more than once.`,
          hint: 'Give every node a unique name.',
        });
      }
    }
  },
};

export const noTrigger: Rule = {
  meta: {
    id: 'reliability/no-trigger',
    category: 'reliability',
    defaultSeverity: 'warning',
    summary: 'Workflow with no enabled trigger node.',
    rationale:
      'Without a trigger the workflow can only be run by hand from the editor. That is fine for scratch work, but in a repo of production workflows it usually means the trigger was deleted or disabled.',
    fix: 'Add a trigger (Schedule, Webhook, an app trigger, or Execute Workflow Trigger for sub-workflows), or enable the disabled one.',
    fixable: 'no',
  },
  check(ctx) {
    const nodes = ctx.workflow.nodes.filter((n) => !isSticky(n));
    if (!nodes.length) return;
    const triggers = nodes.filter(isTrigger);
    if (triggers.some((t) => !t.disabled)) return;
    ctx.report({
      pointer: '/nodes',
      message: triggers.length
        ? `Every trigger is disabled (${list(triggers.map((t) => t.name))}); the workflow cannot start.`
        : 'Workflow has no trigger node.',
      hint: 'Add or enable a trigger.',
    });
  },
};

export const largeCodeNode: Rule = {
  meta: {
    id: 'reliability/large-code-node',
    category: 'reliability',
    defaultSeverity: 'warning',
    summary: 'Code nodes too big to review in the editor.',
    rationale:
      'Hundreds of lines in a Code node are untested, unreviewed, and invisible in diffs of the export (one escaped JSON string). Logic that size belongs in a sub-workflow, a small service, or at least several smaller nodes.',
    fix: 'Split the node, move shared logic into a sub-workflow, or move it into a versioned service you call over HTTP.',
    options: {
      maxLines: { description: 'Lines allowed in one Code node.', default: 150 },
      maxChars: { description: 'Characters allowed in one Code node.', default: 8000 },
    },
    fixable: 'no',
  },
  check(ctx) {
    const maxLines = Number(ctx.options.maxLines ?? 150);
    const maxChars = Number(ctx.options.maxChars ?? 8000);
    for (const node of ctx.workflow.nodes) {
      if (node.disabled) continue;
      for (const key of ['jsCode', 'pythonCode', 'functionCode']) {
        const code = node.parameters?.[key];
        if (typeof code !== 'string') continue;
        const lines = code.split('\n').length;
        if (lines > maxLines || code.length > maxChars) {
          ctx.report({
            node,
            pointer: `${ctx.nodePointer(node)}/parameters/${key}`,
            message: `Code node "${node.name}" is ${lines} lines / ${code.length} chars (limit ${maxLines} lines / ${maxChars} chars).`,
            hint: 'Split it or move the logic into a sub-workflow.',
          });
        }
      }
    }
  },
};

export const reliabilityRules: Rule[] = [
  unhandledErrors,
  httpResilience,
  unreachableNode,
  disabledNode,
  duplicateNodeName,
  noTrigger,
  largeCodeNode,
];
