import { rules } from '../rules/index.js';
export const VERSION = '0.1.0';
export const TOOL_URI = 'https://github.com/vhmns14/n8n-lint';
export const FORMATS = ['pretty', 'json', 'sarif', 'github'];
export function count(results) {
    const c = { error: 0, warning: 0, info: 0, files: 0, workflows: 0 };
    for (const r of results) {
        if (r.skipped)
            continue;
        c.files++;
        c.workflows += r.workflows?.length ?? 0;
        for (const f of r.findings)
            c[f.severity]++;
        if (r.error)
            c.error++;
    }
    return c;
}
// ---------- pretty ----------
const useColor = (stream) => !process.env.NO_COLOR && (process.env.FORCE_COLOR ? process.env.FORCE_COLOR !== '0' : !!stream.isTTY);
export function formatPretty(results, color = useColor(process.stdout)) {
    const paint = (code) => (s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
    const dim = paint('2');
    const bold = paint('1');
    const sevColor = { error: paint('31'), warning: paint('33'), info: paint('36') };
    const lines = [];
    for (const r of results) {
        if (r.skipped)
            continue;
        if (r.error) {
            lines.push(bold(r.file), `  ${sevColor.error('error')}  ${r.error}`, '');
            continue;
        }
        if (!r.findings.length)
            continue;
        lines.push(bold(r.file));
        const pos = r.findings.map((f) => `${f.location.line}:${f.location.column}`);
        const posW = Math.max(...pos.map((p) => p.length));
        r.findings.forEach((f, i) => {
            const sev = sevColor[f.severity](f.severity.padEnd(7));
            lines.push(`  ${dim(pos[i].padEnd(posW))}  ${sev}  ${f.message}  ${dim(f.ruleId)}`);
            if (f.hint)
                lines.push(`  ${' '.repeat(posW)}  ${' '.repeat(7)}  ${dim('↳ ' + f.hint)}`);
        });
        lines.push('');
    }
    const c = count(results);
    const total = c.error + c.warning + c.info;
    const fixable = results.reduce((n, r) => n + r.findings.filter((f) => f.fixable).length, 0);
    if (!total) {
        lines.push(`${paint('32')('✔')} ${c.workflows} workflow(s) in ${c.files} file(s), no problems.`);
    }
    else {
        const parts = [
            sevColor.error(`${c.error} error${c.error === 1 ? '' : 's'}`),
            sevColor.warning(`${c.warning} warning${c.warning === 1 ? '' : 's'}`),
            sevColor.info(`${c.info} info`),
        ];
        lines.push(`${bold('✖')} ${total} problem${total === 1 ? '' : 's'} (${parts.join(', ')}) in ${c.workflows} workflow(s), ${c.files} file(s).`);
        if (fixable)
            lines.push(dim(`  ${fixable} can be fixed with --fix (see --help for opt-in fixes).`));
    }
    return lines.join('\n') + '\n';
}
// ---------- json ----------
export function formatJson(results) {
    const c = count(results);
    return (JSON.stringify({
        tool: { name: 'n8n-lint', version: VERSION },
        summary: { errors: c.error, warnings: c.warning, infos: c.info, files: c.files, workflows: c.workflows },
        results: results
            .filter((r) => !r.skipped)
            .map((r) => ({ file: r.file, error: r.error, findings: r.findings })),
    }, null, 2) + '\n');
}
// ---------- SARIF 2.1.0 ----------
const SARIF_LEVEL = { error: 'error', warning: 'warning', info: 'note' };
const SECURITY_SEVERITY = { error: '8.0', warning: '5.0', info: '2.0' };
export function toSarif(results) {
    const ruleIndex = new Map(rules.map((r, i) => [r.meta.id, i]));
    const sarifResults = [];
    for (const r of results) {
        if (r.skipped)
            continue;
        if (r.error) {
            sarifResults.push({
                ruleId: 'n8n-lint/parse-error',
                level: 'error',
                message: { text: r.error },
                locations: [{ physicalLocation: { artifactLocation: { uri: toUri(r.file) }, region: { startLine: 1, startColumn: 1 } } }],
            });
            continue;
        }
        for (const f of r.findings) {
            sarifResults.push({
                ruleId: f.ruleId,
                ruleIndex: ruleIndex.get(f.ruleId),
                level: SARIF_LEVEL[f.severity],
                message: { text: f.hint ? `${f.message} ${f.hint}` : f.message },
                locations: [
                    {
                        physicalLocation: {
                            artifactLocation: { uri: toUri(f.file) },
                            region: { startLine: f.location.line, startColumn: f.location.column },
                        },
                        ...(f.nodeName ? { logicalLocations: [{ name: f.nodeName, kind: 'object', fullyQualifiedName: `${f.workflowName ?? ''}/${f.nodeName}` }] } : {}),
                    },
                ],
                partialFingerprints: { 'n8nLint/v1': fingerprint(`${f.ruleId}|${f.file}|${f.pointer}|${f.nodeName ?? ''}`) },
            });
        }
    }
    return {
        $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
        version: '2.1.0',
        runs: [
            {
                tool: {
                    driver: {
                        name: 'n8n-lint',
                        version: VERSION,
                        semanticVersion: VERSION,
                        informationUri: TOOL_URI,
                        rules: rules.map((r) => ({
                            id: r.meta.id,
                            name: r.meta.id.split('/')[1].replace(/(^|-)(\w)/g, (_m, _d, c) => c.toUpperCase()),
                            shortDescription: { text: r.meta.summary },
                            fullDescription: { text: r.meta.rationale },
                            help: { text: r.meta.fix, markdown: `${r.meta.rationale}\n\n**Fix:** ${r.meta.fix}` },
                            helpUri: `${TOOL_URI}/blob/main/docs/rules/${r.meta.id.replace('/', '-')}.md`,
                            defaultConfiguration: { level: SARIF_LEVEL[r.meta.defaultSeverity] },
                            properties: {
                                tags: [r.meta.category, ...(r.meta.category === 'security' ? ['security'] : [])].filter((v, i, a) => a.indexOf(v) === i),
                                ...(r.meta.category === 'security' ? { 'security-severity': SECURITY_SEVERITY[r.meta.defaultSeverity] } : {}),
                            },
                        })),
                    },
                },
                results: sarifResults,
                columnKind: 'unicodeCodePoints',
            },
        ],
    };
}
function toUri(file) {
    return file.split('\\').join('/').split('/').map(encodeURIComponent).join('/');
}
/** FNV-1a, enough to keep code-scanning alerts stable across runs. */
function fingerprint(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
}
export function formatSarif(results) {
    return JSON.stringify(toSarif(results), null, 2) + '\n';
}
// ---------- GitHub Actions workflow commands ----------
const GH_CMD = { error: 'error', warning: 'warning', info: 'notice' };
const ghProp = (s) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A').replace(/:/g, '%3A').replace(/,/g, '%2C');
const ghMsg = (s) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
export function formatGithub(results) {
    const out = [];
    for (const r of results) {
        if (r.skipped)
            continue;
        if (r.error) {
            out.push(`::error file=${ghProp(r.file)},line=1,title=${ghProp('n8n-lint: parse error')}::${ghMsg(r.error)}`);
            continue;
        }
        for (const f of r.findings) {
            const title = ghProp(`n8n-lint ${f.ruleId}`);
            const msg = ghMsg(f.hint ? `${f.message}\n${f.hint}\n${f.docsUrl}` : `${f.message}\n${f.docsUrl}`);
            out.push(`::${GH_CMD[f.severity]} file=${ghProp(f.file)},line=${f.location.line},col=${f.location.column},title=${title}::${msg}`);
        }
    }
    const c = count(results);
    out.push(`n8n-lint: ${c.error} error(s), ${c.warning} warning(s), ${c.info} info in ${c.workflows} workflow(s).`);
    return out.join('\n') + '\n';
}
export function format(results, fmt) {
    switch (fmt) {
        case 'json':
            return formatJson(results);
        case 'sarif':
            return formatSarif(results);
        case 'github':
            return formatGithub(results);
        default:
            return formatPretty(results);
    }
}
