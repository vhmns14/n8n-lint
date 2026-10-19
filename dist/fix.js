import { isDefaultName } from './rules/hygiene.js';
import { isSticky, isTrigger } from './workflow.js';
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Rewrite node references inside every string parameter. */
function renameInExpressions(value, from, to) {
    if (typeof value === 'string') {
        if (!value.includes(from))
            return value;
        const f = escapeRe(from);
        return value
            .replace(new RegExp(`\\$\\(\\s*(['"\`])${f}\\1\\s*\\)`, 'g'), (_m, q) => `$(${q}${to}${q})`)
            .replace(new RegExp(`\\$node\\[\\s*(['"])${f}\\1\\s*\\]`, 'g'), (_m, q) => `$node[${q}${to}${q}]`)
            .replace(new RegExp(`\\$items\\(\\s*(['"])${f}\\1`, 'g'), (_m, q) => `$items(${q}${to}${q}`);
    }
    if (Array.isArray(value))
        return value.map((v) => renameInExpressions(v, from, to));
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, renameInExpressions(v, from, to)]));
    }
    return value;
}
export function renameNode(wf, from, to) {
    for (const n of wf.nodes) {
        if (n.name === from)
            n.name = to;
        if (n.parameters)
            n.parameters = renameInExpressions(n.parameters, from, to);
    }
    const conns = {};
    for (const [src, byType] of Object.entries(wf.connections)) {
        for (const outputs of Object.values(byType))
            for (const t of outputs ?? [])
                for (const c of t ?? [])
                    if (c.node === from)
                        c.node = to;
        conns[src === from ? to : src] = byType;
    }
    wf.connections = conns;
    if (wf.pinData && from in wf.pinData) {
        wf.pinData[to] = wf.pinData[from];
        delete wf.pinData[from];
    }
}
function httpName(params) {
    const url = String(params?.url ?? '');
    const host = /^=?\s*https?:\/\/([^/:?#\s{]+)/i.exec(url)?.[1];
    if (!host)
        return undefined;
    const method = String(params?.method ?? params?.requestMethod ?? 'GET').toUpperCase();
    return `${method} ${host}`;
}
function removeNode(wf, name) {
    const incoming = [];
    for (const [src, byType] of Object.entries(wf.connections)) {
        for (const [type, outputs] of Object.entries(byType)) {
            outputs.forEach((targets, out) => {
                if (!targets)
                    return;
                if (type === 'main' && targets.some((t) => t.node === name))
                    incoming.push({ src, type, out });
                outputs[out] = targets.filter((t) => t.node !== name);
            });
        }
    }
    // a disabled node passes its input through on its first output; keep that path
    const passTo = wf.connections[name]?.main?.[0] ?? [];
    for (const { src, out } of incoming) {
        const list = wf.connections[src].main[out] ?? [];
        for (const t of passTo)
            if (!list.some((x) => x.node === t.node && x.index === t.index))
                list.push({ ...t });
        wf.connections[src].main[out] = list;
    }
    delete wf.connections[name];
    wf.nodes = wf.nodes.filter((n) => n.name !== name);
    if (wf.pinData)
        delete wf.pinData[name];
}
/** Apply safe fixes in place. */
export function fixWorkflow(wf, opts = {}) {
    const report = { pinDataRemoved: [], nodesRemoved: [], renamed: [] };
    if (opts.pinData !== false && wf.pinData && Object.keys(wf.pinData).length) {
        report.pinDataRemoved = Object.keys(wf.pinData);
        wf.pinData = {};
    }
    if (opts.disabled) {
        for (const n of wf.nodes.filter((x) => x.disabled && !isSticky(x))) {
            // do not remove a disabled trigger: that changes what starts the workflow
            if (isTrigger(n))
                continue;
            removeNode(wf, n.name);
            report.nodesRemoved.push(n.name);
        }
    }
    if (opts.names) {
        const taken = new Set(wf.nodes.map((n) => n.name));
        for (const n of wf.nodes) {
            if (n.type !== 'n8n-nodes-base.httpRequest' || !isDefaultName(n.name, n.type, false))
                continue;
            const base = httpName(n.parameters);
            if (!base)
                continue;
            let candidate = base;
            for (let i = 2; taken.has(candidate); i++)
                candidate = `${base} ${i}`;
            const from = n.name;
            taken.delete(from);
            taken.add(candidate);
            renameNode(wf, from, candidate);
            report.renamed.push([from, candidate]);
        }
    }
    return report;
}
export function detectIndent(text) {
    const m = /\n([ \t]+)"/.exec(text);
    return m ? m[1] : 2;
}
