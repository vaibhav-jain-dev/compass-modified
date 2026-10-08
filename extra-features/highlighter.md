# Highlighter

**Status:** done (verified in the web sandbox against a real database; Electron best effort)

**Targets:** web sandbox (`npm run start-web`) is primary. Electron works but is best effort.

## Summary

Highlighter lets you mark which collections ("models"), which fields inside them, and which
cross-collection relations matter for a given piece of work, and have Compass visually
highlight them everywhere: in the sidebar listing, inside documents, and in a dedicated
Highlighter tab with notes and attachments. Highlights are grouped by **feature label**. You pick
the active feature from a dropdown and Compass swaps all highlights at once.

The whole configuration lives in one YAML file. That makes it trivial for an agent to update:
"add `payment.status` to the order-checkout feature as a focus field" is a YAML edit, and
Compass reloads the file live.

See [`highlighter.example.yaml`](highlighter.example.yaml) for a complete, commented example of
every supported key. Agents should treat that file as the schema reference.

## How to enable

The feature is on when a config file exists. Nothing is highlighted until the file contains at
least one feature and `activeFeature` points at it.

Where the config comes from depends on the target:

- **Web sandbox:** the dev server reads and writes the file on your behalf through
  `GET/PUT /highlighter/config` (see `packages/compass-web/scripts/sandbox-dev-server.js`). The
  browser polls it, so edits made by an agent show up within a couple of seconds.
- **Electron:** the app reads the file directly.
- **compass-web embedded in Atlas:** no backend is passed to `CompassWeb`, so the feature is
  disabled and nothing renders.

- Default config path, chosen to be visible so agents find it with zero setup:
  - Linux / WSL: `~/compass-highlighter/highlighter.yaml`
  - Windows: `%USERPROFILE%\compass-highlighter\highlighter.yaml`
- Override: Settings > Highlighter > "Config file path", only if you want it elsewhere. Agents
  do not need this; the project skill knows the default.
- "Create from example" in the Highlighter tab writes `highlighter.example.yaml` to the config
  path when none exists. An agent can do the same by copying the example file there.

## How to use

### Pick the active feature

A dropdown labelled with the current feature sits at the top of the sidebar. Choosing another
entry rewrites `activeFeature` in the YAML and re-renders all highlights. "None" turns
highlighting off without touching the config.

### Sidebar listing

The eye button next to the search box toggles between "only the collections of the active
feature" and "everything" for the session, without touching the YAML. Tagged collections show an
(i) icon; hovering lists the tags with their colours.

Depending on `display.listing` (global or per feature):

- `all`: every database and collection is shown; highlighted collections get a coloured badge.
- `dim-others`: same, but non-highlighted entries are faded.
- `only-interested`: only databases and collections mentioned by the active feature are shown.
  A footer link "Show all" temporarily reveals the rest.

### Document views

In the Documents tab (list, JSON and table views) any field whose `path` matches a field in the
active feature is highlighted with its style. Hovering shows a tooltip with the field notes and
its `relatedTo` entries. Clicking a related entry opens that collection with a query on the
related field's value.

### Model files: highlights that do not depend on the ticket

A `models/<database>.yaml` file next to `highlighter.yaml` holds what you know about the data
model itself: per collection an alias, style, tags and notes, and per field a style, a short
`label` (its meaning), tags and notes. It applies whatever feature is active, also when none is,
so the everyday highlights do not disappear when you switch tickets. Features layer their own
entries on top: for the same path the feature's style and label win, tags and relations are
combined. See [`highlighter.models.example.yaml`](highlighter.models.example.yaml).

### Mappings and related-document popups

A second kind of file, `mappings/<database>.yaml` next to `highlighter.yaml`, describes which
field points at which document (`from: orders.customerId`, `to: customers._id`). It is
independent of features and meant to be maintained per database. See
[`highlighter.mappings.example.yaml`](highlighter.mappings.example.yaml).

In the Documents tab a mapped field (or a field with `relatedTo` in the feature) gets a link
icon. Clicking it (or Ctrl + double-clicking the value) opens the related documents in a floating
panel, found with a filter built from the field's value (`as: auto` matches both the ObjectId
and its hex string, because some collections store ids as text). Panels are independent windows:
drag one by its header, keep several open side by side to compare, close each on its own. Each
panel says where it came from (collection, field path and the id or key it was built from) and
has "Open in new tab", which opens the collection with the same filter in the query bar. Fields
inside a panel are highlighted and mapped too, so a link followed inside a panel opens another
panel cascaded next to it. When a field maps to several targets the panel offers the others as
buttons.

Path matching rules (feature fields, model fields and mappings alike):

- Dot paths match nested documents: `payment.status`.
- `[]` matches every array element: `items[].sku`. Array elements get the same decoration and
  link as the array itself, each with its own value.
