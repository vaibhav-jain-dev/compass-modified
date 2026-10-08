import React, { createContext, useContext } from 'react';

/**
 * Lets a host plugin decorate document fields by path (dot path, array
 * indexes skipped, same format as `getNestedKeyPathForElement`). Used by the
 * fork-specific Highlighter feature; see extra-features/highlighter.md.
 */
export type FieldDecoration = {
  color?: string;
  background?: string;
  bold?: boolean;
  strikethrough?: boolean;
  icon?: string;
  /** Accessible name of the decoration */
  label?: string;
  /** Short meaning rendered as a chip next to the key, e.g. "family key" */
  chip?: string;
  tooltip?: React.ReactNode;
  /** When set the decoration icon becomes a button, e.g. "show related docs" */
  onClick?: () => void;
};

/** Collection-level decoration shown as a header strip on each document */
export type CollectionDecoration = {
  title: string;
  color?: string;
  background?: string;
  icon?: string;
  notes?: string;
};

export type FieldDecorationsContextValue = {
  collection?: CollectionDecoration;
  /**
   * `getValue` returns the current BSON value of the field; it is a thunk so
   * decorations that never need the value do not pay for generating it.
   */
  getFieldDecoration(
    path: string,
    getValue: () => unknown,
    /** The element's own key (last path segment, or array index) */
    key?: string,
    /** The element's full path including array indexes, for display */
    fullPath?: string
  ): FieldDecoration | undefined;
};

const FieldDecorationsContext =
  createContext<FieldDecorationsContextValue | null>(null);

export const FieldDecorationsProvider: React.FunctionComponent<{
  value: FieldDecorationsContextValue | null;
  children?: React.ReactNode;
}> = ({ value, children }) => {
  return (
    <FieldDecorationsContext.Provider value={value}>
      {children}
    </FieldDecorationsContext.Provider>
  );
};

export function useCollectionDecoration(): CollectionDecoration | undefined {
  return useContext(FieldDecorationsContext)?.collection;
}

export function useFieldDecoration(
  path: string,
  getValue: () => unknown,
  key?: string,
  fullPath?: string
): FieldDecoration | undefined {
  const decorations = useContext(FieldDecorationsContext);
  return decorations?.getFieldDecoration(path, getValue, key, fullPath);
}
