import type { FileResult } from '../linter.js';
import type { Finding } from '../types.js';
export declare const VERSION = "0.1.0";
export declare const TOOL_URI = "https://github.com/vhmns14/n8n-lint";
export type Format = 'pretty' | 'json' | 'sarif' | 'github';
export declare const FORMATS: Format[];
export interface Counts {
    error: number;
    warning: number;
    info: number;
    files: number;
    workflows: number;
}
export declare function count(results: FileResult[]): Counts;
export declare function formatPretty(results: FileResult[], color?: boolean): string;
export declare function formatJson(results: FileResult[]): string;
export declare function toSarif(results: FileResult[]): {
    $schema: string;
    version: string;
    runs: {
        tool: {
            driver: {
                name: string;
                version: string;
                semanticVersion: string;
                informationUri: string;
                rules: {
                    id: string;
                    name: string;
                    shortDescription: {
                        text: string;
                    };
                    fullDescription: {
                        text: string;
                    };
                    help: {
                        text: string;
                        markdown: string;
                    };
                    helpUri: string;
                    defaultConfiguration: {
                        level: "error" | "warning" | "note";
                    };
                    properties: {
                        'security-severity'?: string | undefined;
                        tags: string[];
                    };
                }[];
            };
        };
        results: unknown[];
        columnKind: string;
    }[];
};
export declare function formatSarif(results: FileResult[]): string;
export declare function formatGithub(results: FileResult[]): string;
export declare function format(results: FileResult[], fmt: Format): string;
export type { Finding };
