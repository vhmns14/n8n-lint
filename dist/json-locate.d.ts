import type { Location } from './types.js';
/**
 * Walks JSON text once and records where every value starts, keyed by JSON
 * pointer. Used to turn a finding's pointer into a line/column for editors,
 * SARIF, and GitHub annotations. Assumes the text already parsed with
 * JSON.parse, so it does not validate.
 */
export declare function locatePointers(text: string): Map<string, Location>;
/** Find the closest recorded location for a pointer, walking up to parents. */
export declare function resolveLocation(map: Map<string, Location>, pointer: string): Location;
