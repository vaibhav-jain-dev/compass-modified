import React from 'react';
import {
  useHoverState,
  spacing,
  css,
  ItemActionControls,
  cx,
  Badge,
  BadgeVariant,
  Tooltip,
  useDarkMode,
  Body,
  nbsp,
  Icon,
} from '@mongodb-js/compass-components';
import { useItemDecoration } from './item-decorations';
import { type Actions, ROW_HEIGHT } from './constants';
import { ExpandButton } from './tree-item';
import { type NavigationItemActions } from './item-actions';
import type {
  ConnectedConnectionTreeItem,
  NotConnectedConnectionTreeItem,
  SidebarTreeItem,
} from './tree-data';

type NavigationBaseItemProps = React.PropsWithChildren<{
  item: SidebarTreeItem;
  name: string;
  isActive: boolean;
  isExpandVisible: boolean;
  isExpandDisabled: boolean;
  isExpanded: boolean;
  isFocused: boolean;
  hasDefaultAction: boolean;
  icon: React.ReactNode;
  style: React.CSSProperties;

  dataAttributes?: Record<string, string | undefined>;
  actionProps: {
    collapseAfter?: number;
    collapseToMenuThreshold?: number;
    actions: NavigationItemActions;
    onAction: (action: Actions) => void;
  };
  toggleExpand: () => void;
}>;

const menuStyles = css({
  width: '240px',
  maxHeight: 'unset',
  marginLeft: 'auto',
});

const itemContainerStyles = css({
  color: 'var(--item-color)',
  backgroundColor: 'var(--item-bg-color)',
  '&[data-is-active="true"] .item-wrapper': {
    fontWeight: 600,
    color: 'var(--item-color-active)',
    backgroundColor: 'var(--item-bg-color-active)',
  },
  '&:hover:not([data-is-active="true"]) .item-wrapper': {
    backgroundColor: 'var(--item-bg-color-hover)',
  },
  svg: {
    flexShrink: 0,
  },
});

const itemContainerWithActionStyles = css({
  cursor: 'pointer',
});

const itemWrapperStyles = css({
  display: 'flex',
  height: ROW_HEIGHT,
  alignItems: 'center',
  paddingRight: spacing[400],
  gap: spacing[50],
});

const labelAndIconWrapperStyles = css({
  width: '100%',
  display: 'flex',
  gap: spacing[150],
  overflow: 'hidden',
  alignItems: 'center',
  '& span': {
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },
  fontSize: '12px',
});

const dimmedItemStyles = css({
  opacity: 0.45,
});

const decorationMarkerStyles = css({
  display: 'inline-flex',
  alignItems: 'center',
  flexShrink: 0,
  width: spacing[200],
  height: spacing[200],
  borderRadius: '50%',
});

const decorationIconStyles = css({
  display: 'inline-flex',
  alignItems: 'center',
  flexShrink: 0,
});

const tagListStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[100],
});

const tagChipStyles = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: spacing[100],
  padding: `0 ${spacing[150]}px`,
  borderRadius: spacing[100],
  fontSize: '12px',
  lineHeight: '20px',
  width: 'fit-content',
});

const DecorationTags: React.FunctionComponent<{
  tags: NonNullable<ReturnType<typeof useItemDecoration>>['tags'];
}> = ({ tags }) => {
  const isDarkMode = useDarkMode();
  if (!tags?.length) {
    return null;
  }
  return (
    <Tooltip
      darkMode={isDarkMode}
      trigger={({
        children: tooltipChildren,
        ...tooltipTriggerProps
      }: React.HTMLProps<HTMLSpanElement>) => (
        <span
          {...tooltipTriggerProps}
          className={decorationIconStyles}
          style={{ color: tags[0].color }}
          data-testid="navigation-item-tags"
        >
          <Icon glyph="InfoWithCircle" size="small" />
          {tooltipChildren}
        </span>
      )}
    >
      <div className={tagListStyles}>
        {tags.map((tag) => (
          <span
            key={tag.name}
            className={tagChipStyles}
            style={{ color: tag.color, backgroundColor: tag.background }}
          >
            {tag.name}
            {tag.description ? `: ${tag.description}` : ''}
          </span>
        ))}
      </div>
    </Tooltip>
  );
};

