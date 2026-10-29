import type { SideBySideRow } from './line-diff';

export type LineField = {
  // Dotted path of the key on this line, without array indexes, as the
  // highlighter matches fields. Empty for lines without a key.
  path: string;
  key?: string;
};

type OpenBlock = { indent: number; key?: string };

const KEY_PATTERN = /^"((?:[^"\\]|\\.)*)":/;

/**
 * Field path of every line of a pretty-printed JSON document, so each line can
 * be decorated like the field it shows. Relies on the two-space indentation
 * that EJSON output uses.
 */
export function linePaths(lines: string[]): LineField[] {
  const open: OpenBlock[] = [];
  return lines.map((line) => {
    const trimmed = line.trimStart();
    const indent = line.length - trimmed.length;
    while (open.length > 0 && open[open.length - 1].indent >= indent) {
      open.pop();
    }
    if (trimmed.startsWith('}') || trimmed.startsWith(']')) {
      return { path: '' };
    }
    const key = KEY_PATTERN.exec(trimmed)?.[1];
    const path = [...open.map((block) => block.key), key]
      .filter((segment): segment is string => segment !== undefined)
      .join('.');
    if (/[{[]$/.test(trimmed.trimEnd())) {
      open.push({ indent, key });
    }
    return { path, key };
  });
}

export type AnnotatedRow = SideBySideRow & {
  leftField?: LineField;
  rightField?: LineField;
};

/**
 * Attaches the field of each line to the diff rows. Every non-empty cell is one
 * line of its side, in order, so the lines are consumed in that order.
 */
export function annotateRows(
  rows: SideBySideRow[],
  leftLines: string[],
  rightLines: string[]
): AnnotatedRow[] {
  const leftPaths = linePaths(leftLines);
  const rightPaths = linePaths(rightLines);
  let left = 0;
  let right = 0;
  return rows.map((row) => {
    const leftField = row.left.kind === 'empty' ? undefined : leftPaths[left++];
    const rightField =
      row.right.kind === 'empty' ? undefined : rightPaths[right++];
    return { ...row, leftField, rightField };
  });
}
