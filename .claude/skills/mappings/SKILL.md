---
name: mappings
description: Maintain the Compass fork's per-database mapping files (~/compass-highlighter/mappings/<database>.yaml) that say which field points at which document. Use when the user says "X points at Y", "this id is a <collection> id", "I should be able to jump from X to Y", "link this field", "map product_id to products", "why does this field have no link", or asks which collection an id belongs to. Independent of highlighter features.
---

# Mappings skill

A mapping file tells Compass that a field's value (or a map entry's key) is the `_id` of a
document in another collection. Compass then draws a link icon next to the field, and clicking
it (or Ctrl + double-click on the value) opens the related documents in a draggable panel.
Mappings describe the data model, so they live in their own file per database and apply
whatever highlighter feature is active.

Read `extra-features/highlighter.mappings.example.yaml` for the commented format.

## Where

`~/compass-highlighter/mappings/<database>.yaml` (Windows: `%USERPROFILE%\compass-highlighter\mappings\`).
The file name is the database; the `database:` key inside must match. Create the file from the
example if it does not exist. Do not ask where it is, and never move mappings into
`highlighter.yaml`.

## Format

```yaml
version: 1
database: devlms
mappings:
  - from: fields.product_id # collection.path in this database
    to: products._id # collection.path it points at (path defaults to _id)
    label: Product # panel title; keep it short
  - from: fields.instance_fields[] # [] = each array element links on its own
    to: fields._id
    as: objectId # auto (default) | objectId | string
  - from: loan_field_occurrences.occurrences.* # * = one dynamic segment (a map keyed by an id)
    to: fields._id
    use: key # link from the entry's key instead of its value
  - from: report_templates_v3.sheets.blocks.columns.field_id
    to: fields._id
    as: auto # ids stored as text: auto matches both ObjectId and hex string
    notes: text ids
```

Rules:

- Paths use the highlighter syntax: dots, `[]` for array elements, `*` for one dynamic segment,
  `**` for any depth. An exact `from` wins over a wildcard one for the same concrete path.
- `as: auto` is the safe default: it matches both the ObjectId and its hex string, which matters
  in this codebase because some collections store ids as text. Use `string` or `objectId` only
  when you know the stored shape.
- `use: key` is for maps keyed by an id (`occurrences.*`, `fields_data.*`): the key is the id.
- One entry per direction. If `a.x` points at `b._id` and `b.y` points back, write both.
- Prefer confirming the target by querying the database when you can (does `products` contain
  that id?) over guessing from the field name.
- Preserve comments and order; edit in place.

## After editing

Run `extra-features/validate-highlighter.sh`. It validates every mapping file next to the
config: syntax, schema, whitespace in paths, `use: key` on non-map paths. Compass reloads within
a couple of seconds; the Highlighter tab's "Mappings" section shows the loaded files and parse
errors.

## Typical requests

| User says                                 | Edit                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------ |
| "product_id points at products"           | add `from: <coll>.product_id`, `to: products._id`, `label`                           |
| "this map is keyed by field id"           | add `from: <coll>.<map>.*`, `to: fields._id`, `use: key`                             |
| "ids here are text"                       | keep `as: auto`, or `as: string` if the target is also text                          |
| "why is there no link on this field"      | check the exact concrete path (array indexes, dynamic keys) and add a wildcard entry |
| "I want to see the parent from the clone" | add `from: fields.parent_field_id`, `to: fields._id`                                 |
