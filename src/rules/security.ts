import {
  findCodeAssignments,
  findPatternSecrets,
  isHighEntropySecret,
  looksLikePlaceholder,
  mask,
  SECRET_KEY,
} from '../secrets.js';
import type { N8nNode, Rule } from '../types.js';
import { isExpression, isSticky, stringLeaves } from '../workflow.js';

/** Header/query/body parameter names that carry credentials. */
export const AUTH_PARAM_NAME =
  /^(authorization|proxy-authorization|x-api-key|api[-_]?key|apikey|x-auth-token|auth[-_]?token|access[-_]?token|token|password|passwd|secret|client[-_]?secret|private[-_]?key|key)$/i;

const CODE_KEYS = new Set(['jsCode', 'pythonCode', 'functionCode', 'code']);
const NON_SECRET_KEYS = new Set(['authentication', 'genericAuthType', 'nodeCredentialType', 'authType']);

/** {name, value} pairs inside a node's parameters, wherever n8n put them. */
export function nameValuePairs(
  node: N8nNode,
  base: string,
): Array<{ name: string; value: unknown; pointer: string }> {
  const out: Array<{ name: string; value: unknown; pointer: string }> = [];
  const walk = (v: unknown, ptr: string) => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${ptr}/${i}`));
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (typeof o.name === 'string' && 'value' in o) out.push({ name: o.name, value: o.value, pointer: `${ptr}/value` });
      for (const [k, x] of Object.entries(o)) walk(x, `${ptr}/${k.replace(/~/g, '~0').replace(/\//g, '~1')}`);
    }
  };
  walk(node.parameters ?? {}, `${base}/parameters`);
  return out;
}

function authPairs(node: N8nNode, base: string) {
  return nameValuePairs(node, base).filter(
    (p) =>
      AUTH_PARAM_NAME.test(p.name) &&
      typeof p.value === 'string' &&
      p.value.trim().length >= 6 &&
      !isExpression(p.value) &&
      !looksLikePlaceholder(p.value),
  );
}

export const hardcodedSecret: Rule = {
  meta: {
    id: 'security/hardcoded-secret',
    category: 'security',
    defaultSeverity: 'error',
    summary: 'API keys, tokens, and passwords written into node parameters or Code nodes.',
    rationale:
      'Workflow exports get committed to git, pasted into forums, and shared as templates. Anything typed into a parameter travels with the file. n8n credentials are stored encrypted and are never part of an export, so a secret in a parameter is the one place it leaks.',
    fix:
      'Rotate the key first: assume it is already public. Then move it into an n8n credential (Header Auth, a service credential, or a Custom Auth credential) and select that credential on the node. In Code nodes, read values from an earlier node or `$env` (when `N8N_BLOCK_ENV_ACCESS_IN_NODE` allows it) instead of literals.',
    options: {
      minEntropy: { description: 'Shannon entropy (bits/char) a value under a secret-looking key must reach to be reported.', default: 3.5 },
    },
    fixable: 'no',
  },
  check(ctx) {
    const minEntropy = Number(ctx.options.minEntropy ?? 3.5);
    ctx.workflow.nodes.forEach((node) => {
      const base = ctx.nodePointer(node);
      // values in auth-named header/query params are reported by security/embedded-credentials
      const skip = new Set(authPairs(node, base).map((p) => p.pointer));
      const leaves = stringLeaves(node.parameters ?? {}, `${base}/parameters`, 'parameters');
      if (typeof node.notes === 'string') leaves.push({ value: node.notes, pointer: `${base}/notes`, key: 'notes', path: ['notes'] });
      for (const leaf of leaves) {
        if (skip.has(leaf.pointer)) continue;
        const where = isSticky(node) ? 'sticky note' : `\`${leaf.path.filter((p) => !/^\d+$/.test(p)).join('.') || leaf.key}\``;
        const hit =
          findPatternSecrets(leaf.value)[0] ??
          (CODE_KEYS.has(leaf.key) ? findCodeAssignments(leaf.value, minEntropy)[0] : undefined);
        if (hit) {
          ctx.report({
            node,
            pointer: leaf.pointer,
            message: `${hit.label[0]!.toUpperCase()}${hit.label.slice(1)} in ${where} of "${node.name}" (${mask(hit.match)}).`,
            hint: 'Rotate it, then move it into an n8n credential and reference that instead.',
          });
          continue;
        }
        if (NON_SECRET_KEYS.has(leaf.key) || CODE_KEYS.has(leaf.key)) continue;
        const literal = leaf.value.startsWith('=') && !leaf.value.includes('{{') ? leaf.value.slice(1) : leaf.value;
        if (
          SECRET_KEY.test(leaf.key) &&
          /\d/.test(literal) &&
          /[A-Za-z]/.test(literal) &&
          isHighEntropySecret(literal, minEntropy)
        ) {
          ctx.report({
            node,
            pointer: leaf.pointer,
            message: `High-entropy value under secret-looking key ${where} of "${node.name}" (${mask(literal)}).`,
            hint: 'If this is a real secret, rotate it and move it into an n8n credential.',
          });
        }
      }
    });
  },
};

