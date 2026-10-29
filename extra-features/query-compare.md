# Query comparison

**Status:** done

## Summary

Runs the query that is applied in the Documents tab against the same collection in another
database of the same connection and shows both result sets side by side. Each document is matched by `_id` and its
JSON is diffed line by line, like `git diff --side-by-side`, so differences between two
databases (for example a copy and the original) are visible at a glance.

## How to enable

Always on in the Documents tab. There is no setting.

## How to use

1. Open a collection in the Documents tab and apply a query (or leave the query empty).
2. Click **Compare** in the toolbar, next to **Queries**.
3. Pick a database in the **Compare with** dropdown. It lists the databases on the connection that
   have a collection with the current collection's name. The collection itself is not picked; for
   now the target is always `<database>.<current collection>`. Picking a collection will come later.
4. The same query runs on that collection. The view shows:
   - Two column titles: the current namespace and the picked one.
   - One block per document, titled `Document N`, with its status:
     - `unchanged`: both sides are identical.
     - `changed`: the document exists on both sides and differs. Removed lines are red on the left,
       added lines are green on the right, and lines with no counterpart show a grey cell.
     - `only in <namespace>`: the document is on that side only.
5. Change the query and the comparison reruns with the new query. Close with the X button to return
   to the normal document list.

Ordering: while Compare is open, a query without a sort gets `{ _id: 1 }` in the sort box and is
applied, so both sides are in `_id` order and the documents line up. The change is visible in the
query bar. Clearing the sort while Compare is open adds `_id` back.

Documents are the current page of each side: the same filter, projection, sort, skip and limit,
capped at the documents-per-page setting.

The diff waits until the current collection has finished refreshing for the applied query, so the
two sides always come from the same query.

## Limits

Set in `packages/compass-crud/src/components/query-compare/limits.ts` (`COMPARE_LIMITS`), so a
comparison cannot exhaust memory or freeze the page:

- At most 50 documents per side. The view says how many were left out.
- At most 300 rendered rows per document. A longer document shows `N more lines not shown`.
- At most 3000 rendered rows in total. Documents past that budget are dropped with a notice.
- The line diff uses an LCS table only up to 4 million cells per document; larger documents are
  compared line by line by position instead.

## Where the code lives

- `packages/compass-crud/src/components/query-compare/query-compare-view.tsx`: the view. Pairs
  documents by `_id`, renders the side-by-side blocks and the namespace picker.
- `packages/compass-crud/src/components/query-compare/line-diff.ts`: side-by-side line diff (LCS,
  positional fallback for very large documents).
- `packages/compass-crud/src/components/query-compare/list-databases.ts`: lists the databases
  on the connection that have a collection with the current collection's name.
- `packages/compass-crud/src/components/query-compare/limits.ts`: the caps above.
- `packages/compass-crud/src/components/query-compare/*.spec.ts(x)`: tests.

## Upstream files modified

- `packages/compass-crud/src/components/document-list.tsx`: the Compare toggle, the comparison
  state, the `_id` sort guard while comparing, and the branch in `renderContent` that shows the
  view instead of the document list.
- `packages/compass-crud/src/stores/crud-store.ts`: `listComparableDatabases()` and
  `fetchComparisonDocuments(ns)`. The second reuses `fetchDocuments`, sorted by `_id` when the
  query has no sort.
- `packages/compass-query-bar/src/components/hooks.tsx`: `useApplyQueryBarSort` sets the sort
  field and applies the query (exported from `packages/compass-query-bar/src/index.tsx`).
- `packages/compass-crud/src/utils/data-service.ts`: adds `listDatabases` to the required data
  service methods, so the store can list the namespaces on the connection.

## How to test

```bash
npm test -w @mongodb-js/compass-crud src/components/query-compare/
```

Manual check: connect to a server with two databases that have a same-named collection with
different contents, open one in the Documents tab, click Compare, and pick the other.

## Known limitations

- Only the current page is compared (the documents-per-page limit), not the whole result set.
  Documents that fall outside the page on one side can show as `only in ...`.
- The comparison runs the query again on the other collection, so it costs one extra query per
  refresh while the view is open.
- The `_id` sort is added to the applied query in the Documents tab too, so the main list is
  sorted by `_id` while Compare is open.
- The collection cannot be picked yet; the target is always the current collection name.
- Documents are matched by `_id`. When the projection leaves `_id` out, they are matched by
  position, which is only meaningful when both sides are sorted the same way.
- Shows the full JSON of every document, including unchanged ones; no folding of unchanged
  context yet.
