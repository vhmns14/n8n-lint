import { hygieneRules } from './hygiene.js';
import { reliabilityRules } from './reliability.js';
import { securityRules } from './security.js';
export const rules = [...securityRules, ...reliabilityRules, ...hygieneRules];
export const rulesById = new Map(rules.map((r) => [r.meta.id, r]));
export const DOCS_BASE = 'https://github.com/vhmns14/n8n-lint/blob/main/docs/rules';
export function docsUrl(id) {
    return `${DOCS_BASE}/${id.replace('/', '-')}.md`;
}
