# Deep links

**Status:** planned (build after [Highlighter](highlighter.md))

## Summary

A shareable URL that opens this Compass fork directly on a specific document, with the
Highlighter feature selected and, optionally, a specific field scrolled into view and flashed.
You can paste the link to a teammate or an agent, and an agent can hand you a link that lands
exactly on the document it is talking about.

## How to enable

Always on once implemented. On first launch the app registers itself as the handler for the
`compassx://` scheme. The scheme is deliberately **not** `mongodb://` or `compass://`, so it never
collides with the official Compass that is also installed on the same Windows machine.

## How to use

### Link format

```
compassx://open?connection=<connectionId|name>&ns=<db.collection>&id=<documentId>&feature=<featureId>&field=<path>
```

| Parameter    | Required | Meaning                                                                |
| ------------ | -------- | ---------------------------------------------------------------------- |
| `connection` | no       | Saved connection id or exact name. Omitted: current active connection. |
| `ns`         | yes      | Namespace, `db.collection`.                                            |
| `id`         | yes      | Document `_id`, as extended JSON (`{"$oid":"..."}`) or a plain string. |
| `feature`    | no       | Highlighter feature id to activate before opening.                     |
| `field`      | no       | Field path to scroll to and flash, same syntax as Highlighter paths.   |
| `view`       | no       | `list`, `json` or `table`. Defaults to the last used view.             |

Example:

```
compassx://open?ns=shop.orders&id=%7B%22%24oid%22%3A%2266f1c0a2e4b0c1d2e3f4a5b6%22%7D&feature=order-checkout&field=payment.status
```

### Getting a link

- Document context menu > "Copy highlight link" copies a link to that document. If a field is
  right-clicked, `field` is included.
- Highlighter tab > each field row has a "Copy link" action that includes the feature.
- Agents build the link by hand from the format above.

### Opening a link

- Clicking the link in a browser, terminal or chat opens (or focuses) Compass and navigates.
- If the connection is not connected, Compass connects first using the saved connection.
- If the document is not found, Compass opens the collection with `{ _id: <id> }` as the query
  and shows an empty result, so it is obvious what was being looked for.
- Links can also be opened from inside the app: paste into the "Open link" field in the
  Highlighter tab. This is the only way on platforms where scheme registration is unavailable.

## Where the code lives

Planned:

- `packages/compass-highlighter/src/deep-links/`: parse and build URLs, navigation orchestration.
- `packages/compass/src/main/`: `app.setAsDefaultProtocolClient('compassx')`, `open-url` and
  second-instance handling, forwarding the URL to the renderer over IPC.

## Upstream files modified

To be filled in during implementation. Expected: Compass main process (protocol registration and
single-instance lock), `compass-crud` (context menu entry, scroll-to-field), `compass-workspaces`
(open collection with initial query).

## How to test

```bash
npm test -w @mongodb-js/compass-highlighter -- --grep="deep links"
```

Manual on Linux / WSL: `xdg-open 'compassx://open?ns=shop.orders&id=...'` with Compass running
and not running.

## Known limitations

- Scheme registration on Windows from a dev build is unreliable. The in-app "Open link" field
  is the fallback.
- `connection` by name requires the name to be unique among saved connections.
