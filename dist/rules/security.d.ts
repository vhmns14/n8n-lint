import type { N8nNode, Rule } from '../types.js';
/** Header/query/body parameter names that carry credentials. */
export declare const AUTH_PARAM_NAME: RegExp;
/** {name, value} pairs inside a node's parameters, wherever n8n put them. */
export declare function nameValuePairs(node: N8nNode, base: string): Array<{
    name: string;
    value: unknown;
    pointer: string;
}>;
export declare const hardcodedSecret: Rule;
export declare const webhookNoAuth: Rule;
export declare const pinData: Rule;
export declare const insecureHttp: Rule;
export declare const dangerousCode: Rule;
export declare const embeddedCredentials: Rule;
export declare const securityRules: Rule[];
