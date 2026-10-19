import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { matchesAny, resolveRules } from './config.js';
import { locatePointers, resolveLocation } from './json-locate.js';
import { docsUrl, rules } from './rules/index.js';
import { isSticky } from './workflow.js';
const DISABLE_NODE = /n8n-lint-disable(?!-workflow)(?:[ \t]+([^\n]+))?/;
const DISABLE_WORKFLOW = /n8n-lint-disable-workflow(?:[ \t]+([^\n]+))?/;
function parseDisable(m) {
    if (!m)
        return undefined;
    const ids = (m[1] ?? '')
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter((s) => /^[a-z]+\/[a-z0-9-]+$/.test(s));
    return ids.length ? new Set(ids) : 'all';
}
const covers = (d, id) => d === 'all' || (d instanceof Set && d.has(id));
export function isWorkflow(v) {
    return (!!v &&
        typeof v === 'object' &&
        Array.isArray(v.nodes) &&
        typeof v.connections === 'object' &&
        v.connections !== null);
}
/** Lint one workflow object. Pointers are relative to `prefix`. */
export function lintWorkflow(wf, opts = {}) {
    const file = opts.relPath ?? opts.file ?? '<input>';
    const prefix = opts.prefix ?? '';
    const resolved = resolveRules(opts.config ?? {}, file);
    const locations = opts.text ? locatePointers(opts.text) : undefined;
    const indexOf = new Map(wf.nodes.map((n, i) => [n, i]));
    const wfDisable = parseDisable(DISABLE_WORKFLOW.exec(typeof wf.description === 'string' ? wf.description : '')) ??
        wf.nodes
            .filter(isSticky)
            .map((n) => parseDisable(DISABLE_WORKFLOW.exec(String(n.parameters?.content ?? ''))))
            .find(Boolean);
    const findings = [];
    for (const rule of rules) {
        const r = resolved.get(rule.meta.id);
        if (r.severity === 'off' || covers(wfDisable, rule.meta.id))
            continue;
        const severity = r.severity;
        rule.check({
            workflow: wf,
            options: r.options,
            nodePointer: (node) => `/nodes/${indexOf.get(node) ?? 0}`,
            report: (raw) => {
                if (raw.node && covers(parseDisable(DISABLE_NODE.exec(raw.node.notes ?? '')), rule.meta.id))
                    return;
                const pointer = prefix + raw.pointer;
                findings.push({
                    ruleId: rule.meta.id,
                    severity,
                    message: raw.message,
                    hint: raw.hint,
                    docsUrl: docsUrl(rule.meta.id),
                    file,
                    workflowIndex: opts.workflowIndex,
                    workflowName: wf.name,
                    nodeName: raw.node?.name,
                    nodeId: raw.node?.id,
                    pointer,
                    location: locations ? resolveLocation(locations, pointer) : { line: 1, column: 1 },
                    fixable: raw.fixable,
                });
            },
        });
    }
    return findings.sort((a, b) => a.location.line - b.location.line || a.location.column - b.location.column);
}
/** Lint JSON text. `strict` makes non-workflow JSON an error instead of a skip. */
export function lintText(text, file, opts = {}) {
    const cwd = opts.cwd ?? process.cwd();
    const relPath = relative(cwd, resolve(cwd, file)) || file;
    let data;
    try {
        data = JSON.parse(text.replace(/^\ufeff/, ''));
    }
    catch (e) {
        return { file: relPath, findings: [], error: `invalid JSON: ${e.message}` };
    }
    const list = Array.isArray(data) ? data : [data];
    const workflows = list.filter(isWorkflow);
    if (!workflows.length || workflows.length !== list.length) {
        return opts.strict
            ? { file: relPath, findings: [], error: 'not an n8n workflow export (expected "nodes" and "connections")' }
            : { file: relPath, findings: [], skipped: true };
    }
    const findings = workflows.flatMap((wf, i) => lintWorkflow(wf, {
        relPath,
        config: opts.config,
        text,
        prefix: Array.isArray(data) ? `/${i}` : '',
        workflowIndex: Array.isArray(data) ? i : undefined,
    }));
    return { file: relPath, findings, workflows, isArray: Array.isArray(data), text };
}
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.n8n']);
/** Expand paths into JSON files. Explicit files are returned as-is (strict). */
export function collectFiles(paths, cwd, ignore = []) {
    const out = [];
    const walk = (dir) => {
        for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const p = join(dir, entry.name);
            if (entry.isDirectory()) {
                if (!SKIP_DIRS.has(entry.name))
                    walk(p);
            }
            else if (entry.isFile() && entry.name.endsWith('.json') && !/^(package(-lock)?|tsconfig.*|\.n8nlintrc|n8n-lint\.config)\.json$/.test(entry.name)) {
                if (!matchesAny(relative(cwd, p), ignore))
                    out.push({ path: p, strict: false });
            }
        }
    };
    for (const raw of paths) {
        const p = resolve(cwd, raw);
        const st = statSync(p, { throwIfNoEntry: false });
        if (!st)
            throw new Error(`no such file or directory: ${raw}`);
        if (st.isDirectory())
            walk(p);
        else
            out.push({ path: p, strict: true });
    }
    return out;
}
export function lintPaths(paths, opts = {}) {
    const cwd = opts.cwd ?? process.cwd();
    return collectFiles(paths, cwd, opts.config?.ignore).map(({ path, strict }) => {
        let text;
        try {
            text = readFileSync(path, 'utf8');
        }
        catch (e) {
            return { file: relative(cwd, path), findings: [], error: e.message };
        }
        return lintText(text, path, { ...opts, cwd, strict });
    });
}
