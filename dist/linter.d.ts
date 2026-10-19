import { type Config } from './config.js';
import type { Finding, N8nWorkflow } from './types.js';
export interface FileResult {
    file: string;
    findings: Finding[];
    /** set when the file could not be read or is not a workflow export */
    error?: string;
    /** true when a directory scan found JSON that is not an n8n workflow */
    skipped?: boolean;
    /** parsed workflows, kept for --fix */
    workflows?: N8nWorkflow[];
    isArray?: boolean;
    text?: string;
}
export interface LintOptions {
    config?: Config;
    /** base directory for config globs and printed paths */
    cwd?: string;
}
export declare function isWorkflow(v: unknown): v is N8nWorkflow;
/** Lint one workflow object. Pointers are relative to `prefix`. */
export declare function lintWorkflow(wf: N8nWorkflow, opts?: {
    file?: string;
    relPath?: string;
    config?: Config;
    prefix?: string;
    text?: string;
    workflowIndex?: number;
}): Finding[];
/** Lint JSON text. `strict` makes non-workflow JSON an error instead of a skip. */
export declare function lintText(text: string, file: string, opts?: LintOptions & {
    strict?: boolean;
}): FileResult;
/** Expand paths into JSON files. Explicit files are returned as-is (strict). */
export declare function collectFiles(paths: string[], cwd: string, ignore?: string[]): Array<{
    path: string;
    strict: boolean;
}>;
export declare function lintPaths(paths: string[], opts?: LintOptions): FileResult[];
