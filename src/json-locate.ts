import type { Location } from './types.js';

/**
 * Walks JSON text once and records where every value starts, keyed by JSON
 * pointer. Used to turn a finding's pointer into a line/column for editors,
 * SARIF, and GitHub annotations. Assumes the text already parsed with
 * JSON.parse, so it does not validate.
 */
export function locatePointers(text: string): Map<string, Location> {
  const out = new Map<string, Location>();
  let i = 0;
  let line = 1;
  let col = 1;

  const advance = (n = 1) => {
    for (let k = 0; k < n; k++) {
      if (text.charCodeAt(i) === 10) {
        line++;
        col = 1;
      } else {
        col++;
      }
      i++;
    }
  };
  const ws = () => {
    while (i < text.length) {
      const c = text[i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\ufeff') advance();
      else break;
    }
  };
  const readString = (): string => {
    // text[i] === '"'
    const start = i;
    advance();
    while (i < text.length && text[i] !== '"') {
      if (text[i] === '\\') advance(2);
      else advance();
    }
    advance();
    return JSON.parse(text.slice(start, i)) as string;
  };
  const esc = (s: string) => s.replace(/~/g, '~0').replace(/\//g, '~1');

  const value = (ptr: string) => {
    ws();
    out.set(ptr, { line, column: col });
    const c = text[i];
    if (c === '{') {
      advance();
      ws();
      if (text[i] === '}') return advance();
      for (;;) {
        ws();
        const keyLoc = { line, column: col };
        const key = readString();
        // a key's own position is useful for pointing at a property name
        out.set(`${ptr}/${esc(key)}#key`, keyLoc);
        ws();
        advance(); // ':'
        value(`${ptr}/${esc(key)}`);
        ws();
        if (text[i] === ',') {
          advance();
          continue;
        }
        advance(); // '}'
        return;
      }
    } else if (c === '[') {
      advance();
      ws();
      if (text[i] === ']') return advance();
      for (let idx = 0; ; idx++) {
        value(`${ptr}/${idx}`);
        ws();
        if (text[i] === ',') {
          advance();
          continue;
        }
        advance(); // ']'
        return;
      }
    } else if (c === '"') {
      readString();
    } else {
      while (i < text.length && !/[\s,\]}]/.test(text[i]!)) advance();
    }
  };
  value('');
  return out;
}

/** Find the closest recorded location for a pointer, walking up to parents. */
export function resolveLocation(map: Map<string, Location>, pointer: string): Location {
  let p = pointer;
  for (;;) {
    const hit = map.get(p);
    if (hit) return hit;
    if (p === '') return { line: 1, column: 1 };
    p = p.slice(0, p.lastIndexOf('/'));
  }
}
