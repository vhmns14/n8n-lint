/** Shapes of an n8n workflow export, kept to the fields the linter reads. */
export type OnError = 'continueErrorOutput' | 'continueRegularOutput' | 'stopWorkflow';
export interface N8nCredentialRef {
    id?: string | null;
    name?: string;
    [extra: string]: unknown;
}
export interface N8nNode {
    id?: string;
    name: string;
    type: string;
    typeVersion?: number;
    position?: [number, number];
    parameters?: Record<string, unknown>;
    credentials?: Record<string, N8nCredentialRef>;
    disabled?: boolean;
    notes?: string;
    notesInFlow?: boolean;
    retryOnFail?: boolean;
    maxTries?: number;
    waitBetweenTries?: number;
    alwaysOutputData?: boolean;
    executeOnce?: boolean;
    onError?: OnError;
    continueOnFail?: boolean;
    webhookId?: string;
    [extra: string]: unknown;
}
export interface N8nConnectionTarget {
    node: string;
    type: string;
    index: number;
}
/** connections[sourceNodeName][connectionType][outputIndex] = targets */
export type N8nConnections = Record<string, Record<string, (N8nConnectionTarget[] | null)[]>>;
export interface N8nWorkflow {
    id?: string;
    name?: string;
    description?: string | null;
    nodes: N8nNode[];
    connections: N8nConnections;
    settings?: {
        errorWorkflow?: string;
        executionOrder?: 'v0' | 'v1';
        timezone?: string;
        [k: string]: unknown;
    };
    pinData?: Record<string, unknown[]>;
    tags?: Array<string | {
        id?: string;
        name?: string;
    }>;
    active?: boolean;
    meta?: Record<string, unknown>;
    [extra: string]: unknown;
}
export type Severity = 'error' | 'warning' | 'info';
export type SeverityOrOff = Severity | 'off';
export declare const SEVERITY_RANK: Record<Severity, number>;
export type Category = 'security' | 'reliability' | 'hygiene';
export interface Location {
    line: number;
    column: number;
}
export interface Finding {
    ruleId: string;
    severity: Severity;
    message: string;
    hint?: string;
    docsUrl: string;
    file: string;
    /** index into an array export, when the file holds several workflows */
    workflowIndex?: number;
    workflowName?: string;
    nodeName?: string;
    nodeId?: string;
    /** JSON pointer inside the file the finding points at */
    pointer: string;
    location: Location;
    fixable?: boolean;
}
/** What a rule reports; the linter fills in severity, location, docs, and file. */
export interface RawFinding {
    message: string;
    hint?: string;
    node?: N8nNode;
    /** JSON pointer relative to the workflow root, e.g. /nodes/3/parameters/url */
    pointer: string;
    fixable?: boolean;
}
export interface RuleContext {
    workflow: N8nWorkflow;
    options: Record<string, unknown>;
    report(finding: RawFinding): void;
    /** pointer to a node by its array index */
    nodePointer(node: N8nNode): string;
}
export interface RuleMeta {
    id: string;
    category: Category;
    defaultSeverity: Severity;
    /** One-line summary for tables. */
    summary: string;
    /** Why the rule exists. Markdown. */
    rationale: string;
    /** How to fix. Markdown. */
    fix: string;
    /** Documented options and their defaults. */
    options?: Record<string, {
        description: string;
        default: unknown;
    }>;
    /** Whether `--fix` can repair it. */
    fixable?: 'yes' | 'opt-in' | 'no';
}
export interface Rule {
    meta: RuleMeta;
    check(ctx: RuleContext): void;
}
