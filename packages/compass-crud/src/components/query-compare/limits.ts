/**
 * Upper bounds that keep a comparison from exhausting memory or freezing the
 * page: one query runs per side, and every shown line becomes a DOM row.
 */
export const COMPARE_LIMITS = {
  // Documents per side. Each pair costs a diff and a block in the DOM.
  maxDocuments: 50,
  // Rendered rows for one document, so a single very large document cannot
  // fill the view.
  maxRowsPerDocument: 300,
  // Rendered rows across the whole comparison.
  maxRowsTotal: 3000,
} as const;
