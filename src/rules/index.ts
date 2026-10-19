import type { Rule } from '../types.js';
import { hygieneRules } from './hygiene.js';
import { reliabilityRules } from './reliability.js';
import { securityRules } from './security.js';

export const rules: Rule[] = [...securityRules, ...reliabilityRules, ...hygieneRules];

export const rulesById: Map<string, Rule> = new Map(rules.map((r) => [r.meta.id, r]));

export const DOCS_BASE = 'https://github.com/vhmns14/n8n-lint/blob/main/docs/rules';

export function docsUrl(id: string): string {
  return `${DOCS_BASE}/${id.replace('/', '-')}.md`;
}
