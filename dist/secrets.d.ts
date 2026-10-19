/** Secret detection: known token shapes first, then entropy on secret-looking keys. */
export interface SecretPattern {
    id: string;
    label: string;
    re: RegExp;
}
export declare const SECRET_PATTERNS: SecretPattern[];
export declare const SECRET_KEY: RegExp;
export declare function shannonEntropy(s: string): number;
export declare function looksLikePlaceholder(s: string): boolean;
export interface SecretHit {
    kind: string;
    label: string;
    match: string;
}
export declare function mask(secret: string): string;
/** Look for known token shapes anywhere in a string. */
export declare function findPatternSecrets(text: string): SecretHit[];
/** Secret-named assignments inside code (const API_KEY = '...'), checked by entropy. */
export declare function findCodeAssignments(code: string, minEntropy: number): SecretHit[];
/** A literal value stored under a secret-looking key. */
export declare function isHighEntropySecret(value: string, minEntropy: number, minLength?: number): boolean;
