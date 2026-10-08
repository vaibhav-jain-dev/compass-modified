'use strict';
// Fork-specific helpers for the compass-web sandbox dev server.
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');

function canBind(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen(port, 'localhost', () => server.close(() => resolve(true)));
  });
}

function kernelAssignedPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, 'localhost', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

/**
 * Returns `preferred` when it can be bound, otherwise a port the kernel hands
 * out. Under WSL mirrored networking every non-ephemeral port can refuse to
 * bind until the VM restarts; kernel-assigned ports keep working.
 */
async function pickPort(preferred, label) {
  if (await canBind(preferred)) {
    return preferred;
  }
  const fallback = await kernelAssignedPort();
  console.warn(
    `[compass-web sandbox] ${label} port ${preferred} cannot be bound (EADDRINUSE); using ${fallback}. ` +
      'If every port fails, WSL mirrored networking is stuck; "wsl --shutdown" from Windows fixes it.'
  );
  return fallback;
}

function getHighlighterConfigPath() {
  return (
    process.env.COMPASS_HIGHLIGHTER_CONFIG ||
    path.join(os.homedir(), 'compass-highlighter', 'highlighter.yaml')
  );
}

function getLocalMongoConnectionString() {
  return process.env.COMPASS_LOCAL_MONGODB || 'mongodb://localhost:27017';
}

/** TCP-level reachability check of the local MongoDB, 1s timeout. */
function probeLocalMongo() {
  const connectionString = getLocalMongoConnectionString();
  let host = 'localhost';
  let port = 27017;
  try {
    const url = new URL(connectionString);
    host = url.hostname || host;
    port = Number(url.port) || port;
  } catch {
    // keep defaults
  }
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (available) => {
      socket.destroy();
      resolve({ available, connectionString });
    };
    socket.setTimeout(1000, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

function getSidecarDir(kind) {
  return path.join(path.dirname(getHighlighterConfigPath()), kind);
}

async function listMappingFiles(kind = 'mappings') {
  const dir = getSidecarDir(kind);
  let entries;
  try {
    entries = (await fs.promises.readdir(dir)).filter((e) =>
      /\.ya?ml$/i.test(e)
    );
  } catch {
    return [];
  }
  return Promise.all(
    entries.sort().map(async (entry) => {
      const filePath = path.join(dir, entry);
      const stat = await fs.promises.stat(filePath);
      return {
        path: filePath,
        database: entry.replace(/\.ya?ml$/i, ''),
        mtimeMs: stat.mtimeMs,
      };
    })
  );
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

/**
 * Serves the highlighter YAML (fork extra feature, see
 * extra-features/highlighter.md) so the browser build can read and edit the
 * same file agents edit. GET returns metadata plus text (`?meta=1` omits the
 * text), PUT replaces the file.
 */
function createHighlighterConfigMiddleware(middlewares, devServer) {
  devServer.app.get('/sandbox/local-mongo', async (req, res) => {
    res.json(await probeLocalMongo());
  });
  const route = '/highlighter/config';
  devServer.app.get(route, async (req, res) => {
    const filePath = getHighlighterConfigPath();
    try {
      const stat = await fs.promises.stat(filePath).catch(() => null);
      const sidecars = [
        ...(await listMappingFiles('mappings')),
        ...(await listMappingFiles('models')),
      ];
      const payload = {
        path: filePath,
        exists: stat !== null,
        mtimeMs: stat ? stat.mtimeMs : null,
        mappingsStamp: sidecars.map((m) => `${m.path}:${m.mtimeMs}`).join('|'),
      };
      if (stat && req.query.meta !== '1') {
        payload.text = await fs.promises.readFile(filePath, 'utf8');
      }
      res.json(payload);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  for (const kind of ['mappings', 'models']) {
    devServer.app.get(`${route}/${kind}`, async (req, res) => {
      try {
        const files = await listMappingFiles(kind);
        res.json(
          await Promise.all(
            files.map(async (m) => ({
              path: m.path,
              database: m.database,
              text: await fs.promises.readFile(m.path, 'utf8'),
            }))
          )
        );
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
  }
  devServer.app.put(route, async (req, res) => {
    const filePath = getHighlighterConfigPath();
    try {
      const text = await readBody(req);
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, text, 'utf8');
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  return middlewares;
}

module.exports = {
  pickPort,
  probeLocalMongo,
  createHighlighterConfigMiddleware,
  getHighlighterConfigPath,
};
