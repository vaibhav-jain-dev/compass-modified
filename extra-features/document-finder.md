# Document finder (Ctrl+F in the Documents tab)

**Status:** done

## Summary

Ctrl+F (Cmd+F on macOS) in the Documents tab list view opens Compass's own finder instead of
the browser's. It searches field paths and leaf values of the loaded documents, expands every
match so they are all visible, highlights the matched text, and can narrow the list to matching
documents and matching fields. It also suggests field paths from the current collection while
you type.

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
   - `Title Company` finds leaf values containing that text, case-insensitively. Key names
     containing the text match too.
4. Every match is expanded as you type, so matches inside collapsed fields and past the
   25-field "show more" limit are visible without clicking. The matched text in each row is
   highlighted, and a field that matched by path has its whole key highlighted.
5. While typing, a list of field paths from the loaded documents appears below the input.
   Arrow keys move through it, Enter or a click accepts one. Esc closes the list.
6. Enter moves to the next match, Shift+Enter to the previous one. The active match is scrolled
   into view and marked with a stronger row background. The up and down buttons do the same.
7. Two checkboxes narrow the list:
   - **Only matching documents** hides the documents that have no match. The counter in the bar
     still counts matches across all loaded documents.
   - **Only matching fields** hides the fields that do not match inside each document. Parents of
     a match stay visible so the match can be seen in context.
8. Esc, or the close button, closes the finder. Ctrl+F again while open refocuses the input.
   Closing the finder clears the highlights and both filters.

Ctrl+F does nothing special while focus is in the query bar or another input. The browser
find is used there.

## Where the code lives

- `packages/compass-crud/src/components/document-finder/search.ts`: builds the index of
  field paths and leaf values for the loaded documents, matches queries, collects the fields to
  keep for the "Only matching fields" filter, and produces path suggestions.
- `packages/compass-crud/src/components/document-finder/reveal.ts`: expands the ancestors of
  a match and raises their "show more" count so the match renders.
- `packages/compass-crud/src/components/document-finder/highlight.ts`: paints the matched text
  with the CSS Custom Highlight API, so the React-rendered rows are not changed.
- `packages/compass-crud/src/components/document-finder/use-document-finder.ts`: the finder's
  state: query, matches, both filters, expanding matches, scrolling, and the Ctrl+F shortcut.
- `packages/compass-crud/src/components/document-finder/document-finder.tsx`: the finder bar
  (input, suggestions, counter, buttons, checkboxes, keyboard handling).
- `packages/compass-components/src/components/document-list/find-filter-context.tsx`: a React
  context that tells the document and element components which fields to render during a find.

## Upstream files modified

- `packages/compass-crud/src/components/virtualized-document-list-view.tsx`: uses the finder
  hook, wraps the virtual list in a positioned container, and filters the documents shown.
- `packages/compass-components/src/components/document-list/element.tsx`: reads the find filter
  and renders only the children it keeps.
- `packages/compass-components/src/components/document-list/document.tsx`: reads the find filter
  and renders only the fields it keeps.
- `packages/compass-components/src/components/document-list/index.ts`: exports the filter
  provider and hook.

## How to test

```bash
npm test -w @mongodb-js/compass-crud src/components/document-finder
```

Manual steps the tests do not cover:

- Ctrl+F in the list view opens the finder and focuses it. Ctrl+F in the query bar still opens
  the browser find.
- A match inside a field that is collapsed or past the 25-field "show more" limit is expanded
  and highlighted.
- The highlight appears in the Electron app and in the web sandbox (`npm run start-web`). It
  needs a browser with the CSS Custom Highlight API.
- Both checkboxes change the list and the counter as described above.

## Known limitations

- Only the loaded documents are searched and suggested from, not the whole collection. Suggestions
  therefore reflect the page of documents that is loaded.
- Only the list view has the finder. Table and JSON views still use the browser find.
- Highlighting uses the CSS Custom Highlight API. Browsers without it show the matches, but no
  highlight.
- Text that is split across elements, such as some formatted values, is not highlighted.
- Recent searches and the collection's schema from the Highlighter are not used for suggestions yet.
- A key search matches every field under the matched path, so a broad path can expand many fields.
- Expanded fields stay expanded after the finder is closed.
