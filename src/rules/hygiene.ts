import type { Rule } from '../types.js';
import { DEFAULT_NAMES, DEPRECATED_TYPES, isSticky, isTrigger, LATEST_TYPE_VERSIONS, shortType, workflowTags } from '../workflow.js';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function isDefaultName(name: string, type: string, trigger: boolean): boolean {
  const def = DEFAULT_NAMES[type];
  if (!def) return false;
  const m = new RegExp(`^${escapeRe(def)}(\\d*)$`).exec(name);
  if (!m) return false;
  // a lone "Webhook" or "Schedule Trigger" is descriptive enough; "Webhook1" is not
  return m[1] !== '' || !trigger;
}

export const defaultNodeName: Rule = {
  meta: {
    id: 'hygiene/default-node-name',
    category: 'hygiene',
    defaultSeverity: 'info',
    summary: 'Nodes still named "HTTP Request1", "Code", "If".',
    rationale:
      'Node names show up in execution logs, error alerts, and `$(\'Node\')` expressions. "HTTP Request3 failed" tells nobody anything at 2 a.m.',
    fix: 'Rename the node after what it does ("Fetch invoice", "Is paid?"). `--fix --fix-names` renames HTTP Request nodes to METHOD + host and updates connections and expressions.',
    fixable: 'opt-in',
  },
  check(ctx) {
    for (const node of ctx.workflow.nodes) {
      if (isSticky(node)) continue;
      if (!isDefaultName(node.name, node.type, isTrigger(node))) continue;
      ctx.report({
        node,
        pointer: `${ctx.nodePointer(node)}/name`,
        message: `"${node.name}" still has its default name.`,
        hint: 'Name it after what it does.',
        fixable: node.type === 'n8n-nodes-base.httpRequest',
      });
    }
  },
};

export const missingMetadata: Rule = {
  meta: {
    id: 'hygiene/missing-metadata',
    category: 'hygiene',
    defaultSeverity: 'info',
    summary: 'Workflow without a description (or sticky note) or without tags.',
    rationale:
      'Tags are how you find workflows on an instance with fifty of them; a description or a sticky note is how the next person (often you) learns what it does and what it needs before touching it.',
    fix: 'Add tags in the editor header. Add a description in **Workflow settings**, or a sticky note explaining inputs, outputs, and required credentials.',
    options: {
      requireTags: { description: 'Report workflows without tags.', default: true },
      requireDescription: { description: 'Report workflows without a description or sticky note.', default: true },
    },
    fixable: 'no',
  },
  check(ctx) {
    const wf = ctx.workflow;
    const missing: string[] = [];
    const hasDescription =
      (typeof wf.description === 'string' && wf.description.trim() !== '') ||
      wf.nodes.some((n) => isSticky(n) && String(n.parameters?.content ?? '').trim().length > 20);
    if (ctx.options.requireDescription !== false && !hasDescription) missing.push('description (or sticky note)');
    if (ctx.options.requireTags !== false && workflowTags(wf).length === 0) missing.push('tags');
    if (!missing.length) return;
    ctx.report({
      pointer: wf.name !== undefined ? '/name' : '',
      message: `Workflow "${wf.name ?? '(unnamed)'}" has no ${missing.join(' and no ')}.`,
      hint: 'Document what it does and tag it.',
    });
  },
};

export const outdatedTypeVersion: Rule = {
  meta: {
    id: 'hygiene/outdated-type-version',
    category: 'hygiene',
    defaultSeverity: 'info',
    summary: 'Nodes pinned to an old typeVersion of a node that has a newer one.',
    rationale:
      'n8n keeps old node versions working but stops improving them. A major version behind usually means older parameter layouts and missing options (for example HTTP Request v1–3 lack pagination and the newer auth handling). Only node types with a known latest version are checked.',
    fix: 'Add a fresh copy of the node from the panel, copy the settings across, and delete the old one. Test it: major versions can change parameter names.',
    options: {
      level: { description: '"major" reports only nodes a whole major version behind; "minor" reports any older version.', default: 'major' },
    },
    fixable: 'no',
  },
  check(ctx) {
    const minor = ctx.options.level === 'minor';
    for (const node of ctx.workflow.nodes) {
      const latest = LATEST_TYPE_VERSIONS[node.type];
      const v = node.typeVersion;
      if (latest === undefined || typeof v !== 'number') continue;
      const behind = minor ? v < latest : Math.floor(v) < Math.floor(latest);
      if (!behind) continue;
      ctx.report({
        node,
        pointer: `${ctx.nodePointer(node)}/typeVersion`,
        message: `"${node.name}" uses ${shortType(node.type)} v${v}; latest is v${latest}.`,
        hint: 'Re-add the node at the current version and re-test.',
      });
    }
  },
};

export const deprecatedNode: Rule = {
  meta: {
    id: 'hygiene/deprecated-node',
    category: 'hygiene',
    defaultSeverity: 'warning',
    summary: 'Node types n8n has replaced (Function, Function Item, Cron, Interval, Start).',
    rationale: 'These nodes are hidden from the node panel and kept only so old workflows load. They get no fixes, and their behaviour differs from the replacements.',
    fix: 'Function / Function Item → Code. Cron / Interval → Schedule Trigger. Start → Manual Trigger.',
    fixable: 'no',
  },
  check(ctx) {
    for (const node of ctx.workflow.nodes) {
      const repl = DEPRECATED_TYPES[node.type];
      if (!repl) continue;
      ctx.report({
        node,
        pointer: `${ctx.nodePointer(node)}/type`,
        message: `"${node.name}" uses the deprecated ${shortType(node.type)} node; use ${repl} instead.`,
        hint: `Replace with ${repl}.`,
      });
    }
  },
};

export const hygieneRules: Rule[] = [defaultNodeName, missingMetadata, outdatedTypeVersion, deprecatedNode];
