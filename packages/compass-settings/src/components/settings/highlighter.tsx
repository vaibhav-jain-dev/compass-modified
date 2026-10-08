import React from 'react';
import { Link } from '@mongodb-js/compass-components';
import SettingsList from './settings-list';

// Fork extra feature, see extra-features/highlighter.md
export const highlighterFields = ['highlighterConfigPath'] as const;

export const HighlighterSettings: React.FunctionComponent = () => {
  return (
    <div data-testid="highlighter-settings">
      <div>
        Highlighter marks the collections, fields and relations that matter for
        the feature you are working on. Everything is driven by a YAML file that
        you or an agent can edit while Compass is running. See{' '}
        <Link
          href="https://github.com/vaibhav-jain-dev/compass-modified/blob/main/extra-features/highlighter.md"
          target="_blank"
        >
          extra-features/highlighter.md
        </Link>{' '}
        for the file format.
      </div>
      <SettingsList fields={highlighterFields} />
    </div>
  );
};

export default HighlighterSettings;
