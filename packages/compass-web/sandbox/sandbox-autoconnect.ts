import type { ConnectionInfo } from '@mongodb-js/connection-info';
import { sandboxConnectionStorage } from '../src/connection-storage';

export const LOCAL_MONGODB_CONNECTION_ID = 'sandbox-local-mongodb';

type LocalMongoProbe = { available: boolean; connectionString: string };

function mostRecentlyUsed(
  connections: ConnectionInfo[]
): ConnectionInfo | undefined {
  // lastUsed survives the localStorage round trip as an ISO string, so
  // compare through Date rather than trusting the declared type.
  return connections
    .filter((info) => info.lastUsed)
    .sort(
      (a, b) =>
        new Date(b.lastUsed as Date).getTime() -
        new Date(a.lastUsed as Date).getTime()
    )[0];
}

/**
 * Fork-specific start-up behaviour for the sandbox: reconnect to whatever
 * was used last; if nothing was ever used, connect to a local MongoDB when
 * the dev server can reach one (see scripts/sandbox-dev-server.js).
 *
 * This file is bundled with the compass-web library (see webpack.config.js)
 * because it needs the sandbox connection storage from src/. The sandbox page
 * itself must not import src/, so the resolver is handed over via a global.
 */
export const kSandboxDefaultConnection = Symbol.for(
  '@compass-web-sandbox-default-connection'
);

export async function resolveSandboxDefaultConnection(
  connections: ConnectionInfo[]
): Promise<ConnectionInfo | undefined> {
  const previous = mostRecentlyUsed(connections);
  if (previous) {
    return previous;
  }
  let probe: LocalMongoProbe;
  try {
    const res = await fetch('/sandbox/local-mongo', { cache: 'no-store' });
    if (!res.ok) {
      return undefined;
    }
    probe = (await res.json()) as LocalMongoProbe;
  } catch {
    return undefined;
  }
  if (!probe.available) {
    return undefined;
  }
  const local: ConnectionInfo = connections.find(
    (info) => info.id === LOCAL_MONGODB_CONNECTION_ID
  ) ?? {
    id: LOCAL_MONGODB_CONNECTION_ID,
    savedConnectionType: 'favorite',
    favorite: { name: 'Local MongoDB' },
    connectionOptions: { connectionString: probe.connectionString },
  };
  // Save it so it shows up in the sidebar and becomes "last used" next time.
  await sandboxConnectionStorage.current?.save?.({ connectionInfo: local });
  return local;
}

Object.defineProperty(globalThis, kSandboxDefaultConnection, {
  get() {
    return resolveSandboxDefaultConnection;
  },
});
