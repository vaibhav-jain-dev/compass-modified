import React from 'react';
import { expect } from 'chai';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import {
  cleanup,
  render,
  screen,
  userEvent,
  waitFor,
} from '@mongodb-js/testing-library-compass';
import { createNoopLogger } from '@mongodb-js/compass-logging/provider';
import type { ConnectionsService } from '@mongodb-js/compass-connections/provider';

const fakeConnections = {
  getDataServiceForConnection() {
    throw new Error('no data service in tests');
  },
} as unknown as ConnectionsService;
import { HighlighterPlugin, HighlighterFeatureSelect } from '../index';
import { FileConfigBackend } from '../config/file-backend';

describe('HighlighterFeatureSelect', function () {
  let dir: string;
  let configPath: string;

  beforeEach(async function () {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'compass-highlighter-'));
    configPath = path.join(dir, 'highlighter.yaml');
  });

  afterEach(async function () {
    cleanup();
    await fs.rm(dir, { recursive: true, force: true });
  });

  function renderSelect() {
    const Plugin = HighlighterPlugin.withMockServices({
      logger: createNoopLogger(),
      connections: fakeConnections,
    });
    return render(
      <Plugin backend={new FileConfigBackend(() => configPath)}>
        <HighlighterFeatureSelect />
      </Plugin>
    );
  }

  it('renders nothing without a backend', function () {
    const Plugin = HighlighterPlugin.withMockServices({
      logger: createNoopLogger(),
      connections: fakeConnections,
    });
    render(
      <Plugin>
        <HighlighterFeatureSelect />
      </Plugin>
    );
    expect(screen.queryByTestId('highlighter-feature-select')).to.equal(null);
  });

  it('renders nothing when there is no config file', async function () {
    renderSelect();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByTestId('highlighter-feature-select')).to.equal(null);
  });

  it('lists features and writes the selection back to the file', async function () {
    await fs.writeFile(
      configPath,
      `# keep this comment
activeFeature: one
features:
  - id: one
    label: Feature One
  - id: two
    label: Feature Two
`
    );
    renderSelect();

    const select = await screen.findByTestId('highlighter-feature-select');
    expect(select).to.have.text('Feature One');

    userEvent.click(select);
    userEvent.click(await screen.findByRole('option', { name: 'Feature Two' }));

    await waitFor(async () => {
      expect(await fs.readFile(configPath, 'utf8')).to.include(
        'activeFeature: two'
      );
    });
    expect(await fs.readFile(configPath, 'utf8')).to.include(
      '# keep this comment'
    );
    await waitFor(() => {
      expect(screen.getByTestId('highlighter-feature-select')).to.have.text(
        'Feature Two'
      );
    });
  });
});
