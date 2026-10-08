import React from 'react';
import { registerCompassPlugin } from '@mongodb-js/compass-app-registry';
import { createLoggerLocator } from '@mongodb-js/compass-logging/provider';
import { connectionsLocator } from '@mongodb-js/compass-connections/provider';
import type { WorkspacePlugin } from '@mongodb-js/workspace-info';
import { activatePlugin } from './stores';
import type { HighlighterPluginProps } from './stores';
import { HighlighterWorkspace } from './components/highlighter-workspace';
import {
  PluginTabTitleComponent,
  WorkspaceName,
} from './components/plugin-tab-title';

const HighlighterProviderComponent: React.FunctionComponent<
  HighlighterPluginProps
> = ({ children }) => {
  return React.createElement(React.Fragment, null, children);
};

/**
 * Mount once near the app root with a `backend`. Owns the YAML config store;
 * every other export reads from it through React context.
 */
export const HighlighterPlugin = registerCompassPlugin(
  {
    name: 'Highlighter',
    component: HighlighterProviderComponent,
    activate: activatePlugin,
  },
  {
    logger: createLoggerLocator('COMPASS-HIGHLIGHTER'),
    connections: connectionsLocator,
  }
);

const HighlighterWorkspaceProvider = registerCompassPlugin({
  name: WorkspaceName,
  component: HighlighterProviderComponent,
  activate() {
    return {
      store: {},
      deactivate() {
        // The workspace reads from the HighlighterPlugin store mounted at
        // the app root, so there is nothing to activate per tab.
      },
    };
  },
});

export const WorkspaceTab: WorkspacePlugin<typeof WorkspaceName> = {
  name: WorkspaceName,
  provider: HighlighterWorkspaceProvider,
  content: HighlighterWorkspace,
  header: PluginTabTitleComponent,
};

export { HighlighterFeatureSelect } from './components/feature-select';
export { HighlighterListingToggle } from './components/listing-toggle';
export {
  HighlighterTagFilter,
  useHighlighterTagFilterActive,
} from './components/tag-filter';
export { HighlighterFieldDecorations } from './components/field-decorations';
export {
  useActiveFeature,
  useHighlighterEnabled,
  useHighlighterListing,
  useHighlighterTags,
  filterConnectionsForHighlighter,
  type HighlighterListing,
  type CollectionDecoration,
} from './hooks';
export { NullConfigBackend, type ConfigBackend } from './config/backend';
export { HttpConfigBackend } from './config/http-backend';
export type { HighlighterPluginProps } from './stores';
export type { HighlighterConfig, ListingMode } from './config/schema';
export type { ResolvedFeature } from './config/resolve';

export default HighlighterPlugin;
