import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { lintText } from '../src/linter.js';

/**
 * Real exports from two published projects (a Telegram lead-intake agent and a
 * four-workflow template pack). They are deliberately well built, so these
 * tests guard against false positives as much as they check findings.
 */
const dir = 'test/fixtures/real';
const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();

describe('real-world workflows', () => {
  it('has the fixtures', () => expect(files.length).toBe(7));

  for (const f of files) {
    it(`${f}: parses, has no errors, and matches the recorded findings`, () => {
      const r = lintText(readFileSync(join(dir, f), 'utf8'), join(dir, f));
      expect(r.error).toBeUndefined();
      expect(r.findings.filter((x) => x.severity === 'error')).toEqual([]);
      expect(r.findings.map((x) => `${x.severity} ${x.ruleId} ${x.nodeName ?? ''}`.trim())).toMatchSnapshot();
    });
  }

  it('flags the disabled optional render node in the short-video template', () => {
    const r = lintText(readFileSync(join(dir, 'template-pack-01-ai-short-video-generator.json'), 'utf8'), 'x.json');
    expect(r.findings.find((x) => x.ruleId === 'reliability/disabled-node')?.nodeName).toBe('Render Video (Creatomate, optional)');
  });

  it('does not mistake YOUR_TELEGRAM_CHAT_ID placeholders or webhookIds for secrets', () => {
    for (const f of files) {
      const r = lintText(readFileSync(join(dir, f), 'utf8'), f);
      expect(r.findings.filter((x) => x.ruleId === 'security/hardcoded-secret')).toEqual([]);
    }
  });
});
