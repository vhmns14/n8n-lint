import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { rulesById } from './rules/index.js';
import type { Severity, SeverityOrOff } from './types.js';

export type RuleSetting = SeverityOrOff | [SeverityOrOff, Record<string, unknown>?];

export interface Config {
  /** Per-rule severity and options. */
  rules?: Record<string, RuleSetting>;
  /** Glob patterns (relative to the config file) of files to skip. */
  ignore?: string[];
  /** Per-file overrides, applied in order after `rules`. */
  overrides?: Array<{ files: string[]; rules: Record<string, RuleSetting> }>;
  /** Default for --fail-on. */
  failOn?: Severity | 'none';
}

export interface ResolvedRule {
  severity: SeverityOrOff;
  options: Record<string, unknown>;
}

export const CONFIG_NAMES = ['.n8nlintrc.json', '.n8nlintrc', 'n8n-lint.config.json'];

export class ConfigError extends Error {}

export function findConfig(startDir: string): string | undefined {
  let dir = resolve(startDir);
  for (;;) {
    for (const name of CONFIG_NAMES) {
      const p = join(dir, name);
      if (existsSync(p)) return p;
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

const SEVERITIES = new Set(['error', 'warning', 'info', 'off']);

function validateRules(rules: Record<string, RuleSetting> | undefined, where: string) {
  for (const [id, setting] of Object.entries(rules ?? {})) {
    if (!rulesById.has(id)) throw new ConfigError(`${where}: unknown rule "${id}"`);
    const sev = Array.isArray(setting) ? setting[0] : setting;
    if (!SEVERITIES.has(sev as string)) throw new ConfigError(`${where}: rule "${id}" has invalid severity "${String(sev)}" (use error, warning, info, or off)`);
  }
}

export function loadConfig(path: string): Config {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new ConfigError(`${path}: ${(e as Error).message}`);
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ConfigError(`${path}: config must be a JSON object`);
  const cfg = raw as Config;
  validateRules(cfg.rules, path);
  cfg.overrides?.forEach((o, i) => validateRules(o.rules, `${path} overrides[${i}]`));
  if (cfg.failOn && !['error', 'warning', 'info', 'none'].includes(cfg.failOn)) throw new ConfigError(`${path}: invalid failOn "${cfg.failOn}"`);
  return cfg;
}

/** Minimal glob: `**` spans directories, `*` and `?` stay inside one segment. */
export function globToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === '*' && glob[i + 1] === '*') {
      re += glob[i + 2] === '/' ? '(?:.*/)?' : '.*';
      i += glob[i + 2] === '/' ? 2 : 1;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

export function matchesAny(relPath: string, globs: string[] | undefined): boolean {
  const p = relPath.split('\\').join('/');
  return (globs ?? []).some((g) => globToRegExp(g).test(p) || globToRegExp(`**/${g}`).test(p));
}

function apply(target: Map<string, ResolvedRule>, rules: Record<string, RuleSetting> | undefined) {
  for (const [id, setting] of Object.entries(rules ?? {})) {
    const [severity, options] = Array.isArray(setting) ? setting : [setting, undefined];
    const prev = target.get(id)!;
    target.set(id, { severity, options: { ...prev.options, ...(options ?? {}) } });
  }
}

/** Effective severity and options of every rule for one file. */
export function resolveRules(config: Config, relPath: string): Map<string, ResolvedRule> {
  const out = new Map<string, ResolvedRule>();
  for (const [id, rule] of rulesById) out.set(id, { severity: rule.meta.defaultSeverity, options: {} });
  apply(out, config.rules);
  for (const o of config.overrides ?? []) if (matchesAny(relPath, o.files)) apply(out, o.rules);
  return out;
}
