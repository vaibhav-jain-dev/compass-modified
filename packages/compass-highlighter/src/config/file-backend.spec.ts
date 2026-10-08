import { expect } from 'chai';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { FileConfigBackend, resolveConfigPath } from './file-backend';

describe('FileConfigBackend', function () {
  let dir: string;

  beforeEach(async function () {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'compass-highlighter-'));
  });

  afterEach(async function () {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('resolves the config path from the preference or the visible default', function () {
    expect(resolveConfigPath(undefined)).to.equal(
      path.join(os.homedir(), 'compass-highlighter', 'highlighter.yaml')
    );
    expect(resolveConfigPath('   ', () => '/data/h.yaml')).to.equal(
      '/data/h.yaml'
    );
    expect(resolveConfigPath('/custom/h.yaml')).to.equal('/custom/h.yaml');
  });

  it('reports a missing file and creates the parent folder when writing', async function () {
    const backend = new FileConfigBackend(() =>
      path.join(dir, 'a', 'b', 'highlighter.yaml')
    );
    expect(await backend.exists()).to.equal(false);
    await backend.writeText('version: 1\n');
    expect(await backend.exists()).to.equal(true);
    expect(await backend.readText()).to.equal('version: 1\n');
  });
});
