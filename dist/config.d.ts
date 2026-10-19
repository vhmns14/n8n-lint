import type { Severity, SeverityOrOff } from './types.js';
export type RuleSetting = SeverityOrOff | [SeverityOrOff, Record<string, unknown>?];
export interface Config {
    /** Per-rule severity and options. */
    rules?: Record<string, RuleSetting>;
    /** Glob patterns (relative to the config file) of files to skip. */
    ignore?: string[];
    /** Per-file overrides, applied in order after `rules`. */
    overrides?: Array<{
        files: string[];
        rules: Record<string, RuleSetting>;
    }>;
    /** Default for --fail-on. */
    failOn?: Severity | 'none';
}
export interface ResolvedRule {
    severity: SeverityOrOff;
    options: Record<string, unknown>;
}
export declare const CONFIG_NAMES: string[];
export declare class ConfigError extends Error {
}
export declare function findConfig(startDir: string): string | undefined;
export declare function loadConfig(path: string): Config;
/** Minimal glob: `**` spans directories, `*` and `?` stay inside one segment. */
export declare function globToRegExp(glob: string): RegExp;
export declare function matchesAny(relPath: string, globs: string[] | undefined): boolean;
/** Effective severity and options of every rule for one file. */
export declare function resolveRules(config: Config, relPath: string): Map<string, ResolvedRule>;
