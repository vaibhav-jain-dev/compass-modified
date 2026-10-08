---
name: highlighter
description: Update the Compass fork's Highlighter files (highlighter.yaml, models/<database>.yaml, mappings/<database>.yaml) when the user says things like "update the highlighter", "highlight these fields for feature X", "add a note on <collection>.<field>", "mark <collection> as my focus", "only show these collections", "attach this artifact/link to the feature", "what does this field mean", "X points at Y / I should be able to jump from X to Y", or "tag these as ...". Also use when adding or changing Highlighter code in packages/compass-highlighter or explaining how the highlighter UI (panels, chips, toggles) works.
---

# Highlighter skill

Highlighter is a fork-only Compass feature. It highlights the collections, fields and
cross-collection relations that matter for the feature the user is working on, grouped by a
**feature label** the user picks from a dropdown in the Compass sidebar, and it lets the user
jump from an id to the document it points at. Everything is driven by YAML files that Compass
reloads live, so your job is almost always a YAML edit.

Read first: `extra-features/highlighter.md` (behaviour) and the three commented examples in
`extra-features/`: `highlighter.example.yaml`, `highlighter.models.example.yaml`,
`highlighter.mappings.example.yaml`.

## 1. Find the files (no questions, no manual steps)

Everything lives in one visible folder. Do not ask the user where it is:

| File                                             | Holds                                                                                                                                                      |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `~/compass-highlighter/highlighter.yaml`         | features (tickets / pieces of work): status, collections with roles, fields, notes, queries, code refs, checks, artifacts; plus global `styles` and `tags` |
| `~/compass-highlighter/models/<database>.yaml`   | feature-independent data model knowledge: what collections and fields mean, their style, tags and notes; applies whatever feature is active                |
| `~/compass-highlighter/mappings/<database>.yaml` | which field points at which document (`from` / `to`), used for the link icons and the related-document panels                                              |

On Windows the folder is `%USERPROFILE%\compass-highlighter\`. If a file does not exist,
create it from the matching example (keep `version`, `display`, `styles`, `tags`; replace the
example entries with what the user asked for). Compass picks changes up without a restart.

Only if the user explicitly set Settings > Highlighter > "Config file path" does the main file
live elsewhere; the Highlighter tab shows the path in use and the loaded model and mapping files.

## 2. Edit the YAML, not the UI

Compass watches the file and reloads it within about a second. Rules:

- **Preserve comments and key order.** Edit the file in place; never regenerate it from a parsed
  object. Compass itself writes through a comment-preserving YAML document API.
- **One feature per piece of work.** `features[].id` is lowercase-kebab and stable; `label` is
  what the dropdown shows. Set `activeFeature` to the feature the user is working on now.
- **Collections** are `db.collection` namespaces. Anything not listed is "not interested" for
  that feature, which matters when `display.listing` is `only-interested`.
- **Field paths** are dot paths. Use `[]` for "each array element" (`items[].sku`), `*` for one
  dynamic segment such as an id used as a key (`occurrences.*.buckets`), `**` for any depth
  (`**.updatedAt`). Otherwise paths are exact, not prefixes; an exact entry beats a wildcard.
- **Relations** go on the field (`relatedTo: [{ namespace, path }]`) when they are field-level,
  or under `relations:` when they are conceptual (`from`, `to`, `via`, `notes`).
- **Styles** are named under `styles:` and referenced by name. Built-in fallbacks exist for
  `primary`, `focus`, `relation`, `muted`. Add a new style instead of overloading one.
- **Notes** are plain text (markdown is not rendered yet). Quote any value containing `: ` or
  starting with special characters, e.g. `notes: 'Enum: a | b'`.
- **Artifacts** are `{ title, url, kind }` links shown next to the feature notes. Use them for
  claude.ai artifact links, docs, tickets and local files (`file:///...`).
- **Status** (`status: in session`) is a free-form badge on the feature. **Roles** on collections
  (`role: changes | linked | untouched`) say how the feature relates to the model and pick a
  default style. **Field labels** (`label: family key`) are short meanings shown as chips.
- **Queries** (`queries:` with `title`, `namespace`, `filter`, optional `project`/`sort`,
  `expect`, `notes`) become "Open with filter" buttons in the tab; use `shell:` for anything
  that is not a plain find. Prefer concrete ids over placeholders: look them up in the database
  first when you can. Queries can also sit on a collection entry (feature or model file) without
  a `namespace`; those, plus feature queries targeting the collection, fill the Documents tab
  **Queries** menu and serve as worked examples for the local AI (`local-ai` skill).
- **Code references** (`code:` with `path`, `line`, `notes`) become links when `codeBaseUrl` is
  set at the top of the file. **Checks** (`checks:` with `text`, `done`) are a checklist the
  user ticks in the tab; the tab writes `done` back.
- **Tags**: define them under `tags:` at the top (`color`, `background`, `description`) and
  reference them from collections or fields with `tags: [name]`. Shown behind an (i) icon in
  the sidebar and in field tooltips.
- **Model files** (`models/<database>.yaml`, next to the config, e.g.
  `~/compass-highlighter/models/devlms.yaml`) hold feature-independent knowledge: per
  collection `alias`, `style`, `tags`, `notes`; per field `path`, `style`, `label`, `tags`,
  `notes`. Put "what this field means" there, and only ticket-specific notes in a feature.
  See `extra-features/highlighter.models.example.yaml`.
- **Mapping options**: `as: auto` (default) matches both an ObjectId and its hex string, for
  collections that store ids as text; `objectId` / `string` force one shape. `use: key` links
  from a map entry's key instead of its value (`from: occurrences.*`, `to: fields._id`).
- **Mappings and models have their own skills** (`mappings`, `models`); use those for
  "X points at Y" and "what does this field mean" requests.
