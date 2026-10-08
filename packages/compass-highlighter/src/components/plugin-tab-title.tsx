import React from 'react';
import { WorkspaceTab } from '@mongodb-js/compass-components';
import type { PluginHeaderProps } from '@mongodb-js/workspace-info';

export const WorkspaceName = 'Highlighter' as const;

export function PluginTabTitleComponent(
  props: PluginHeaderProps<typeof WorkspaceName>
) {
  return (
    <WorkspaceTab
      {...props}
      type={WorkspaceName}
      title={WorkspaceName}
      iconGlyph="Bulb"
    />
  );
}
