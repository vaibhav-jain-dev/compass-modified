# Edit mode toggle

**Status:** done (web sandbox and Electron)

## Summary

In the Documents tab, documents are read-only until you switch edit mode on. Upstream Compass
starts an edit as soon as you double-click a field value, which is easy to do by accident while
reading. In this fork a double-click does nothing until edit mode is on.

## How to enable

Always on. The toggle is per collection tab and starts off every time a tab is opened.

## How to use

The pencil button in the Documents toolbar, on the right next to the refresh button and the
page controls, toggles edit mode:

- **Off** (default): documents cannot be edited, the per-document edit action is hidden, and
  double-click does nothing. Add Data, bulk operations and export stay available.
- **On**: upstream behaviour, including double-click to edit and the per-document pencil.

The toggle is hidden when the collection cannot be edited at all (read-only preference, Data
Lake, a view, or a query with a projection).

## Where the code lives

- `packages/compass-crud/src/components/document-list.tsx`: `editMode` local state, `isEditable`
  is `canEdit && editMode`.
- `packages/compass-crud/src/components/crud-toolbar.tsx`: `editMode` / `onToggleEditMode` props
  and the toggle button.

## Upstream files modified

The two files above.

## How to test

```bash
npm test -w @mongodb-js/compass-crud src/components/crud-toolbar.spec.tsx
```

## Known limitations

- The state is not remembered across tabs or restarts; it is deliberately opt-in each time.
