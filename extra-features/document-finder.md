# Document finder (Ctrl+F in the Documents tab)

**Status:** done

## Summary

Ctrl+F (Cmd+F on macOS) in the Documents tab list view opens Compass's own finder instead of
the browser's. It searches field paths and leaf values of the loaded documents, moves between
matches, expands and scrolls to each match, and suggests field paths from the current
collection while you type.

## How to enable

Always on in the list view. No setting or flag.

## How to use

1. Switch the Documents tab to the list view and click a document (or any empty area of the
   list) so the list has focus.
2. Press Ctrl+F. A finder bar appears at the top right of the list.
3. Type a field path or a value:
   - `sections[0].groups[0].lines[0].label` finds that field. The path format is the same as
     the "Copy path & value" context menu action.
   - `sections[0].groups` finds that field and every field under it.
   - `Title Company` finds leaf values containing that text, case-insensitively.
4. While typing, a list of field paths from the loaded documents appears below the input.
   Arrow keys move through it, Enter or a click accepts one. Esc closes the list.
5. Enter moves to the next match, Shift+Enter to the previous one. The match is expanded,
   scrolled into view and highlighted. The up and down buttons do the same.
6. Esc, or the close button, closes the finder. Ctrl+F again while open refocuses the input.

Ctrl+F does nothing special while focus is in the query bar or another input. The browser
find is used there.

## Where the code lives

- `packages/compass-crud/src/components/document-finder/search.ts`: builds the index of
  field paths and leaf values for the loaded documents, matches queries, and produces path
  suggestions.
- `packages/compass-crud/src/components/document-finder/reveal.ts`: expands the ancestors of
  a match and raises their "show more" count so the match renders.
- `packages/compass-crud/src/components/document-finder/document-finder.tsx`: the finder bar
  (input, suggestions, counter, buttons, keyboard handling) and the scroll-to-row logic.
- `packages/compass-crud/src/components/virtualized-document-list-view.tsx`: opens the finder
  on Ctrl+F and passes the loaded documents and the list ref to it.

## Upstream files modified

- `packages/compass-crud/src/components/virtualized-document-list-view.tsx`: mounts the finder,
  listens for Ctrl+F, wraps the virtual list in a positioned container, and falls back to an
  internal list ref when none is passed.

## How to test

```bash
npm test -w @mongodb-js/compass-crud src/components/document-finder/search.spec.ts
```

Manual steps the tests do not cover:

- Ctrl+F in the list view opens the finder and focuses it. Ctrl+F in the query bar still opens
  the browser find.
- A match inside a field that is collapsed or past the 25-field "show more" limit is expanded
  and scrolled to.
- The finder works in the Electron app and the web sandbox (`npm run start-web`).

## Known limitations

- Only the loaded documents are searched and suggested from, not the whole collection. Suggestions
  therefore reflect the page of documents that is loaded.
- Only the list view has the finder. Table and JSON views still use the browser find.
- Matched text is not highlighted inside rows. The matching row gets a background colour instead.
- Recent searches and the collection's schema from the Highlighter are not used for suggestions yet.
- A key search matches every field under the matched path, so a broad path can produce many matches.