const actionControlsWrapperStyles = css({
  display: 'flex',
  marginLeft: 'auto',
  alignItems: 'center',
  gap: spacing[100],
});

const ClusterStateBadge: React.FunctionComponent<{
  state: string;
}> = ({ state }) => {
  const badgeVariant =
    state === 'CREATING'
      ? BadgeVariant.Blue
      : state === 'DELETED'
        ? BadgeVariant.Red
        : BadgeVariant.LightGray;
  const badgeText =
    state === 'DELETING'
      ? 'TERMINATING'
      : state === 'DELETED'
        ? 'TERMINATED'
        : state;

  return (
    <Badge variant={badgeVariant} data-testid="navigation-item-state-badge">
      {badgeText}
    </Badge>
  );
};

const ClusterStateBadgeWithTooltip: React.FunctionComponent<{
  item: ConnectedConnectionTreeItem | NotConnectedConnectionTreeItem;
}> = ({ item }) => {
  const isDarkMode = useDarkMode();

  const atlasClusterState = item.connectionInfo.atlasMetadata?.clusterState;
  if (atlasClusterState === 'PAUSED') {
    return (
      <Tooltip
        enabled={true}
        darkMode={isDarkMode}
        trigger={({
          children: tooltipChildren,
          ...tooltipTriggerProps
        }: React.HTMLProps<HTMLDivElement>) => (
          <div {...tooltipTriggerProps}>
            <ClusterStateBadge state={atlasClusterState} />
            {tooltipChildren}
          </div>
        )}
      >
        <Body>Unpause your cluster to connect to it</Body>
      </Tooltip>
    );
  } else if (
    atlasClusterState === 'DELETING' ||
    atlasClusterState === 'CREATING' ||
    atlasClusterState === 'DELETED'
  ) {
    return <ClusterStateBadge state={atlasClusterState} />;
  }

  return null;
};

export const NavigationBaseItem = React.forwardRef<
  HTMLDivElement,
  NavigationBaseItemProps
>(function NavigationBaseItem(
  {
    item,
    isActive,
    actionProps,
    name,
    style,
    icon,
    dataAttributes,
    isExpandVisible,
    isExpandDisabled,
    isExpanded,
    isFocused,
    hasDefaultAction,
    toggleExpand,
    children,
  },
  ref
) {
  const [hoverProps, isHovered] = useHoverState();
  const decoration = useItemDecoration(item);

  return (
    <div
      ref={ref}
      data-testid="base-navigation-item"
      data-highlighter-dimmed={decoration?.dimmed ? 'true' : undefined}
      className={cx(itemContainerStyles, {
        [itemContainerWithActionStyles]: hasDefaultAction,
        [dimmedItemStyles]: !!decoration?.dimmed,
      })}
      {...hoverProps}
      {...dataAttributes}
    >
      <div className={cx('item-wrapper', itemWrapperStyles)} style={style}>
        {isExpandVisible && (
          <ExpandButton
            onClick={(event) => {
              // Prevent the click from propagating to the `TreeItem`, triggering the default action
              event.stopPropagation();
              toggleExpand();
            }}
            isExpanded={isExpanded}
            disabled={isExpandDisabled}
          ></ExpandButton>
        )}
        <div className={labelAndIconWrapperStyles}>
          {icon}
          <span title={name}>{nbsp(name)}</span>
          {decoration?.icon ? (
            <span
              className={decorationIconStyles}
              style={{ color: decoration.color }}
              title={decoration.label}
              data-testid="navigation-item-highlight"
            >
              <Icon glyph={decoration.icon} size="small" />
            </span>
          ) : decoration?.color ? (
            <span
              className={decorationMarkerStyles}
              style={{ backgroundColor: decoration.color }}
              title={decoration.label}
              data-testid="navigation-item-highlight"
            />
          ) : null}
          {decoration?.tags?.length ? (
            <DecorationTags tags={decoration.tags} />
          ) : null}
        </div>
        {item.type === 'connection' && (
          <ClusterStateBadgeWithTooltip item={item} />
        )}
        <div className={actionControlsWrapperStyles}>
          <ItemActionControls
            menuClassName={menuStyles}
            isVisible={isActive || isHovered || isFocused}
            data-testid="sidebar-navigation-item-actions"
            iconSize="xsmall"
            {...actionProps}
          />
          {children}
        </div>
      </div>
    </div>
  );
});
