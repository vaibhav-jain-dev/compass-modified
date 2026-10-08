# MongoDB Compass Monorepo

This repository contains the source code and build tooling used in [MongoDB Compass](https://www.mongodb.com/products/compass).

![Aggregation Pipeline Builder Tab in Compass](packages/compass/compass-screenshot.png)

## Extra Features

This repository is a fork of [mongodb-js/compass](https://github.com/mongodb-js/compass) with
additional features that are not part of upstream Compass. Every extra feature is documented in
the [`extra-features/`](extra-features/README.md) folder, which lists what has been added, where
the code lives, and how to use and test each feature. Read that index before working on
fork-specific functionality.

## Running this fork locally (WSL2 / Ubuntu)

Prerequisites that upstream's `CONTRIBUTING.md` does not mention. Run them once:

```bash
# Electron runtime libraries (window, audio, keychain, notifications)
sudo apt-get install -y libnss3 libasound2t64 libxss1 libsecret-1-0 libnotify4
# Kerberos headers, needed by the native module rebuild that runs before `npm run start`
sudo apt-get install -y libkrb5-dev
```

Node `>=24.15` and npm `>=11.16` are required (see `engines` in `package.json`). Then:

```bash
npm run bootstrap   # installs dependencies and compiles every package, takes several minutes
npm run start-web   # primary target: web sandbox, prints the URL to open in your Windows browser
```

**The web build is the primary target of this fork.** Extra features are developed and verified
in `npm run start-web` first. The Electron desktop app (`npm run start`) still builds and runs,
but it is not kept in sync feature by feature and may lag behind; treat it as best effort.

On start-up the sandbox reconnects to the connection you used last. If you never connected to
anything, it connects to a local MongoDB at `mongodb://localhost:27017` when one is reachable
from WSL (`COMPASS_LOCAL_MONGODB` overrides the connection string).

`start-web` serves the sandbox on port 7777 and the websocket proxy on 1337 by default
(`COMPASS_WEB_PORT`, `COMPASS_WEB_WS_PORT` override). Under WSL it does not try to open a
browser; copy the printed `http://localhost:<port>/` into your Windows browser. The sandbox also
serves `~/compass-highlighter/highlighter.yaml` at `/highlighter/config` so the Highlighter
feature works in the browser against the same file agents edit (`COMPASS_HIGHLIGHTER_CONFIG`
overrides the path).

Under WSL2 the Electron window appears on the Windows desktop through WSLg. The dev build stores
its data in the Linux home directory, so it never conflicts with an official Compass installed
on Windows.

This fork serves the dev build on port **4747** instead of upstream's 4242, so it can run next to
an upstream Compass checkout. Override it with `COMPASS_DEV_SERVER_PORT=5050 npm run start`.

**Window too small on a HiDPI monitor?** WSLg does not pass the Windows display scale to
Electron. Set the scale yourself, for example:

```bash
COMPASS_DEVICE_SCALE_FACTOR=1.5 npm run start   # try 1.25, 1.5, 1.75 or 2
```

Put `export COMPASS_DEVICE_SCALE_FACTOR=1.5` in your `~/.zshrc` to make it permanent. Inside the
app, Ctrl + = and Ctrl + - zoom the content and the zoom level is remembered.

Under WSL mirrored networking the kernel sometimes refuses to bind any port outside its
ephemeral range (`EADDRINUSE` on everything, even loopback) until the VM is restarted.
Both `npm run start-web` and `npm run start` detect this and fall back to kernel-assigned ports
automatically, printing `port ... cannot be bound ... using <port>`. Use the URL that is printed.
The permanent fix is `wsl --shutdown` from PowerShell, or `networkingMode=nat` in
`C:\Users\<you>\.wslconfig`.

The Highlighter config lives at `~/compass-highlighter/highlighter.yaml`; see
[`extra-features/highlighter.md`](extra-features/highlighter.md).

**Local AI for "Generate query"** (web sandbox): install [Ollama](https://ollama.com) in WSL
and pull a model, then start the sandbox as usual:

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen2.5-coder:7b     # ~4.7 GB, fits an 8 GB GPU
```

The first query after a start loads the model onto the GPU (a toast says so); later ones take
a few seconds. Optional settings go in `~/compass-highlighter/ai.yaml` (see
[`extra-features/ai.example.yaml`](extra-features/ai.example.yaml)); details and
troubleshooting in [`extra-features/local-ai.md`](extra-features/local-ai.md).

## Contributing

For contributing, please refer to [CONTRIBUTING.md](CONTRIBUTING.md)

For issues, please create a ticket in our [JIRA Project](https://jira.mongodb.org/browse/COMPASS).

Is there anything else you’d like to see in Compass? Let us know by submitting suggestions in out [feedback forum](https://feedback.mongodb.com/).

## Packages Overview

- [**mongodb-compass**](packages/compass): The MongoDB GUI

### Compass Plugins

- [**@mongodb-js/compass-aggregations**](packages/compass-aggregations): Compass Aggregation Pipeline Builder
- [**@mongodb-js/compass-app-stores**](packages/compass-app-stores): The external stores repo for compass
- [**@mongodb-js/compass-collection**](packages/compass-collection): Compass Collection
- [**@mongodb-js/compass-crud**](packages/compass-crud): Compass Plugin for CRUD Operations
- [**@mongodb-js/compass-databases-collections**](packages/databases-collections): Plugin for viewing the list of, creating, and dropping databases and collections
- [**@mongodb-js/compass-explain-plan**](packages/compass-explain-plan): Evaluate the performance of your query
- [**@mongodb-js/compass-export-to-language**](packages/compass-export-to-language): Export MongoDB queries and aggregations to various languages
- [**@mongodb-js/compass-field-store**](packages/compass-field-store): FieldStore keeps track of available fields in a collection
- [**@mongodb-js/compass-find-in-page**](packages/compass-find-in-page): cmd-f UI for Compass
- [**@mongodb-js/compass-import-export**](packages/compass-import-export): Import/Export feature for Compass
- [**@mongodb-js/compass-indexes**](packages/compass-indexes): Collection index management for Compass
- [**@mongodb-js/compass-query-bar**](packages/compass-query-bar): Renders a component for executing MongoDB queries through a GUI
- [**@mongodb-js/compass-saved-aggregations-queries**](packages/compass-saved-aggregations-queries): Instance tab plugin that shows saved queries and aggregations
- [**@mongodb-js/compass-schema**](packages/compass-schema): Compass Schema Tab Plugin
- [**@mongodb-js/compass-schema-validation**](packages/compass-schema-validation): Compass plugin for document JSON schema validation
- [**@mongodb-js/compass-serverstats**](packages/compass-serverstats): Compass Real Time
- [**@mongodb-js/compass-shell**](packages/compass-shell): Compass Shell Plugin
- [**@mongodb-js/compass-sidebar**](packages/compass-sidebar): The sidebar of Compass

### Shared Libraries and Build Tools

- [**@mongodb-js/atlas-service**](packages/atlas-service): Service to handle Atlas sign in and API requests
- [**@mongodb-js/compass-app-registry**](packages/compass-app-registry): Compass App Registry
- [**@mongodb-js/compass-components**](packages/compass-components): React Components used in Compass
- [**@mongodb-js/compass-connection-import-export**](packages/compass-connection-import-export): UI for Compass connection import/export
- [**@mongodb-js/compass-connections**](packages/compass-connections): Manage your MongoDB connections and connect in Compass
- [**@mongodb-js/compass-connections-navigation**](packages/compass-connections-navigation): Databases and collections sidebar navigation tree
- [**@mongodb-js/compass-context-menu**](packages/compass-context-menu): Context menu hooks and provider for Compass
- [**@mongodb-js/compass-data-modeling**](packages/compass-data-modeling): Data modeling diagram workspace and all related services
- [**@mongodb-js/compass-editor**](packages/compass-editor): Reusable Compass editor component based on codemirror editor, themes, and autocompleters
- [**@mongodb-js/compass-generative-ai**](packages/compass-generative-ai): Generative AI aspects for Compass
- [**@mongodb-js/compass-global-writes**](packages/compass-global-writes): Compass Global Sharding management
- [**@mongodb-js/compass-intercom**](packages/compass-intercom): Intercom scripts and utils for Compass
- [**@mongodb-js/compass-logging**](packages/compass-logging): Shared helpers for logging in Compass packages
- [**@mongodb-js/compass-maybe-protect-connection-string**](packages/compass-maybe-protect-connection-string): Utility for protecting connection strings if requested
- [**@mongodb-js/compass-settings**](packages/compass-settings): Settings for compass
- [**@mongodb-js/compass-smoke-tests**](packages/compass-smoke-tests): Smoke test suite for Compass app installers
- [**@mongodb-js/compass-telemetry**](packages/compass-telemetry): Compass telemetry
- [**@mongodb-js/compass-test-server**](packages/compass-test-server): Wrapper around mongodb-runner to manage test servers for Compass
- [**@mongodb-js/compass-user-data**](packages/compass-user-data): undefined
- [**@mongodb-js/compass-utils**](packages/compass-utils): Utilities for MongoDB Compass Development
- [**@mongodb-js/compass-web**](packages/compass-web): Compass application packaged for the browser environment
- [**@mongodb-js/compass-welcome**](packages/compass-welcome): The welcome modal
- [**@mongodb-js/compass-workspaces**](packages/compass-workspaces): Compass plugin responsible for rendering and managing state of current namespace / workspace
- [**@mongodb-js/connection-form**](packages/connection-form): A form for specifying information needed to connect to a MongoDB instance
- [**@mongodb-js/connection-info**](packages/connection-info): Types and utilites for connections agnostic of backend
- [**@mongodb-js/connection-storage**](packages/connection-storage): Compass connection storage
- [**@mongodb-js/databases-collections-list**](packages/databases-collections-list): List view for the databases and collections
- [**@mongodb-js/explain-plan-helper**](packages/explain-plan-helper): Explain plan utility methods for MongoDB Compass
- [**@mongodb-js/my-queries-storage**](packages/my-queries-storage): Saved aggregations and queries storage
- [**@mongodb-js/reflux-state-mixin**](packages/reflux-state-mixin): Reflux stores mixin adding 'state' syntax similar to React components
- [**bson-transpilers**](packages/bson-transpilers): Source to source compilers using ANTLR
- [**compass-e2e-tests**](packages/compass-e2e-tests): E2E test suite for Compass app that follows smoke tests / feature testing matrix
- [**compass-preferences-model**](packages/compass-preferences-model): Compass preferences model
- [**hadron-build**](packages/hadron-build): Tooling for Hadron apps like Compass
- [**hadron-document**](packages/hadron-document): Hadron Document
- [**hadron-ipc**](packages/hadron-ipc): Simplified IPC for electron apps.
- [**hadron-type-checker**](packages/hadron-type-checker): Hadron Type Checker
- [**mongodb-collection-model**](packages/collection-model): MongoDB collection model
- [**mongodb-data-service**](packages/data-service): MongoDB Data Service
- [**mongodb-database-model**](packages/database-model): MongoDB database model
- [**mongodb-explain-compat**](packages/mongodb-explain-compat): Convert mongodb SBE explain output to 4.4 explain output
- [**mongodb-instance-model**](packages/instance-model): MongoDB instance model
- [**mongodb-query-util**](packages/mongodb-query-util): Utilty Functions for MongoDB Query Functionality

### Shared Configuration Files

- [**@mongodb-js/eslint-config-compass**](configs/eslint-config-compass): Shared Compass eslint configuration
- [**@mongodb-js/eslint-plugin-compass**](configs/eslint-plugin-compass): Custom eslint rules for Compass monorepo
- [**@mongodb-js/mocha-config-compass**](configs/mocha-config-compass): Shared mocha mocha configuration for Compass packages
- [**@mongodb-js/prettier-config-compass**](configs/prettier-config-compass): Shared Compass prettier configuration
- [**@mongodb-js/testing-library-compass**](configs/testing-library-compass): Compass unit testing utils
- [**@mongodb-js/tsconfig-compass**](configs/tsconfig-compass): Shared Compass Typescript configuration
- [**@mongodb-js/webpack-config-compass**](configs/webpack-config-compass): Shared webpack configuration for Compass application and plugins

## License

[SSPL](LICENSE)
