export const STICKY_NOTE = 'n8n-nodes-base.stickyNote';
/** Node types that start a workflow but do not end in "Trigger". */
const TRIGGER_TYPES = new Set([
    'n8n-nodes-base.webhook',
    'n8n-nodes-base.cron',
    'n8n-nodes-base.interval',
    'n8n-nodes-base.start',
    'n8n-nodes-base.emailReadImap',
    'n8n-nodes-base.formTrigger',
    '@n8n/n8n-nodes-langchain.chatTrigger',
    '@n8n/n8n-nodes-langchain.mcpTrigger',
]);
export function shortType(type) {
    return type.slice(type.lastIndexOf('.') + 1);
}
export function isTrigger(node) {
    return TRIGGER_TYPES.has(node.type) || /trigger$/i.test(shortType(node.type));
}
export function isSticky(node) {
    return node.type === STICKY_NOTE;
}
export function isErrorWorkflow(wf) {
    return wf.nodes.some((n) => n.type === 'n8n-nodes-base.errorTrigger');
}
export function isLangchain(node) {
    return node.type.startsWith('@n8n/n8n-nodes-langchain.');
}
/** Is it an n8n expression ("={{ ... }}")? Literal strings may still start with "=". */
export function isExpression(value) {
    return value.startsWith('=') && value.includes('{{');
}
export function escapePointer(s) {
    return s.replace(/~/g, '~0').replace(/\//g, '~1');
}
/** Every string inside an object, with its pointer. */
export function stringLeaves(root, base, key = '', path = []) {
    const out = [];
    if (typeof root === 'string') {
        out.push({ value: root, pointer: base, key, path });
    }
    else if (Array.isArray(root)) {
        root.forEach((v, i) => out.push(...stringLeaves(v, `${base}/${i}`, key, [...path, String(i)])));
    }
    else if (root && typeof root === 'object') {
        for (const [k, v] of Object.entries(root)) {
            out.push(...stringLeaves(v, `${base}/${escapePointer(k)}`, k, [...path, k]));
        }
    }
    return out;
}
export function buildGraph(wf) {
    const out = new Map();
    const inMain = new Map();
    const outSub = new Map();
    const add = (m, k, v) => {
        if (!m.has(k))
            m.set(k, new Set());
        m.get(k).add(v);
    };
    for (const [src, byType] of Object.entries(wf.connections ?? {})) {
        for (const [type, outputs] of Object.entries(byType ?? {})) {
            for (const targets of outputs ?? []) {
                for (const t of targets ?? []) {
                    if (!t || typeof t.node !== 'string')
                        continue;
                    add(out, src, t.node);
                    if (type === 'main')
                        add(inMain, t.node, src);
                    else
                        add(outSub, src, t.node);
                }
            }
        }
    }
    return { out, inMain, outSub };
}
/**
 * Nodes that can actually run: reachable from a trigger over main connections,
 * plus AI sub-nodes (models, tools, memory) attached to a reachable node.
 */
export function reachableNodes(wf, g = buildGraph(wf)) {
    const seen = new Set();
    const queue = wf.nodes.filter(isTrigger).map((n) => n.name);
    // Sub-workflows called by another workflow start at the trigger too; nothing special needed.
    for (;;) {
        while (queue.length) {
            const name = queue.shift();
            if (seen.has(name))
                continue;
            seen.add(name);
            for (const next of g.out.get(name) ?? [])
                queue.push(next);
        }
        // sub-nodes point *into* their root; pull them in once the root is reachable
        let grew = false;
        for (const [sub, roots] of g.outSub) {
            if (!seen.has(sub) && [...roots].some((r) => seen.has(r))) {
                queue.push(sub);
                grew = true;
            }
        }
        if (!grew)
            return seen;
    }
}
/** Display names n8n gives new nodes; "Name", "Name1", "Name2" are defaults. */
export const DEFAULT_NAMES = {
    'n8n-nodes-base.httpRequest': 'HTTP Request',
    'n8n-nodes-base.code': 'Code',
    'n8n-nodes-base.function': 'Function',
    'n8n-nodes-base.functionItem': 'Function Item',
    'n8n-nodes-base.if': 'If',
    'n8n-nodes-base.switch': 'Switch',
    'n8n-nodes-base.set': 'Edit Fields',
    'n8n-nodes-base.merge': 'Merge',
    'n8n-nodes-base.filter': 'Filter',
    'n8n-nodes-base.noOp': 'No Operation, do nothing',
    'n8n-nodes-base.wait': 'Wait',
    'n8n-nodes-base.splitInBatches': 'Loop Over Items',
    'n8n-nodes-base.splitOut': 'Split Out',
    'n8n-nodes-base.aggregate': 'Aggregate',
    'n8n-nodes-base.executeWorkflow': 'Execute Workflow',
    'n8n-nodes-base.respondToWebhook': 'Respond to Webhook',
    'n8n-nodes-base.googleSheets': 'Google Sheets',
    'n8n-nodes-base.gmail': 'Gmail',
    'n8n-nodes-base.telegram': 'Telegram',
    'n8n-nodes-base.slack': 'Slack',
    'n8n-nodes-base.postgres': 'Postgres',
    'n8n-nodes-base.webhook': 'Webhook',
    'n8n-nodes-base.scheduleTrigger': 'Schedule Trigger',
    'n8n-nodes-base.manualTrigger': "When clicking 'Execute workflow'",
    '@n8n/n8n-nodes-langchain.agent': 'AI Agent',
    '@n8n/n8n-nodes-langchain.openAi': 'OpenAI',
    '@n8n/n8n-nodes-langchain.lmChatOpenAi': 'OpenAI Chat Model',
};
/**
 * Highest known typeVersion per node type, read from n8n's source
 * (packages/nodes-base/nodes/*, master, October 2026). A node's major version
 * marks breaking parameter changes; minor bumps are mostly additive.
 */
export const LATEST_TYPE_VERSIONS = {
    'n8n-nodes-base.httpRequest': 4.5,
    'n8n-nodes-base.webhook': 2.2,
    'n8n-nodes-base.code': 2,
    'n8n-nodes-base.if': 2.4,
    'n8n-nodes-base.switch': 3.5,
    'n8n-nodes-base.set': 3.5,
    'n8n-nodes-base.merge': 3.2,
    'n8n-nodes-base.filter': 2.4,
    'n8n-nodes-base.telegram': 1.2,
    'n8n-nodes-base.telegramTrigger': 1.5,
    'n8n-nodes-base.googleSheets': 4.7,
    'n8n-nodes-base.googleDrive': 3,
    'n8n-nodes-base.gmail': 2.2,
    'n8n-nodes-base.gmailTrigger': 1.4,
    'n8n-nodes-base.scheduleTrigger': 1.4,
    'n8n-nodes-base.respondToWebhook': 1.5,
    'n8n-nodes-base.slack': 2.7,
    'n8n-nodes-base.wait': 1.1,
    'n8n-nodes-base.postgres': 2.8,
    'n8n-nodes-base.splitInBatches': 3,
    'n8n-nodes-base.executeWorkflow': 1.4,
    'n8n-nodes-base.formTrigger': 2.6,
    'n8n-nodes-base.errorTrigger': 1,
};
/** Node types n8n has replaced; using them still works but is a dead end. */
export const DEPRECATED_TYPES = {
    'n8n-nodes-base.function': 'Code',
    'n8n-nodes-base.functionItem': 'Code (mode: Run Once for Each Item)',
    'n8n-nodes-base.cron': 'Schedule Trigger',
    'n8n-nodes-base.interval': 'Schedule Trigger',
    'n8n-nodes-base.start': 'Manual Trigger',
};
/** Nodes that run locally and do not call out to anything that can fail on its own. */
const LOCAL_TYPES = new Set([
    'code', 'function', 'functionItem', 'if', 'switch', 'set', 'merge', 'filter', 'noOp', 'wait',
    'splitInBatches', 'splitOut', 'aggregate', 'limit', 'sort', 'removeDuplicates', 'summarize',
    'itemLists', 'dateTime', 'crypto', 'html', 'markdown', 'xml', 'compareDatasets', 'renameKeys',
    'stickyNote', 'respondToWebhook', 'stopAndError', 'executionData', 'moveBinaryData',
    'convertToFile', 'extractFromFile', 'readWriteFile', 'editImage', 'compression', 'jwt',
    'executeWorkflow', 'executeCommand', 'debugHelper', 'n8n',
].map((t) => `n8n-nodes-base.${t}`));
/** Calls an external service (HTTP, LLM, SaaS API), so it can time out or fail. */
export function isRisky(node) {
    if (isSticky(node) || isTrigger(node))
        return false;
    if (isLangchain(node)) {
        // root LLM/agent/chain nodes run the call; sub-nodes inherit the root's handling
        return /\.(agent|openAi|chainLlm|chainSummarization|chainRetrievalQa|informationExtractor|textClassifier|sentimentAnalysis|anthropic|googleGemini|ollama)$/.test(node.type);
    }
    return !LOCAL_TYPES.has(node.type);
}
export function hasNodeErrorHandling(node) {
    return (node.continueOnFail === true ||
        node.onError === 'continueErrorOutput' ||
        node.onError === 'continueRegularOutput');
}
export function workflowTags(wf) {
    return (wf.tags ?? [])
        .map((t) => (typeof t === 'string' ? t : t?.name ?? ''))
        .filter(Boolean);
}
