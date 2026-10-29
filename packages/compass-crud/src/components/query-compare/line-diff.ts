export type DiffCellKind = 'same' | 'removed' | 'added' | 'empty';

export type DiffCell = { text: string; kind: DiffCellKind };

export type SideBySideRow = { left: DiffCell; right: DiffCell };

type DiffOp = { type: 'same' | 'removed' | 'added'; text: string };

const EMPTY_CELL: DiffCell = { text: '', kind: 'empty' };

// Above this many cells the LCS table gets too big to be worth it, so the
// lines are compared position by position instead.
const MAX_LCS_CELLS = 4_000_000;

function positionalOps(a: string[], b: string[]): DiffOp[] {
  const ops: DiffOp[] = [];
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    if (i < a.length && i < b.length && a[i] === b[i]) {
      ops.push({ type: 'same', text: a[i] });
      continue;
    }
    if (i < a.length) {
      ops.push({ type: 'removed', text: a[i] });
    }
    if (i < b.length) {
      ops.push({ type: 'added', text: b[i] });
    }
  }
  return ops;
}

function lcsOps(a: string[], b: string[]): DiffOp[] {
  const width = b.length + 1;
  // table[i * width + j] is the LCS length of a[i:] and b[j:]
  const table = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * width + j] =
        a[i] === b[j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ type: 'same', text: a[i] });
      i++;
      j++;
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      ops.push({ type: 'removed', text: a[i] });
      i++;
    } else {
      ops.push({ type: 'added', text: b[j] });
      j++;
    }
  }
  for (; i < a.length; i++) {
    ops.push({ type: 'removed', text: a[i] });
  }
  for (; j < b.length; j++) {
    ops.push({ type: 'added', text: b[j] });
  }
  return ops;
}

function opsToRows(ops: DiffOp[]): SideBySideRow[] {
  const rows: SideBySideRow[] = [];
  let removed: string[] = [];
  let added: string[] = [];

  // A run of removed lines followed by added lines is a change: pair them up
  // on the same rows, like `git diff --side-by-side`.
  const flushChange = () => {
    const count = Math.max(removed.length, added.length);
    for (let k = 0; k < count; k++) {
      rows.push({
        left:
          k < removed.length
            ? { text: removed[k], kind: 'removed' }
            : EMPTY_CELL,
        right:
          k < added.length ? { text: added[k], kind: 'added' } : EMPTY_CELL,
      });
    }
    removed = [];
    added = [];
  };

  for (const op of ops) {
    if (op.type === 'removed') {
      removed.push(op.text);
    } else if (op.type === 'added') {
      added.push(op.text);
    } else {
      flushChange();
      rows.push({
        left: { text: op.text, kind: 'same' },
        right: { text: op.text, kind: 'same' },
      });
    }
  }
  flushChange();
  return rows;
}

/**
 * Aligns two texts line by line for a side-by-side diff. Lines missing on one
 * side get an `empty` cell so both columns always have the same number of rows.
 */
export function sideBySideLineDiff(
  leftLines: string[],
  rightLines: string[]
): SideBySideRow[] {
  const useLcs =
    (leftLines.length + 1) * (rightLines.length + 1) <= MAX_LCS_CELLS;
  return opsToRows(
    useLcs
      ? lcsOps(leftLines, rightLines)
      : positionalOps(leftLines, rightLines)
  );
}
