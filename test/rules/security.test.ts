import { describe, expect, it } from 'vitest';
import { code, http, j, lint, node, only, trigger, workflow } from '../helpers.js';

describe('security/hardcoded-secret', () => {
  const R = 'security/hardcoded-secret';
  const cases: Array<[string, string]> = [
    ['OpenAI project key', j('sk-proj-', 'Rk82hQmZ7xLw3VtN9pYc4BdF6gJ1sK5aU0eH2iO8rT7yW3qX')],
    ['Anthropic key', j('sk-ant-', 'api03-', 'a'.repeat(10), 'B9c8D7e6F5g4H3i2J1k0L9m8N7o6P5q4R3s2')],
    ['Telegram bot token', j('7123456789', ':AA', 'Hq3vZt8LpRkX2mN9cW4bY7dJ1sF6gT0uE')],
    ['Google API key', j('AI', 'za', 'Sy', 'D3x9Lm2Qp8Rt4Vw7Yz1Bc5Fg6Hj0Kn3Ms')],
    ['Google OAuth client secret', j('GOC', 'SPX-', 'k3Jd9Lm2Qp8Rt4Vw7Yz1Bc5Fg6Hj')],
    ['AWS access key', j('AK', 'IA', 'Z7Q3M9K2L8P4R6T1')],
    ['GitHub token', j('gh', 'p_', 'Ab3De6Gh9Jk2Mn5Pq8St1Vw4Yz7Bc0Ef3Hi6')],
    ['Slack token', j('xo', 'xb-', '123456789012-abcdEFGH1234')],
    ['Stripe live key', j('sk', '_live_', 'Ab3De6Gh9Jk2Mn5Pq8St1Vw4')],
    ['JWT', j('ey', 'JhbGciOiJIUzI1NiJ9', '.', 'eyJzdWIiOiIxMjM0NTY3ODkwIn0', '.', 'dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U')],
    ['Bearer literal', j('Bear', 'er ', '9f8e7d6c5b4a39281706f5e4d3c2b1a0')],
    ['password in URL', 'postgres://admin:Sup3rS3cret@db.acme-corp.io:5432/app'],
    ['private key', j('-----BEGIN ', 'RSA PRIVATE KEY-----\nMIIEow...')],
  ];
  for (const [label, secret] of cases) {
    it(`flags a ${label} in a parameter`, () => {
      const t = trigger();
      const n = node({ name: 'Call API', type: 'n8n-nodes-base.set', typeVersion: 3.4, parameters: { value: `prefix ${secret} suffix` } });
      const f = only(lint(workflow([t, n])), R);
      expect(f).toHaveLength(1);
      expect(f[0]!.nodeName).toBe('Call API');
      // never echo the whole secret
      expect(f[0]!.message).not.toContain(secret);
    });
  }

  it('flags a secret-looking assignment in a Code node by entropy', () => {
    const f = only(lint(workflow([trigger(), code('Config', "const API_KEY = 'q8Zr2LmX7vNc4TbW9kPd3Hf6';\nreturn [];")])), R);
    expect(f).toHaveLength(1);
    expect(f[0]!.message).toMatch(/high-entropy/i);
  });

  it('flags a high-entropy value stored under a secret-named key', () => {
    const n = node({ name: 'Custom', type: 'n8n-nodes-base.set', parameters: { apiKey: 'q8Zr2LmX7vNc4TbW9kPd3Hf6' } });
    expect(only(lint(workflow([trigger(), n])), R)).toHaveLength(1);
  });

  it('ignores placeholders, expressions, and auth mode names', () => {
    const n = node({
      name: 'Custom',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      parameters: {
        authentication: 'genericCredentialType',
        genericAuthType: 'httpHeaderAuth',
        apiKey: '={{ $credentials.apiKey }}',
        token: 'YOUR_API_TOKEN_GOES_HERE_123',
        url: 'https://api.openai.com/v1/chat/completions',
      },
    });
    const c = code('Config', "const ADMIN_CHAT_ID = 'YOUR_TELEGRAM_CHAT_ID';\nconst MODEL = 'gpt-4o-mini';\nreturn [];");
    expect(only(lint(workflow([trigger(), n, c])), R)).toHaveLength(0);
  });

  it('checks sticky notes and node notes too', () => {
    const sticky = node({ name: 'Note', type: 'n8n-nodes-base.stickyNote', parameters: { content: j('token: ', 'gh', 'p_', 'Ab3De6Gh9Jk2Mn5Pq8St1Vw4Yz7Bc0Ef3Hi6') } });
    const n = code('Run', 'return [];');
    n.notes = j('old key ', 'sk', '_live_', 'Ab3De6Gh9Jk2Mn5Pq8St1Vw4');
    expect(only(lint(workflow([trigger(), n, sticky])), R)).toHaveLength(2);
  });
});

