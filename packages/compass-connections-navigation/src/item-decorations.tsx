import React, { createContext, useContext } from 'react';
import type { SidebarTreeItem } from './tree-data';

/**
 * Lets the host sidebar decorate tree items (colour dot, icon, dimming)
 * without the tree knowing where the decoration comes from. Used by the
 * fork-specific Highlighter feature; see extra-features/highlighter.md.
 */
export type ItemDecorationTag = {
  name: string;
  color?: string;
  background?: string;
  description?: string;
};

export type ItemDecoration = {
  color?: string;
  background?: string;
  icon?: string;
  label?: string;
  /** Shown behind an info icon with a tooltip listing them */
  tags?: ItemDecorationTag[];
  dimmed?: boolean;
};

export type ItemDecorationsContextValue = {
  getItemDecoration(item: SidebarTreeItem): ItemDecoration | undefined;
};

const ItemDecorationsContext =
  createContext<ItemDecorationsContextValue | null>(null);

export const ItemDecorationsProvider: React.FunctionComponent<{
  value: ItemDecorationsContextValue | null;
  children?: React.ReactNode;
}> = ({ value, children }) => {
  return (
    <ItemDecorationsContext.Provider value={value}>
      {children}
    </ItemDecorationsContext.Provider>
  );
};

export function useItemDecoration(
  item: SidebarTreeItem
): ItemDecoration | undefined {
  const decorations = useContext(ItemDecorationsContext);
  return decorations?.getItemDecoration(item);
}
