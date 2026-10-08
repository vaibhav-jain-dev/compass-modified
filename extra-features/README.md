# Extra Features

This repository is a fork of [mongodb-js/compass](https://github.com/mongodb-js/compass).
Everything described in this folder is an **extra feature**: functionality added in this fork
that does not exist upstream.

This folder is the single source of truth for those features. If you are an agent or a
contributor working in this repo, read this index first so you know what has been added,
where it lives, and how to use and extend it.

## Feature index

| Feature          | Status                      | Doc                                                                                    | Packages touched                                                                                                                         |
| ---------------- | --------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Highlighter      | done                        | [highlighter.md](highlighter.md), [highlighter.example.yaml](highlighter.example.yaml) | compass-highlighter (new), compass-components, compass-sidebar, compass-workspaces, compass-settings, compass-preferences-model, compass |
| Deep links       | planned (after Highlighter) | [deep-links.md](deep-links.md)                                                         | compass-highlighter, compass, compass-crud, compass-workspaces                                                                           |
| Edit mode toggle | done                        | [edit-mode-toggle.md](edit-mode-toggle.md)                                             | compass-crud                                                                                                                             |

Statuses: `planned` (doc written, code not started), `in-progress`, `done`, `deprecated`.

## How to use a feature

Each feature has its own doc in this folder (`extra-features/<feature-name>.md`). The doc
explains what the feature does, how to turn it on, how to use it, where the code lives, and
how to test it. Start there before touching the code.

## How to add a new feature

1. Copy [`TEMPLATE.md`](TEMPLATE.md) to `extra-features/<feature-name>.md` and fill in every section.
2. Add a row to the feature index table above.
3. Keep the code for the feature as isolated as possible. Prefer new files and new packages
   over edits to upstream files, so that merging upstream changes stays easy.
4. When you must change an upstream file, list it in the feature doc under
   "Upstream files modified" so the change is traceable.
5. Follow the project conventions in [`AGENTS.md`](../AGENTS.md) and
   [`CONTRIBUTING.md`](../CONTRIBUTING.md). Extra features are held to the same code quality,
   testing, and commit message standards as the rest of the repo.
6. Update the feature doc whenever the feature's behaviour, location, or status changes.

## Fork-wide changes that are not features

- **Web first.** `npm run start-web` is the primary target; the Electron app is best effort and
  not kept in sync feature by feature. Feature docs say which targets they were verified on.
- compass-web sandbox dev server (`packages/compass-web/scripts/sandbox-dev-server.js`): port
  fallback for 7777/1337, no auto-open under WSL, and the `/highlighter/config` endpoint.
- Sandbox guide cues are disabled (`packages/compass-web/sandbox/sandbox-preferences.ts`): the
  assistant guide cue races its focus trap and throws on slower machines.
- Sandbox auto-connect (`packages/compass-web/sandbox/sandbox-autoconnect.ts`, prop
  `onDefaultConnectionRequest` on `CompassWeb`): last used connection, else local MongoDB when
  `/sandbox/local-mongo` reports it reachable.

- Dev server port defaults to 4747 instead of upstream's 4242 (`configs/webpack-config-compass/src/dev-server-port.ts`,
  override with `COMPASS_DEV_SERVER_PORT`). Avoids clashing with an upstream checkout.
- `scripts/start.mts` falls back to a kernel-assigned port when the configured one cannot be
  bound (WSL mirrored-networking bug), instead of failing.
- `configs/webpack-config-compass/bin/serve-lifecycle.js`: the dev server exits when its parent
  process dies and within 3s of any signal, and the Electron plugin stops the app on exit, so
  killing a wrapper never leaves an orphaned server holding ports.
- `COMPASS_DEVICE_SCALE_FACTOR` passes `--force-device-scale-factor` to Electron in dev
  (`configs/webpack-config-compass/src/webpack-plugin-start-electron.ts`) for HiDPI under WSLg.
- README section "Running this fork locally" lists the WSL2 prerequisites.

## Agent skills

Features that agents operate on day to day get a project skill under `.claude/skills/<feature>/`
so the agent knows the file format and workflow without reading the code. Currently:

- [`highlighter`](../.claude/skills/highlighter/SKILL.md): edit `highlighter.yaml` (features,
  notes, queries, checks) on request.
- [`mappings`](../.claude/skills/mappings/SKILL.md): maintain `mappings/<database>.yaml`, which
  field points at which document.
- [`models`](../.claude/skills/models/SKILL.md): maintain `models/<database>.yaml`, what fields
  mean and how they are highlighted regardless of the active feature.
- All three validate with [`validate-highlighter.sh`](validate-highlighter.sh).

## Conventions

- One doc per feature. Feature names are lowercase kebab-case, e.g. `query-history-export.md`.
- The doc is written for someone who has never seen the feature. Do not assume context from
  chat history or commit messages.
- Reference code as `packages/<package>/src/<path>` so readers can find it.
- Do not document upstream Compass behaviour here. Link to upstream docs instead.
