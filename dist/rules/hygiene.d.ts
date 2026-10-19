import type { Rule } from '../types.js';
export declare function isDefaultName(name: string, type: string, trigger: boolean): boolean;
export declare const defaultNodeName: Rule;
export declare const missingMetadata: Rule;
export declare const outdatedTypeVersion: Rule;
export declare const deprecatedNode: Rule;
export declare const hygieneRules: Rule[];
