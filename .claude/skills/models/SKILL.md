---
name: models
description: Maintain the Compass fork's per-database model files (~/compass-highlighter/models/<database>.yaml) that record what collections and fields mean and how they are highlighted, independent of any ticket. Use when the user says "what does this field mean", "note that this field is ...", "always show this field in red", "this collection is the loan's copy", "tag this field as ...", or wants highlights that stay when switching highlighter features.
---

# Models skill

A model file is the fork's notebook about a database: per collection an alias, style, tags and
notes; per field a style, a short `label` (its meaning), tags and notes. It applies whatever
highlighter feature is active, also when none is, so the everyday highlights do not disappear
when the user switches tickets. Features in `highlighter.yaml` layer their own entries on top:
for the same path the feature's style and label win, tags and relations combine.

Read `extra-features/highlighter.models.example.yaml` for the commented format.

## Where

`~/compass-highlighter/models/<database>.yaml` (Windows: `%USERPROFILE%\compass-highlighter\models\`).
The file name is the database. Styles and tags referenced here are the ones defined under
`styles:` and `tags:` in `~/compass-highlighter/highlighter.yaml`; add new ones there first.

## Format

```yaml
version: 1
database: devlms
collections:
  - namespace: fields # collection name (db.collection also accepted)
    alias: Field definition # shown in the banner above the document list
    style: definitions
    notes: cx_ parent, ins_ clone, sm_ summary.
    fields:
      - path: parent_field_id
        style: family
        label: family key # uppercase chip next to the key
      - path: occurrences.*.buckets.field_ids # wildcards as in the highlighter
        style: slot0
        label: slot ids, [0] is slot 0
        tags: [text-ids]
        notes: Free text shown in the tooltip.
```

Rules:

- Put "what this field means" here; put ticket-specific notes ("LMS-4034 changes this") in the
  feature instead.
- `label` is the meaning in two or three words; `notes` carries the explanation.
- Paths: dots, `[]`, `*`, `**`, exact beats wildcard.
- Preserve comments and order; edit in place.

## After editing

Run `extra-features/validate-highlighter.sh`: it validates every model file next to the config
and warns about styles that are not declared in `highlighter.yaml`. Compass reloads on its own;
the Highlighter tab's "Mappings" section lists loaded model files and parse errors.

## Typical requests

| User says                                      | Edit                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| "variable_id is the field whose value changed" | add the field with `label` and `notes` under that collection             |
| "always colour the frozen slot binding red"    | give the field the `slot0` style (or define a style in highlighter.yaml) |
| "these ids are text everywhere here"           | add `tags: [text-ids]` on those fields                                   |
| "call this collection the counts helper"       | set `alias` on the collection                                            |