- `*` matches exactly one segment, for maps keyed by an id: `occurrences.*.buckets.field_ids`.
- `**` matches any number of segments: `**.updatedAt`.
- Paths are otherwise exact, not prefixes. `payment` does not highlight `payment.status`.
- An exact entry wins over wildcard entries for the same concrete path.

Opening a link: click the link icon next to the key, or **Ctrl + double-click** (Cmd on macOS)
the value. Linkable values are underlined with dots. A mapping with `use: key` links from the
element's key instead of its value, for maps keyed by an id (`from: occurrences.*`).

### Tags

`tags:` at the top of the file defines named tags with colours (`color`, `background`,
`description`). Collections and fields reference them with `tags: [name, ...]`. Undefined tag
names still work and get a stable colour.

### What a highlighted document looks like

- A coloured banner above the document list (once, not per card) names the collection the way you
  think about it (the collection's `alias`, icon and notes, from the model file or the feature).
  Panels show the same banner once at the top.
- A highlighted field gets its key in the style's colour, the row in the style's background, a
  small uppercase chip with the field's `label` (its meaning), and the style icon.
- A highlighted object or array that is expanded frames its children with a coloured left border
  and background, so a portion of the document reads as one labelled region. Regions nest.
- A linkable id value is drawn as a pill and underlines nothing else; the link icon, or
  Ctrl + double-click on the value, opens the related documents.

### Highlighter tab

An instance-level workspace tab (next to "My Queries") that shows the active feature:

- its description, a `status` badge, tags, notes and artifacts (clickable links);
- a checklist (`checks`) whose boxes write `done` back to the YAML;
- every collection with its `role` (changes / linked / untouched), style, notes, and fields with
  their `label` chip (e.g. "family key"), style and relations;
- queries (`queries`): plain finds get an "Open with filter" button that opens the collection
  with that filter in the query bar; everything else is shown as code with the expected result;
- code references (`code`), rendered as links when `codeBaseUrl` is set;
- a "Mappings" status section listing the loaded `mappings/<database>.yaml` files, their entry
  counts and any parse errors;
- a "Relations" list built from all `relatedTo` and `relations` entries;
- an inline notes editor for the feature, each collection and each field. Saving writes back
  to the YAML and keeps every other key untouched.

### Asking an agent to update it

There is a project skill for this: `.claude/skills/highlighter/SKILL.md`. Agents running in this
repo load it when you mention the highlighter.

Because the config is a plain YAML file, you can say things like:

- "Add `shop.payments` to the order-checkout feature with `orderId` as a relation field to
  `shop.orders._id`."
- "Create a new feature `refunds` and make it active."
- "Add a note on `shop.orders.payment.status` explaining the enum values."
- "Attach this artifact link to the onboarding feature notes."

The agent edits the file, Compass reloads it, and the UI updates without a restart.

## Where the code lives

- `packages/compass-highlighter/`: the plugin package.
  - `src/config/backend.ts`: the `ConfigBackend` interface the store talks to, plus the inert
    `NullConfigBackend`.
  - `src/config/file-backend.ts` (exported from `@mongodb-js/compass-highlighter/node`): Node
    file backend used by Electron, path from the `highlighterConfigPath` preference.
  - `src/config/http-backend.ts` (exported from `@mongodb-js/compass-highlighter/http-backend`):
    browser backend used by the web sandbox.
  - `src/config/document.ts`: comment-preserving YAML edits on text.
  - `src/config/mappings.ts`: schema and index for `mappings/<database>.yaml`.
  - `src/config/models.ts`: schema for `models/<database>.yaml`.
  - `src/config/paths.ts`: path normalisation, wildcard matching and the path index.
  - `src/config/link-filter.ts`: builds the filter that finds related documents from a value.
  - `src/components/related-navigation.tsx`: the nested related-documents popup.
  - `src/components/listing-toggle.tsx`: the sidebar eye button.
  - `src/config/schema.ts`: zod schema for the YAML. `.passthrough()` everywhere so agents can
    keep extra keys.
  - `src/config/paths.ts`: field path normalisation (`items[].sku` to `items.sku`).
  - `src/config/resolve.ts`: turns a feature into indexed lookups (by namespace, by field path).
  - `src/config/yaml-file.ts`: reads, writes and watches the file. Writes go through the `yaml`
    Document API so comments survive UI edits.
  - `src/config/example-config.ts`: generated copy of `highlighter.example.yaml`; a test fails
    if the two drift. Regenerate with `npm run sync-example -w @mongodb-js/compass-highlighter`.
  - `src/stores/`: redux store, thunks (load, set active feature, update notes, create from
    example) and plugin activation (preference and file watchers).
  - `src/hooks.ts`: `useActiveFeature`, `useHighlighterListing`,
    `filterConnectionsForHighlighter`. All degrade to "nothing highlighted" when the plugin is
    not mounted, which is the case in compass-web.
  - `src/components/feature-select.tsx`: sidebar dropdown.
  - `src/components/field-decorations.tsx`: bridges the active feature into the
    `FieldDecorationsProvider` of compass-components for a namespace.
  - `src/components/highlighter-workspace.tsx`: the Highlighter tab.
  - `src/components/notes-editor.tsx`: inline notes editor used by the tab.
- `packages/compass-components/src/components/document-list/field-decorations-context.tsx`:
  generic "decorate a field by path" context consumed by `element.tsx`.
- `packages/compass-connections-navigation/src/item-decorations.tsx`: generic "decorate a tree
  item" context consumed by `base-navigation-item.tsx`.
- `packages/compass-settings/src/components/settings/highlighter.tsx`: Settings > Highlighter.

## Upstream files modified

- `packages/workspace-info/src/workspace-info.ts`: `Highlighter` workspace type.
- `packages/compass-workspaces/src/provider.tsx`, `stores/workspaces.ts`,
  `components/workspaces-provider.tsx`, `components/workspace-tab-context-provider.tsx`:
  register the new workspace type and `openHighlighterWorkspace`.
- `packages/compass-components/src/components/document-list/element.tsx`: reads the field
  decoration and applies colour, weight, background, chip, icon, tooltip, the nested region and
  Ctrl + double-click; exports `getFullKeyPathForElement`.
- `packages/compass-components/src/components/document-list/element-editors.tsx`: the read-only
  value span handles Ctrl + double-click and the pill style for linkable ids.
- `packages/compass-components/src/components/document-list/decorated-document-header.tsx` (new),
  `field-decorations-context.tsx` (new), `index.ts`, `src/index.ts`: the decoration contexts,
  the collection banner and exports.
- `packages/compass-connections-navigation/src/base-navigation-item.tsx`, `src/index.ts`:
  reads the item decoration (colour dot or icon, dimming) and exports the provider.
- `packages/compass-sidebar/src/components/multiple-connections/sidebar.tsx`: feature dropdown.
- `packages/compass-sidebar/src/components/multiple-connections/navigation/navigation.tsx`:
  "Highlighter" navigation item.
- `packages/compass-sidebar/src/components/multiple-connections/connections-navigation.tsx`:
  `only-interested` filtering and item decorations for the tree.
- `packages/compass-crud/src/components/document-list.tsx`: wraps the document views in
  `HighlighterFieldDecorations` and renders the collection banner once above the list.
- `packages/compass-preferences-model/src/preferences-schema.tsx`: `highlighterConfigPath`.
- `packages/compass-settings/src/components/modal.tsx`, `src/stores/settings.ts`: settings tab.
- `packages/compass/src/app/components/home.tsx`, `workspace.tsx`: mount the plugin and tab.
- `packages/compass-web/src/entrypoint.tsx`: `highlighterBackend` prop on `CompassWeb`, plugin
  mount and tab registration. `sandbox/index.tsx` passes the HTTP backend;
  `sandbox/sandbox-multiplex-link.ts` reads the ws port injected by the dev server.
- `packages/compass-web/webpack.config.js`, `scripts/sandbox-dev-server.js`: port fallback, the
  `/highlighter/config`, `/highlighter/config/mappings` and `/highlighter/config/models`
  endpoints, ws URL injection.
- `packages/compass/package.json`, `packages/compass-sidebar/package.json`,
  `packages/compass-crud/package.json`: dependency on `@mongodb-js/compass-highlighter`.

## Validating a config

```bash
extra-features/validate-highlighter.sh          # default file and its models/ and mappings/ folders
extra-features/validate-highlighter.sh my.yaml  # any file
```

Prints syntax errors with line and caret, schema errors with YAML path and line, and semantic
warnings. Agents run this after every edit (the project skill requires it). Also available as
`npm run validate -w @mongodb-js/compass-highlighter -- [path]`.

## How to test

```bash
npm test -w @mongodb-js/compass-highlighter
```

Manual: start Compass, drop `highlighter.example.yaml` into the config path, connect to any
server with a `shop` database, and confirm the sidebar, document view and Highlighter tab react
when you edit the YAML.

## Known limitations

- Field highlighting only applies to the list and table views of the Documents tab. The JSON
  view, Schema and Aggregations tabs are not covered yet.
- Notes are rendered as plain pre-formatted text, not markdown.
- The sidebar "Show all" footer link for `only-interested` is not built yet; switch the feature
  to "none" in the dropdown to see everything.
- Relations are informational. Compass does not validate that the target collection exists.
- The YAML is per Compass install, not per connection. Namespaces with the same name on two
  connections are highlighted on both.
