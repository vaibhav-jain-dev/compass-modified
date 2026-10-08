import React from 'react';
import type { ReactReduxContextValue, TypedUseSelectorHook } from 'react-redux';
import {
  createSelectorHook,
  createDispatchHook,
  createStoreHook,
} from 'react-redux';
import type { HighlighterState } from './reducer';
import type { HighlighterStore } from './index';

export const HighlighterContext = React.createContext<
  ReactReduxContextValue<HighlighterState>
>(
  // @ts-expect-error react-redux types
  null
);

export const useHighlighterStore = createStoreHook(
  HighlighterContext
) as () => HighlighterStore;

export const useHighlighterDispatch = createDispatchHook(
  HighlighterContext
) as () => HighlighterStore['dispatch'];

export const useHighlighterSelectorUnsafe: TypedUseSelectorHook<HighlighterState> =
  createSelectorHook(HighlighterContext);