describe('security/webhook-no-auth', () => {
  const R = 'security/webhook-no-auth';
  const hook = (params: Record<string, unknown>, extra = {}) =>
    node({ name: 'Incoming', type: 'n8n-nodes-base.webhook', typeVersion: 2, parameters: { path: 'orders', ...params }, ...extra });

  it('flags a webhook with no authentication parameter (default "none")', () => {
    const f = only(lint(workflow([hook({}), code('Next')])), R);
    expect(f).toHaveLength(1);
    expect(f[0]!.message).toContain('/orders');
  });
  it('flags authentication: "none" explicitly', () => {
    expect(only(lint(workflow([hook({ authentication: 'none' }), code('Next')])), R)).toHaveLength(1);
  });
  it('flags an MCP Server Trigger without auth', () => {
    const mcp = node({ name: 'MCP', type: '@n8n/n8n-nodes-langchain.mcpTrigger', parameters: { path: 'mcp' } });
    expect(only(lint(workflow([mcp])), R)).toHaveLength(1);
  });
  for (const auth of ['basicAuth', 'headerAuth', 'jwtAuth']) {
    it(`accepts ${auth}`, () => {
      expect(only(lint(workflow([hook({ authentication: auth }), code('Next')])), R)).toHaveLength(0);
    });
  }
  it('skips disabled webhooks and honours inline disable in notes', () => {
    expect(only(lint(workflow([hook({}, { disabled: true }), trigger()])), R)).toHaveLength(0);
    const h = hook({}, { notes: 'Stripe signs requests; verified in next node.\nn8n-lint-disable security/webhook-no-auth' });
    expect(only(lint(workflow([h, code('Verify Stripe signature')])), R)).toHaveLength(0);
  });
});

describe('security/pin-data', () => {
  const R = 'security/pin-data';
  it('flags pinned data', () => {
    const t = trigger();
    const f = only(lint(workflow([t], { pinData: { [t.name]: [{ json: { email: 'a@b.c' } }] } })), R);
    expect(f).toHaveLength(1);
    expect(f[0]!.fixable).toBe(true);
  });
  it('ignores an empty pinData object or empty arrays', () => {
    expect(only(lint(workflow([trigger()], { pinData: {} })), R)).toHaveLength(0);
    expect(only(lint(workflow([trigger()], { pinData: { x: [] } })), R)).toHaveLength(0);
  });
});

describe('security/insecure-http', () => {
  const R = 'security/insecure-http';
  it('flags http:// to a public host, including expressions that start with it', () => {
    expect(only(lint(workflow([trigger(), http('Fetch', {}, { url: 'http://api.acme-corp.io/x' })])), R)).toHaveLength(1);
    expect(only(lint(workflow([trigger(), http('Fetch', {}, { url: '=http://api.acme-corp.io/{{ $json.id }}' })])), R)).toHaveLength(1);
  });
  it('allows https, localhost, private ranges and docker service names', () => {
    for (const url of ['https://api.acme-corp.io', 'http://localhost:11434/api', 'http://192.168.1.20/x', 'http://ollama:11434', 'http://10.0.0.5', 'http://nas.local/x']) {
      expect(only(lint(workflow([trigger(), http('Fetch', {}, { url })])), R), url).toHaveLength(0);
    }
  });
  it('reports private hosts when allowPrivate is false, and honours allowHosts', () => {
    const wf = workflow([trigger(), http('Fetch', {}, { url: 'http://ollama:11434' })]);
    expect(only(lint(wf, { rules: { [R]: ['warning', { allowPrivate: false }] } }), R)).toHaveLength(1);
    const wf2 = workflow([trigger(), http('Fetch', {}, { url: 'http://legacy.acme-corp.io' })]);
    expect(only(lint(wf2, { rules: { [R]: ['warning', { allowHosts: ['legacy.acme-corp.io'] }] } }), R)).toHaveLength(0);
  });
});

