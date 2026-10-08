import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import {
  Body,
  CompassComponentsProvider,
  css,
  resetGlobalCSS,
} from '@mongodb-js/compass-components';
import type * as CompassWebModule from '../src';
import { OpenInAtlasToast } from './open-in-atlas-toast';
import { createHashHistory } from 'history';
// Subpath import on purpose: the main entry would pull the whole plugin
// (and the driver) into the sandbox bundle, which has no Node polyfills.
import { HttpConfigBackend } from '@mongodb-js/compass-highlighter/http-backend';
import type { ConnectionInfo } from '@mongodb-js/connection-info';

const hashHistory = createHashHistory();

Object.assign(globalThis, {
  __compassWebSharedRuntime: {
    React,
    ReactDOM,
  },
  // Two conditions need to be matching: this value set to true AND special
  // imports added directly to the compass-web build, there is no way to
  // activate this otherwise
  __compassWebEnableSandboxStorage: true,
  __compassWebEnableSandboxMultiplexWsOverride: true,
  __compassWebEnableSandboxPreferencesOverride: true,
  // For testing purposes to programmatically trigger navigation
  hashHistory,
  // Fork-specific: the dev server picks the ws proxy port at start-up (see
  // webpack.config.js) and injects it here for sandbox-multiplex-link.ts
  __compassWebSandboxWsUrl: process.env.COMPASS_WEB_WS_URL,
});

// Fork extra feature: highlighter config is served by the dev server from the
// user's home directory, see webpack.config.js
const highlighterBackend = new HttpConfigBackend('/highlighter/config');

// Provided by sandbox-autoconnect.ts, which is bundled with the library
const resolveDefaultConnection = (connections: ConnectionInfo[]) => {
  const resolver = (
    globalThis as unknown as Record<
      symbol,
      ((c: ConnectionInfo[]) => Promise<ConnectionInfo | undefined>) | undefined
    >
  )[Symbol.for('@compass-web-sandbox-default-connection')];
  return resolver ? resolver(connections) : Promise.resolve(undefined);
};

const sandboxContainerStyles = css({
  width: '100%',
  height: '100%',
});

resetGlobalCSS();

const App = () => {
  const [compassWebModule, setCompassWebModule] = useState<
    typeof CompassWebModule | null
  >(null);
  const [compassWebModuleError, setCompassWebModuleError] =
    useState<Error | null>(null);

  useEffect(() => {
    // @ts-expect-error this is a "public" url of the asset produced by webpack,
    // TS won't be able to resolve the types from that
    void import(/* webpackIgnore: true */ '/compass-web.mjs')
      .then(setCompassWebModule)
      .catch(setCompassWebModuleError);
  }, []);

  if (compassWebModuleError) {
    throw compassWebModuleError;
  }

  if (!compassWebModule) {
    return null;
  }

  const { CompassWeb } = compassWebModule;

  return (
    <CompassComponentsProvider>
      <Body as="div" className={sandboxContainerStyles}>
        <CompassWeb
          orgId=""
          projectId=""
          history={hashHistory}
          highlighterBackend={highlighterBackend}
          onDefaultConnectionRequest={resolveDefaultConnection}
          localAiEndpoint="/local-ai"
        ></CompassWeb>
        <OpenInAtlasToast></OpenInAtlasToast>
      </Body>
    </CompassComponentsProvider>
  );
};

const sandboxContainer = document.querySelector('#sandbox-app');
if (!sandboxContainer) {
  throw new Error('Sandbox container not found');
}

// eslint-disable-next-line react/no-deprecated
ReactDOM.render(
  <React.StrictMode>
    <App></App>
  </React.StrictMode>,
  sandboxContainer
);