const WEBHOOK_TYPES = new Set(['n8n-nodes-base.webhook', '@n8n/n8n-nodes-langchain.mcpTrigger']);

export const webhookNoAuth: Rule = {
  meta: {
    id: 'security/webhook-no-auth',
    category: 'security',
    defaultSeverity: 'warning',
    summary: 'Webhook (or MCP Server) trigger with authentication set to "None".',
    rationale:
      'A production webhook URL is reachable by anyone who learns it, and the path is often guessable or leaks through logs and browser history. Without authentication, any caller can start the workflow, burn API credits, or inject data.',
    fix:
      'Set **Authentication** to Header Auth, Basic Auth, or JWT Auth and create the matching credential. If the caller signs its requests instead (Stripe, GitHub, Telegram secret token), verify the signature in the first node after the trigger and disable this rule for that node with a note: `n8n-lint-disable security/webhook-no-auth`.',
    fixable: 'no',
  },
  check(ctx) {
    for (const node of ctx.workflow.nodes) {
      if (!WEBHOOK_TYPES.has(node.type) || node.disabled) continue;
      const auth = node.parameters?.authentication;
      if (auth === undefined || auth === 'none') {
        ctx.report({
          node,
          pointer: auth === undefined ? `${ctx.nodePointer(node)}/parameters` : `${ctx.nodePointer(node)}/parameters/authentication`,
          message: `Webhook "${node.name}" accepts unauthenticated requests${node.parameters?.path ? ` on /${String(node.parameters.path).replace(/^\//, '')}` : ''}.`,
          hint: 'Use Header Auth, Basic Auth, or JWT Auth, or verify the sender\'s signature right after the trigger.',
        });
      }
    }
  },
};

export const pinData: Rule = {
  meta: {
    id: 'security/pin-data',
    category: 'security',
    defaultSeverity: 'warning',
    summary: 'Pinned test data left in the export.',
    rationale:
      'Pinned data is a copy of real node output saved for testing: customer emails, chat messages, API responses, sometimes tokens. It ships inside the exported JSON and is easy to forget.',
    fix: 'Unpin the data in the editor before exporting, or run `n8n-lint --fix`, which removes `pinData`.',
    fixable: 'yes',
  },
  check(ctx) {
    const pd = ctx.workflow.pinData;
    if (!pd || typeof pd !== 'object') return;
    const names = Object.keys(pd).filter((k) => Array.isArray(pd[k]) ? pd[k]!.length > 0 : pd[k] != null);
    if (!names.length) return;
    const items = names.reduce((n, k) => n + (Array.isArray(pd[k]) ? pd[k]!.length : 1), 0);
    ctx.report({
      pointer: '/pinData',
      message: `Pinned data on ${names.length} node(s) (${names.slice(0, 3).map((n) => `"${n}"`).join(', ')}${names.length > 3 ? ', …' : ''}), ${items} item(s) in total.`,
      hint: 'Run with --fix to strip pinData.',
      fixable: true,
    });
  },
};

const PRIVATE_HOST =
  /^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|[^.]+|.+\.(local|internal|lan|localhost|svc|cluster\.local))$/i;

export const insecureHttp: Rule = {
  meta: {
    id: 'security/insecure-http',
    category: 'security',
    defaultSeverity: 'warning',
    summary: 'Requests to plain http:// URLs on public hosts.',
    rationale:
      'Plain HTTP sends headers (including API keys from credentials) and bodies in clear text across every network hop. Calls to local or Docker-internal hosts are a different matter and are skipped.',
    fix: 'Switch the URL to https://. If the service has no TLS, put it behind a reverse proxy that does, or keep it on a private network.',
    options: {
      allowPrivate: { description: 'Skip localhost, private IP ranges, single-label Docker hostnames, and .local/.internal names.', default: true },
      allowHosts: { description: 'Extra hostnames that may use http://.', default: [] },
    },
    fixable: 'no',
  },
  check(ctx) {
    const allowPrivate = ctx.options.allowPrivate !== false;
    const allowHosts = new Set(((ctx.options.allowHosts as string[]) ?? []).map((h) => h.toLowerCase()));
    for (const node of ctx.workflow.nodes) {
      if (node.disabled || isSticky(node)) continue;
      for (const leaf of stringLeaves(node.parameters ?? {}, `${ctx.nodePointer(node)}/parameters`, 'parameters')) {
        if (!/url$/i.test(leaf.key)) continue;
        const m = /^=?\s*http:\/\/(?:[^@/\s]*@)?(\[[^\]]+\]|[^/:?#\s{]+)/i.exec(leaf.value);
        if (!m) continue;
        const host = m[1]!.toLowerCase();
        if (allowHosts.has(host) || (allowPrivate && PRIVATE_HOST.test(host))) continue;
        ctx.report({
          node,
          pointer: leaf.pointer,
          message: `"${node.name}" calls http://${host} without TLS.`,
          hint: 'Use https://.',
        });
      }
    }
  },
};

const JS_DANGER: Array<[RegExp, string]> = [
  [/\beval\s*\(/, 'eval()'],
  [/\bnew\s+Function\s*\(/, 'new Function()'],
  [/\brequire\s*\(\s*['"`](?:node:)?child_process['"`]\s*\)|\bfrom\s+['"`](?:node:)?child_process['"`]/, "require('child_process')"],
  [/\brequire\s*\(\s*['"`](?:node:)?fs(?:\/promises)?['"`]\s*\)|\bfrom\s+['"`](?:node:)?fs(?:\/promises)?['"`]/, "require('fs')"],
  [/\brequire\s*\(\s*['"`](?:node:)?(?:vm|net|dgram|worker_threads)['"`]\s*\)/, 'require of vm/net/worker_threads'],
  [/\bprocess\.(?:binding|dlopen|kill)\s*\(/, 'process internals'],
];
const PY_DANGER: Array<[RegExp, string]> = [
  [/\b(?:eval|exec)\s*\(/, 'eval()/exec()'],
  [/\bimport\s+subprocess\b|\bfrom\s+subprocess\s+import\b/, 'subprocess'],
  [/\bos\.(?:system|popen|exec\w*|spawn\w*)\s*\(/, 'os.system/popen'],
  [/\b__import__\s*\(/, '__import__()'],
];

function stripComments(code: string, python: boolean): string {
  if (python) return code.replace(/^\s*#.*$/gm, '');
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

export const dangerousCode: Rule = {
  meta: {
    id: 'security/dangerous-code',
    category: 'security',
    defaultSeverity: 'error',
    summary: 'Code nodes using eval, child_process, or filesystem access; Execute Command nodes.',
    rationale:
      'Code nodes run on the n8n host. `eval` on workflow data turns any webhook payload into code execution; `child_process` and `fs` reach the server itself. n8n blocks most of these unless `NODE_FUNCTION_ALLOW_BUILTIN` is set, so finding them usually means the instance was opened up to make them work.',
    fix: 'Parse data with `JSON.parse` instead of `eval`. Move shell or file work out of the workflow into a dedicated service you call over HTTP, or use the built-in Read/Write Files node with a restricted path.',
    fixable: 'no',
  },
  check(ctx) {
    for (const node of ctx.workflow.nodes) {
      if (node.disabled) continue;
      const base = ctx.nodePointer(node);
      if (node.type === 'n8n-nodes-base.executeCommand') {
        ctx.report({
          node,
          pointer: `${base}/parameters`,
          message: `Execute Command node "${node.name}" runs shell commands on the n8n host.`,
          hint: 'Keep shell work out of workflows, or make sure no input reaches the command line.',
        });
        continue;
      }
      const p = node.parameters ?? {};
      for (const key of ['jsCode', 'functionCode', 'pythonCode', 'code']) {
        const code = p[key];
        if (typeof code !== 'string') continue;
        const python = key === 'pythonCode' || p.language === 'python' || p.language === 'pythonNative';
        const body = stripComments(code, python);
        for (const [re, label] of python ? PY_DANGER : JS_DANGER) {
          if (re.test(body)) {
            ctx.report({
              node,
              pointer: `${base}/parameters/${key}`,
              message: `Code node "${node.name}" uses ${label}.`,
              hint: 'Avoid dynamic code execution and host access in workflow code.',
            });
          }
        }
      }
    }
  },
};

export const embeddedCredentials: Rule = {
  meta: {
    id: 'security/embedded-credentials',
    category: 'security',
    defaultSeverity: 'error',
    summary: 'Credentials typed into headers/query params, or credential data inlined in the export.',
    rationale:
      'n8n exports reference credentials by id and name only; the secret stays encrypted in the instance. An `Authorization` header or `api_key` query parameter typed by hand, or a `credentials` block carrying secret fields, bypasses that and ships the secret with the file.',
    fix: 'Create a credential (Header Auth, Query Auth, Basic Auth, or the service\'s own type), set **Authentication** on the node to use it, and delete the hand-typed parameter.',
    fixable: 'no',
  },
  check(ctx) {
    for (const node of ctx.workflow.nodes) {
      const base = ctx.nodePointer(node);
      for (const [type, ref] of Object.entries(node.credentials ?? {})) {
        if (!ref || typeof ref !== 'object') continue;
        const extra = Object.keys(ref).filter((k) => !['id', 'name', '__aiGatewayManaged'].includes(k));
        if (extra.length) {
          ctx.report({
            node,
            pointer: `${base}/credentials/${type}`,
            message: `"${node.name}" carries credential data inline (${type}: ${extra.join(', ')}). Exports should only reference credentials by id and name.`,
            hint: 'Remove the inline fields and reference a stored n8n credential.',
          });
        }
      }
      for (const pair of authPairs(node, base)) {
        ctx.report({
          node,
          pointer: pair.pointer,
          message: `"${node.name}" sends "${pair.name}" as a hand-typed parameter (${mask(String(pair.value))}) instead of a credential.`,
          hint: 'Use a Header Auth / Query Auth credential and remove the literal value.',
        });
      }
    }
  },
};

export const securityRules: Rule[] = [hardcodedSecret, webhookNoAuth, pinData, insecureHttp, dangerousCode, embeddedCredentials];
