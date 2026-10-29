import React, { useCallback, useContext, useMemo } from 'react';
import { createServiceLocator } from '@mongodb-js/compass-app-registry';
import { cloneDeep } from 'lodash';
import { useSelector, useStore } from '../stores/context';
import type { ChangeFilterEvent } from '../modules/change-filter';
import {
  applyFilterChange,
  applyFromHistory,
  applyQuery,
  changeField,
} from '../stores/query-bar-reducer';
import { mapFormFieldsToQuery } from '../utils/query';
import type { RootState } from '../stores/query-bar-store';
import { isQueryEqual } from '../utils';
import type { BaseQuery } from '../constants/query-properties';
import { DEFAULT_QUERY_VALUES } from '../constants/query-bar-store';
import type QueryBar from './query-bar';

function NoOpQueryBarComponent() {
  return <></>;
}

const QueryBarComponentContext = React.createContext<
  React.FC<React.ComponentProps<typeof QueryBar>>
>(NoOpQueryBarComponent);

export const QueryBarComponentProvider = QueryBarComponentContext.Provider;

export const useQueryBarComponent = () => {
  return useContext(QueryBarComponentContext);
};

/**
 * Returns the current parsed query document derived from the field values in
 * the query bar
 */
export function useQueryBarQuery() {
  const fields = useSelector((state) => {
    return state.queryBar.fields;
  });
  return useMemo(() => {
    return mapFormFieldsToQuery(fields);
  }, [fields]);
}

const DEFAULT_QUERY: BaseQuery = cloneDeep(DEFAULT_QUERY_VALUES);

function selectLastAppliedQuery(
  state: RootState,
  source: string | null = null
) {
  source ??= state.queryBar.lastAppliedQuery.source;
  return source
    ? (state.queryBar.lastAppliedQuery.query[source] ?? DEFAULT_QUERY)
    : DEFAULT_QUERY;
}

/**
 * Returns the query that was last applied (query bar field values at the moment
 * of "Apply" or "Reset" buttons being clicked). If `source` value is provided,
 * returns query last applied from a specific part of the application, otherwise
 * returns whatever was the last applied query in general
 */
export function useLastAppliedQuery(source: string | null = null) {
  return useSelector((state) => {
    return selectLastAppliedQuery(state, source);
  });
}

/**
 * Returns `true` if the last applied query for the provided `source` doesn't
 * match the last applied query bar disregarding the source that triggered the
 * "Apply"
 */
export function useIsLastAppliedQueryOutdated(source: string) {
  return useSelector((state) => {
    const lastApplied = selectLastAppliedQuery(state);
    const lastAppliedForSource = selectLastAppliedQuery(state, source);
    return !isQueryEqual(lastApplied, lastAppliedForSource);
  });
}

export function useChangeQueryBarQuery() {
  const store = useStore();
  return useCallback(
    <T extends ChangeFilterEvent['type']>(
      type: T,
      payload: Extract<ChangeFilterEvent, { type: T }>['payload']
    ) => {
      store.dispatch(applyFilterChange({ type, payload } as ChangeFilterEvent));
    },
    [store]
  );
}

/**
 * Fork extra feature: fill the query bar with a complete query (filter,
 * project, sort, skip, limit) and apply it as if "Apply" was clicked, so the
 * last applied query for `source` is updated. The caller still has to refresh
 * the results. Used by the highlighter's predefined queries menu.
 */
export function useApplyQueryBarQuery(source: string) {
  const store = useStore();
  return useCallback(
    (query: BaseQuery) => {
      store.dispatch(applyFromHistory(query));
      store.dispatch(applyQuery(source));
    },
    [store, source]
  );
}

/**
 * Fork extra feature: sets the sort field of the query bar and applies the
 * query, the way typing a sort and clicking Find does. Used by the query
 * comparison view to keep results in _id order.
 */
export function useApplyQueryBarSort(source: string) {
  const store = useStore();
  return useCallback(
    (sort: Record<string, unknown>) => {
      store.dispatch(changeField('sort', JSON.stringify(sort)));
      store.dispatch(applyQuery(source));
    },
    [store, source]
  );
}

export const queryBarServiceLocator = createServiceLocator(
  function useQueryBarServiceLocator() {
    const store = useStore();
    const changeQuery = useChangeQueryBarQuery();
    return {
      getCurrentQuery() {
        return mapFormFieldsToQuery(store.getState().queryBar.fields);
      },
      getLastAppliedQuery(source: string | null = null) {
        return selectLastAppliedQuery(store.getState(), source);
      },
      changeQuery,
    };
  },
  'queryBarServiceLocator'
);

export type QueryBarService = ReturnType<typeof queryBarServiceLocator>;
