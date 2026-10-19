/** Secret detection: known token shapes first, then entropy on secret-looking keys. */

export interface SecretPattern {
  id: string;
  label: string;
  re: RegExp;
}

export const SECRET_PATTERNS: SecretPattern[] = [
  { id: 'private-key', label: 'private key block', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY(?: BLOCK)?-----/ },
  { id: 'anthropic', label: 'Anthropic API key', re: /\bsk-ant-(?:api|admin)\d{2}-[A-Za-z0-9_-]{32,}/ },
  { id: 'openai', label: 'OpenAI API key', re: /\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}T3BlbkFJ[A-Za-z0-9_-]{20,}|\bsk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{40,}|\bsk-[A-Za-z0-9]{48}\b/ },
  { id: 'openrouter', label: 'OpenRouter API key', re: /\bsk-or-v1-[a-f0-9]{64}\b/ },
  { id: 'telegram-bot', label: 'Telegram bot token', re: /\b\d{8,10}:AA[A-Za-z0-9_-]{33}\b/ },
  { id: 'google-api', label: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { id: 'google-oauth-secret', label: 'Google OAuth client secret', re: /\bGOCSPX-[A-Za-z0-9_-]{28}\b/ },
  { id: 'aws-access-key', label: 'AWS access key ID', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { id: 'github-token', label: 'GitHub token', re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/ },
  { id: 'slack-token', label: 'Slack token', re: /\bxox[abposr]-[A-Za-z0-9-]{10,}/ },
  { id: 'slack-webhook', label: 'Slack incoming-webhook URL', re: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]{20,}/ },
  { id: 'discord-webhook', label: 'Discord webhook URL', re: /https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]{50,}/ },
  { id: 'stripe-live', label: 'Stripe live key', re: /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b/ },
  { id: 'sendgrid', label: 'SendGrid API key', re: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/ },
  { id: 'jwt', label: 'JSON Web Token', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { id: 'bearer', label: 'literal Bearer token', re: /\bBearer\s+(?!\{\{)[A-Za-z0-9._~+/=-]{20,}/ },
  { id: 'url-password', label: 'password in URL', re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@{}]+:([^\s@/{}]+)@[^\s/]+/i },
];

/** Values that are obviously placeholders, not secrets. */
const PLACEHOLDER = /(your|insert|replace|changeme|example|placeholder|dummy|sample|xxxx|\*\*\*\*|<[^>]+>|\.\.\.|todo)/i;

export const SECRET_KEY = /(api[_-]?key|apikey|secret|token|passw(or)?d|passwd|pwd|auth|bearer|private[_-]?key|access[_-]?key|client[_-]?secret)/i;

export function shannonEntropy(s: string): number {
  const counts = new Map<string, number>();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let h = 0;
  for (const c of counts.values()) {
    const p = c / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

export function looksLikePlaceholder(s: string): boolean {
  return PLACEHOLDER.test(s);
}

export interface SecretHit {
  kind: string;
  label: string;
  match: string;
}

export function mask(secret: string): string {
  const s = secret.trim();
  if (s.length <= 8) return '****';
  return `${s.slice(0, 4)}…${s.slice(-2)} (${s.length} chars)`;
}

/** Look for known token shapes anywhere in a string. */
export function findPatternSecrets(text: string): SecretHit[] {
  const hits: SecretHit[] = [];
  for (const p of SECRET_PATTERNS) {
    const m = p.re.exec(text);
    if (!m) continue;
    const match = p.id === 'url-password' ? m[1]! : m[0];
    if (p.id === 'url-password' && (match.startsWith('{{') || match.startsWith('$') || looksLikePlaceholder(match))) continue;
    if (looksLikePlaceholder(m[0])) continue;
    hits.push({ kind: p.id, label: p.label, match });
  }
  return hits;
}

const ASSIGNMENT = /(["']?)([A-Za-z0-9_.-]*(?:api[_-]?key|apikey|secret|token|passw(?:or)?d|pwd|client[_-]?secret|access[_-]?key)[A-Za-z0-9_]*)\1\s*[:=]\s*(["'`])([^"'`\n]{12,})\3/gi;

/** Secret-named assignments inside code (const API_KEY = '...'), checked by entropy. */
export function findCodeAssignments(code: string, minEntropy: number): SecretHit[] {
  const hits: SecretHit[] = [];
  for (const m of code.matchAll(ASSIGNMENT)) {
    const value = m[4]!;
    if (looksLikePlaceholder(value) || value.includes('${') || /\s/.test(value)) continue;
    if (shannonEntropy(value) < minEntropy) continue;
    hits.push({ kind: 'high-entropy', label: `high-entropy value assigned to ${m[2]}`, match: value });
  }
  return hits;
}

/** A literal value stored under a secret-looking key. */
export function isHighEntropySecret(value: string, minEntropy: number, minLength = 16): boolean {
  const v = value.trim();
  if (v.length < minLength || /\s/.test(v) || v.includes('{{')) return false;
  if (looksLikePlaceholder(v)) return false;
  if (/^https?:\/\//.test(v)) return false;
  return shannonEntropy(v) >= minEntropy;
}
