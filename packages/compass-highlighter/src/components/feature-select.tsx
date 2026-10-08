import React, { useCallback } from 'react';
import {
  Select,
  Option,
  css,
  spacing,
  Tooltip,
  Body,
} from '@mongodb-js/compass-components';
import { useHighlighterDispatch } from '../stores/context';
import { useHighlighterState } from '../hooks';
import { setActiveFeature } from '../stores';
import { getFeatureLabel } from '../config/resolve';

const NONE_VALUE = '';

const containerStyles = css({
  paddingLeft: spacing[400],
  paddingRight: spacing[400],
});

const HighlighterFeatureSelectInner: React.FunctionComponent = () => {
  const dispatch = useHighlighterDispatch();
  const config = useHighlighterState((s) => s.config);
  const status = useHighlighterState((s) => s.status);
  const error = useHighlighterState((s) => s.error);

  const onChange = useCallback(
    (value: string) => {
      void dispatch(setActiveFeature(value === NONE_VALUE ? null : value));
    },
    [dispatch]
  );

  if (status === 'disabled' || status === 'missing' || status === 'loading') {
    return null;
  }

  const select = (
    <Select
      data-testid="highlighter-feature-select"
      aria-label="Highlighter feature"
      size="xsmall"
      allowDeselect={false}
      value={config?.activeFeature ?? NONE_VALUE}
      onChange={onChange}
      disabled={status === 'error'}
      state={status === 'error' ? 'error' : 'none'}
    >
      <Option value={NONE_VALUE}>Highlighter: none</Option>
      {(config?.features ?? []).map((feature) => (
        <Option key={feature.id} value={feature.id}>
          {getFeatureLabel(feature)}
        </Option>
      ))}
    </Select>
  );

  return (
    <div className={containerStyles}>
      {status === 'error' ? (
        <Tooltip
          trigger={({
            children,
            ...props
          }: React.HTMLProps<HTMLDivElement>) => (
            <div {...props}>
              {select}
              {children}
            </div>
          )}
        >
          <Body>Highlighter config failed to load: {error}</Body>
        </Tooltip>
      ) : (
        select
      )}
    </div>
  );
};

/**
 * Sidebar dropdown. Renders nothing when the plugin is not mounted (e.g. in
 * compass-web) or when there is no config file yet.
 */
export const HighlighterFeatureSelect: React.FunctionComponent = () => {
  const enabled = useHighlighterState((s) => s.status !== 'disabled');
  if (!enabled) {
    return null;
  }
  return <HighlighterFeatureSelectInner />;
};
