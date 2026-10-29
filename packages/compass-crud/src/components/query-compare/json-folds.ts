import type { DiffCell, SideBySideRow } from './line-diff';

const indentOf = (text: string) => text.length - text.trimStart().length;

const opensBlock = (cell: DiffCell) =>
  cell.kind !== 'empty' && /[{[]$/.test(cell.text.trimEnd());

/**
 * The row that closes the object or array opened on `start`, found by the
 * closing bracket at the same indentation. Empty cells (lines the other side
 * has) are skipped, so the search works on one side of an aligned diff.
 */
function closingRow(cells: DiffCell[], start: number): number | null {
  const indent = indentOf(cells[start].text);
  for (let i = start + 1; i < cells.length; i++) {
    const cell = cells[i];
    if (
      cell.kind !== 'empty' &&
      indentOf(cell.text) === indent &&
      /^[}\]]/.test(cell.text.trimStart())
    ) {
      return i;
    }
  }
  return null;
}

/**
 * Maps the row an object or array opens on to the last row it spans, on
 * either side of the diff. Rows strictly between the two are hidden when the
 * block is collapsed.
 */
export function findFoldRegions(rows: SideBySideRow[]): Map<number, number> {
  const cellsOf = (side: 'left' | 'right') => rows.map((row) => row[side]);
  const leftCells = cellsOf('left');
  const rightCells = cellsOf('right');
  const folds = new Map<number, number>();
  rows.forEach((row, index) => {
    const ends = [
      opensBlock(row.left) ? closingRow(leftCells, index) : null,
      opensBlock(row.right) ? closingRow(rightCells, index) : null,
    ].filter((end): end is number => end !== null);
    if (ends.length > 0) {
      folds.set(index, Math.max(...ends));
    }
  });
  return folds;
}
