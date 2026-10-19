import type { N8nNode, N8nWorkflow } from './types.js';
export declare const STICKY_NOTE = "n8n-nodes-base.stickyNote";
export declare function shortType(type: string): string;
export declare function isTrigger(node: N8nNode): boolean;
export declare function isSticky(node: N8nNode): boolean;
export declare function isErrorWorkflow(wf: N8nWorkflow): boolean;
export declare function isLangchain(node: N8nNode): boolean;
/** Is it an n8n expression ("={{ ... }}")? Literal strings may still start with "=". */
export declare function isExpression(value: string): boolean;
export declare function escapePointer(s: string): string;
export interface StringLeaf {
    value: string;
    /** pointer relative to the node, e.g. /parameters/url */
    pointer: string;
    /** the key that held this value (for arrays, the parent key) */
    key: string;
    /** path of keys from parameters root */
    path: string[];
}
/** Every string inside an object, with its pointer. */
export declare function stringLeaves(root: unknown, base: string, key?: string, path?: string[]): StringLeaf[];
export interface Graph {
    /** node name -> names it sends to (any connection type) */
    out: Map<string, Set<string>>;
    /** node name -> names that send to it, main connections only */
    inMain: Map<string, Set<string>>;
    /** node name -> names it feeds through non-main (AI sub-node) connections */
    outSub: Map<string, Set<string>>;
}
export declare function buildGraph(wf: N8nWorkflow): Graph;
/**
 * Nodes that can actually run: reachable from a trigger over main connections,
 * plus AI sub-nodes (models, tools, memory) attached to a reachable node.
 */
export declare function reachableNodes(wf: N8nWorkflow, g?: Graph): Set<string>;
/** Display names n8n gives new nodes; "Name", "Name1", "Name2" are defaults. */
export declare const DEFAULT_NAMES: Record<string, string>;
/**
 * Highest known typeVersion per node type, read from n8n's source
 * (packages/nodes-base/nodes/*, master, October 2026). A node's major version
 * marks breaking parameter changes; minor bumps are mostly additive.
 */
export declare const LATEST_TYPE_VERSIONS: Record<string, number>;
/** Node types n8n has replaced; using them still works but is a dead end. */
export declare const DEPRECATED_TYPES: Record<string, string>;
/** Calls an external service (HTTP, LLM, SaaS API), so it can time out or fail. */
export declare function isRisky(node: N8nNode): boolean;
export declare function hasNodeErrorHandling(node: N8nNode): boolean;
export declare function workflowTags(wf: N8nWorkflow): string[];
