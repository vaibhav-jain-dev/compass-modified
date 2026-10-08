import { expect } from 'chai';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { createNoopLogger } from '@mongodb-js/compass-logging/provider';
import type { ConnectionsService } from '@mongodb-js/compass-connections/provider';

const fakeConnections = {
  getDataServiceForConnection() {
    throw new Error('no data service in tests');
  },
} as unknown as ConnectionsService;
import { FileConfigBackend } from '../config/file-backend';
import { NullConfigBackend } from '../config/backend';
import {
  configureStore,
  loadConfig,
  setActiveFeature,
  updateFieldNotes,
  createConfigFromExample,
  toggleCheck,
} from './index';

describe('highlighter store', function () {
  let dir: string;
  let configPath: string;

  beforeEach(async function () {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'compass-highlighter-'));
    configPath = path.join(dir, 'highlighter.yaml');
  });

  afterEach(async function () {
    await fs.rm(dir, { recursive: true, force: true });
  });

  function makeStore() {
    return configureStore(
      { logger: createNoopLogger(), connections: fakeConnections },
      new FileConfigBackend(() => configPath)
    );
  }

  it('is disabled without a backend', async function () {
    const store = configureStore(
      { logger: createNoopLogger(), connections: fakeConnections },
      new NullConfigBackend()
    );
    await store.dispatch(loadConfig());
    expect(store.getState().status).to.equal('disabled');
  });

  it('reports a missing config and can create it from the example', async function () {
    const store = makeStore();
    await store.dispatch(loadConfig());
    expect(store.getState().status).to.equal('missing');
    expect(store.getState().configPath).to.equal(configPath);

    await store.dispatch(createConfigFromExample());
    expect(store.getState().status).to.equal('ready');
    expect(store.getState().config?.activeFeature).to.equal('order-checkout');
  });

  it('reports a parse error without losing the path', async function () {
    await fs.writeFile(configPath, 'features: notalist\n');
    const store = makeStore();
    await store.dispatch(loadConfig());
    expect(store.getState().status).to.equal('error');
    expect(store.getState().error).to.be.a('string');
    expect(store.getState().configPath).to.equal(configPath);
  });

  it('writes edits through the backend and reloads from it', async function () {
    await fs.writeFile(
      configPath,
      `features:
  - id: one
    collections:
      - namespace: db.a
        fields:
          - path: x
  - id: two
`
    );
    const store = makeStore();
    await store.dispatch(loadConfig());
    expect(store.getState().config?.activeFeature).to.equal(undefined);

    await store.dispatch(setActiveFeature('two'));
    expect(store.getState().config?.activeFeature).to.equal('two');

    await store.dispatch(updateFieldNotes('one', 'db.a', 'x', 'note!'));
    expect(
      store.getState().config?.features[0].collections?.[0].fields?.[0].notes
    ).to.equal('note!');
    expect(await fs.readFile(configPath, 'utf8')).to.include('note!');
  });
});

describe('highlighter store checks', function () {
  it('toggles a check and writes it back', async function () {
    const dir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'compass-highlighter-')
    );
    const file = path.join(dir, 'highlighter.yaml');
    await fs.writeFile(
      file,
      `features:
  - id: one
    checks:
      - text: first
      - text: second
        done: true
`
    );
    const store = configureStore(
      { logger: createNoopLogger(), connections: fakeConnections },
      new FileConfigBackend(() => file)
    );
    await store.dispatch(loadConfig());
    await store.dispatch(toggleCheck('one', 0, true));
    await store.dispatch(toggleCheck('one', 1, false));
    expect(
      store.getState().config?.features[0].checks?.map((c) => c.done)
    ).to.deep.equal([true, false]);
    await fs.rm(dir, { recursive: true, force: true });
  });
});
