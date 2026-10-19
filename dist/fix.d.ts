import type { N8nWorkflow } from './types.js';
export interface FixOptions {
    /** remove pinData (default on) */
    pinData?: boolean;
    /** remove disabled nodes, bridging their main input to their main output */
    disabled?: boolean;
    /** rename default-named HTTP Request nodes to "METHOD host" */
    names?: boolean;
}
export interface FixReport {
    pinDataRemoved: string[];
    nodesRemoved: string[];
    renamed: Array<[string, string]>;
}
export declare function renameNode(wf: N8nWorkflow, from: string, to: string): void;
/** Apply safe fixes in place. */
export declare function fixWorkflow(wf: N8nWorkflow, opts?: FixOptions): FixReport;
export declare function detectIndent(text: string): string | number;