describe('security/dangerous-code', () => {
  const R = 'security/dangerous-code';
  const bad = [
    'return [{ json: eval($json.expr) }];',
    'const f = new Function("a", $json.body); return [];',
    "const cp = require('child_process'); return [];",
    "const fs = require('node:fs'); return [];",
    "const fs = require('fs/promises'); return [];",
  ];
  for (const src of bad) {
    it(`flags: ${src.slice(0, 40)}`, () => {
      expect(only(lint(workflow([trigger(), code('Run', src)])), R).length).toBeGreaterThan(0);
    });
  }
  it('flags dangerous Python', () => {
    const py = node({ name: 'Py', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { language: 'python', pythonCode: 'import subprocess\nsubprocess.run(["ls"])' } });
    expect(only(lint(workflow([trigger(), py])), R)).toHaveLength(1);
  });
  it('flags Execute Command nodes', () => {
    const ex = node({ name: 'Shell', type: 'n8n-nodes-base.executeCommand', parameters: { command: 'ls' } });
    expect(only(lint(workflow([trigger(), ex])), R)).toHaveLength(1);
  });
  it('ignores safe code and mentions inside comments', () => {
    const src = '// never use eval( here\n/* require("fs") */\nconst data = JSON.parse($json.body);\nreturn [{ json: data }];';
    expect(only(lint(workflow([trigger(), code('Run', src)])), R)).toHaveLength(0);
  });
});

describe('security/embedded-credentials', () => {
  const R = 'security/embedded-credentials';
  it('flags inline credential data on a node', () => {
    const n = node({ name: 'Bot', type: 'n8n-nodes-base.telegram', typeVersion: 1.2, credentials: { telegramApi: { id: '1', name: 'Bot', accessToken: 'abc' } } });
    expect(only(lint(workflow([trigger(), n])), R)).toHaveLength(1);
  });
  it('flags hand-typed Authorization headers and api_key query params', () => {
    const h = http('Call', {}, { sendHeaders: true, headerParameters: { parameters: [{ name: 'Authorization', value: 'Token 9f8e7d6c5b4a3928' }] } });
    const q = http('Call 2', {}, { sendQuery: true, queryParameters: { parameters: [{ name: 'api_key', value: 'k29dk3l20dk3' }] } });
    expect(only(lint(workflow([trigger(), h, q])), R)).toHaveLength(2);
  });
  it('accepts credential references and expression-valued headers', () => {
    const ok = http('Call', { credentials: { httpHeaderAuth: { id: 'x', name: 'My API' } } }, {
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'Authorization', value: '={{ "Bearer " + $json.token }}' }, { name: 'Accept', value: 'application/json' }] },
    });
    expect(only(lint(workflow([trigger(), ok])), R)).toHaveLength(0);
  });
  it('does not double-report the same header as hardcoded-secret', () => {
    const h = http('Call', {}, { headerParameters: { parameters: [{ name: 'Authorization', value: j('Bear', 'er ', '9f8e7d6c5b4a39281706f5e4d3c2b1a0') }] } });
    const f = lint(workflow([trigger(), h]));
    expect(only(f, R)).toHaveLength(1);
    expect(only(f, 'security/hardcoded-secret')).toHaveLength(0);
  });
});
