---
name: highlighter
description: Update the Compass fork's Highlighter config (highlighter.yaml) when the user says things like "update the highlighter", "highlight these fields for feature X", "add a note on <collection>.<field>", "mark <collection> as my focus", "only show these collections", or "attach this artifact/link to the feature". Also use when adding or changing Highlighter code in packages/compass-highlighter.
---

# Highlighter skill

Highlighter is a fork-only Compass feature. It highlights the collections, fields and
cross-collection relations that matter for the feature the user is working on, grouped by a
**feature label** the user picks from a dropdown in the Compass sidebar. Everything is driven by
one YAML file that Compass reloads live, so your job is almost always a YAML edit.

Read first: `extra-features/highlighter.md` (behaviour) and
`extra-features/highlighter.example.yaml` (the complete, commented schema).

## 1. Find the config file (no questions, no manual steps)

The file is at a fixed, visible location. Do not ask the user where it is:

- Linux / WSL: `~/compass-highlighter/highlighter.yaml`
- Windows: `%USERPROFILE%\compass-highlighter\highlighter.yaml`

If it does not exist, create the folder and the file yourself from
`extra-features/highlighter.example.yaml` (keep `version`, `display` and `styles`; replace the
example `features` with what the user asked for). Compass picks it up without a restart.

Only if the user explicitly set Settings > Highlighter > "Config file path" does the file live
elsewhere; the Highlighter tab in Compass shows the path in use.

## 2. Edit the YAML, not the UI

Compass watches the file and reloads it within about a second. Rules:

- **Preserve comments and key order.** Edit the file in place; never regenerate it from a parsed
  object. Compass itself writes through a comment-preserving YAML document API.
- **One feature per piece of work.** `features[].id` is lowercase-kebab and stable; `label` is
  what the dropdown shows. Set `activeFeature` to the feature the user is working on now.
- **Collections** are `db.collection` namespaces. Anything not listed is "not interested" for
  that feature, which matters when `display.listing` is `only-interested`.
- **Field paths** are dot paths. Use `[]` for "each array element": `items[].sku`. Paths are
  exact, not prefixes.
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
  first when you can.
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
- **Wildcards** in any path: `*` one segment (map keyed by an id: `occurrences.*.buckets`),
  `**` any depth (`**.updatedAt`), `[]` array elements. Mappings from a map's key use
  `use: key` (`from: occurrences.*`).
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
extra-features/validate-highlighter.sh            # checks ~/compass-highlighter/highlighter.yaml
extra-features/validate-highlighter.sh <path>     # checks another file
```

It reports YAML syntax errors with line, column and a caret, schema errors with the YAML path
and line, and semantic problems (unknown `activeFeature`, duplicate ids, namespaces without a
dot, undeclared styles, relations to collections the feature does not list). Fix every `✖`
before telling the user you are done; `⚠` lines are worth mentioning. Exit code 1 means Compass
is still showing the previous valid config. If it says the schema is not compiled, run
`npm run compile -w @mongodb-js/compass-highlighter` once.

Then tell the user which feature is active; Compass reloads the file on its own.

## 4. Changing the Highlighter code or schema

- Code lives in `packages/compass-highlighter`. Schema: `src/config/schema.ts`. Upstream touch
  points are listed in `extra-features/highlighter.md` under "Upstream files modified"; keep
  that list current.
- If you change the schema, update `extra-features/highlighter.example.yaml` to show every key,
  then run `npm run sync-example -w @mongodb-js/compass-highlighter`. A test fails if the two
  drift.
- Run `npm test -w @mongodb-js/compass-highlighter` and `npm run check -w @mongodb-js/compass-highlighter`.
- Rebuild dependents after touching shared contexts:
  `npm run compile -w @mongodb-js/compass-components -w @mongodb-js/compass-connections-navigation`.