- **Mappings live in a separate file per database**: `mappings/<database>.yaml` next to the
  config (e.g. `~/compass-highlighter/mappings/devlms.yaml`), entries `from: collection.path`,
  `to: collection.path`, optional `label`, `as` (auto | objectId | string), `notes`. The user
  owns these files; add or correct entries only when asked, and never move them into
  `highlighter.yaml`. See `extra-features/highlighter.mappings.example.yaml`.
- Unknown keys are allowed and preserved, so you may add agent metadata (e.g. `source:`), but
  do not rely on Compass showing it.
- `display.listing`: `all`, `dim-others` (default) or `only-interested`. Can be set globally
  and overridden per feature.

Typical requests and what to change:

| User says                                                | Edit                                                                                                                                                                                                           |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "I'm working on refunds now"                             | add `features[] { id: refunds, label: Refunds }` if missing, set `activeFeature: refunds`                                                                                                                      |
| "orders is my main model, customers is secondary"        | add both under `collections`, give `shop.orders` style `primary` and `shop.customers` style `focus`                                                                                                            |
| "customerId links to customers"                          | on `shop.orders` field `customerId`: `style: relation`, `relatedTo: [{ namespace: shop.customers, path: _id }]`                                                                                                |
| "note on payment.status: enum values"                    | add `notes:` on that field (quoted if it contains `: `)                                                                                                                                                        |
| "only show what I care about"                            | `display: { listing: only-interested }` on the feature                                                                                                                                                         |
| "attach this link to the feature"                        | append to `artifacts:` with a short `title` and `kind`                                                                                                                                                         |
| "keep this query / this is what I should see"            | append to `queries:` with `namespace` + `filter` (runnable) or `shell`, and `expect`                                                                                                                           |
| "this code writes it"                                    | append to `code:` with `path` and `line`                                                                                                                                                                       |
| "things to verify" / "what was missing"                  | append to `checks:` with `done: false`                                                                                                                                                                         |
| "X points at Y" / "I should be able to jump from X to Y" | add a mapping to `mappings/<database>.yaml` (`from`, `to`, `label`)                                                                                                                                            |
| "tag these as ..."                                       | define the tag under `tags:` with a colour, add `tags: [...]` on the entries                                                                                                                                   |
| "turn this document/ticket into highlights"              | one feature per ticket (`id` from the ticket key), `status` from its state, `collections` with `role`, field `label`s for the meanings, `queries`, `code`, `checks` from the write-up, diagrams as `artifacts` |

## 3. Validate after every edit (mandatory)

```bash
extra-features/validate-highlighter.sh            # the config plus its models/ and mappings/ folders
extra-features/validate-highlighter.sh <path>     # another config file (and the folders next to it)
```

It reports YAML syntax errors with line, column and a caret, schema errors with the YAML path
and line, and semantic problems (unknown `activeFeature`, duplicate ids, namespaces without a
dot, undeclared styles, relations or queries on collections the feature does not list, query
filters that do not parse, `use: key` on a path that is not a map entry). Fix every `✖` before
telling the user you are done; `⚠` lines are worth mentioning. Exit code 1 means Compass is
still showing the previous valid config. If it says the schema is not compiled, run
`npm run compile -w @mongodb-js/compass-highlighter` once.

Then tell the user which feature is active; Compass reloads the files on its own.

## 4. What the user sees (so you can explain it)

- Sidebar: the feature dropdown; an eye button next to the search box that shows only the
  active feature's collections; the funnel's filter popover with a multi-select of highlighter
  tags (Select all / Clear) that narrows the tree to tagged collections; a coloured icon or dot
  on highlighted collections and an (i) icon listing their tags.
- Documents tab: a banner above the list naming the collection (alias, icon, notes); highlighted
  rows in the style's colour with an uppercase chip for the field's `label`; expanded objects or
  arrays framed as a labelled region, nesting as the document nests; linkable ids drawn as pills.
- Links: the link icon next to a mapped field, or Ctrl + double-click on its value, opens the
  related documents in a floating panel. Panels are draggable by the grip, stay open side by
  side, show a copyable breadcrumb `collection.path[0].field → target(id)`, and have "Open in
  new tab". A link inside a panel opens another panel.
- The highlighter button in the Documents toolbar hides or shows all marks for the session.
- Editing is opt-in: documents are read-only until the pencil toggle in the Documents toolbar is
  on (fork feature, see `extra-features/edit-mode-toggle.md`).
- Highlighter tab: the active feature's description, status, notes, artifacts, checklist,
  collections, queries with "Open with filter", code references, relations, and the loaded
  model and mapping files with any parse errors.

## 5. Changing the Highlighter code or schema

- Code lives in `packages/compass-highlighter`. Schemas: `src/config/schema.ts` (config),
  `src/config/models.ts`, `src/config/mappings.ts`; path matching in `src/config/paths.ts`;
  panels in `src/components/related-navigation.tsx`. Upstream touch points are listed in
  `extra-features/highlighter.md` under "Upstream files modified"; keep that list current.
- If you change a schema, update the matching example in `extra-features/` to show every key,
  then run `npm run sync-example -w @mongodb-js/compass-highlighter` (the main example is
  embedded in the package and a test fails if the two drift).
- The web sandbox serves the files through `packages/compass-web/scripts/sandbox-dev-server.js`;
  a new sidecar folder needs an endpoint there and a `read*` method on the config backends.
- Run `npm test -w @mongodb-js/compass-highlighter` and `npm run check -w @mongodb-js/compass-highlighter`.
- Rebuild dependents after touching shared contexts:
  `npm run compile -w @mongodb-js/compass-components -w @mongodb-js/compass-connections-navigation`.
