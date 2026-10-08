import { useCallback, useMemo } from 'react';
import type { HighlighterState } from './stores/reducer';
import {
  useHighlighterSelectorUnsafe,
  useHighlighterDispatch as useHighlighterDispatchUnsafe,
} from './stores/context';
import type { HighlighterStore } from './stores';
import { resolveFeature, resolveModels, resolveTags } from './config/resolve';
import type {
  ResolvedCollection,
  ResolvedFeature,
  ResolvedField,
  ResolvedTag,
} from './config/resolve';
import { PathIndex } from './config/paths';
import type { ListingMode, QueryConfig } from './config/schema';
import { indexMappings } from './config/mappings';
import type { MappingTarget } from './config/mappings';
import { namespaceToDatabase } from './config/paths';

const NO_STATE: HighlighterState = {
  configPath: '',
  status: 'disabled',
  error: null,
  config: null,
  listingOverride: null,
  tagFilter: [],
  mappings: { byDatabase: {}, errors: {} },
  models: { byDatabase: {}, errors: {} },
  aiStatusUrl: null,
};

/**
 * The plugin is only mounted in the desktop app. Packages that consume these
 * hooks (sidebar, crud) are also bundled into compass-web, where there is no
 * store, so every hook degrades to "nothing highlighted" instead of throwing.
 */
export function useHighlighterState<T>(
  selector: (state: HighlighterState) => T
): T {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useHighlighterSelectorUnsafe(selector);
  } catch {
    return selector(NO_STATE);
  }
}

/** False when the plugin is not mounted or has no config backend. */
export function useHighlighterEnabled(): boolean {
  return useHighlighterState((state) => state.status !== 'disabled');
}

/**
 * Dispatch that is a no-op when the plugin is not mounted, for the same
 * reason as `useHighlighterState`: sidebar and crud render these components
 * in environments (compass-web in Atlas, unit tests) without the store.
 */
export function useHighlighterDispatchSafe(): HighlighterStore['dispatch'] {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useHighlighterDispatchUnsafe();
  } catch {
    return ((action: unknown) => action) as HighlighterStore['dispatch'];
  }
}

export function useHighlighterConfig() {
  return useHighlighterState((state) => state.config);
}

export function useActiveFeature(): ResolvedFeature | null {
  const config = useHighlighterConfig();
  return useMemo(
    () => (config ? resolveFeature(config, config.activeFeature) : null),
    [config]
  );
}

export type CollectionDecoration = {
  color?: string;
  background?: string;
  icon?: string;
  label: string;
  tags: ResolvedTag[];
  dimmed: boolean;
};

export type MappingLookup = (
  namespace: string,
  normalizedPath: string
) => MappingTarget[];

/**
 * Per-database mapping files, indexed. Returns a lookup that is stable while
 * the mapping files do not change.
 */
export function useMappingLookup(): MappingLookup {
  const byDatabase = useHighlighterState((s) => s.mappings.byDatabase);
  return useMemo(() => {
    const indexes = new Map(
      Object.values(byDatabase).map((file) => [
        file.database,
        indexMappings(file),
      ])
    );
    return (namespace, normalizedPath) =>
      indexes
        .get(namespaceToDatabase(namespace))
        ?.get(namespace)
        ?.get(normalizedPath) ?? [];
  }, [byDatabase]);
}

/** Feature-independent collection knowledge from models/<database>.yaml. */
export function useModelCollections(): ReadonlyMap<string, ResolvedCollection> {
  const config = useHighlighterConfig();
  const byDatabase = useHighlighterState((s) => s.models.byDatabase);
  return useMemo(
    () =>
      config
        ? resolveModels(config, Object.values(byDatabase))
        : new Map<string, ResolvedCollection>(),
    [config, byDatabase]
  );
}

/**
 * Predefined queries for a namespace: the active feature's `queries` that
 * target it, plus collection-level `queries` from the feature and the model
 * file. Drives the Documents tab menu.
 */
export function useQueriesForNamespace(namespace: string): QueryConfig[] {
  const feature = useActiveFeature();
  const models = useModelCollections();
  return useMemo(() => {
    const out: QueryConfig[] = [];
    for (const q of feature?.queries ?? []) {
      if (q.namespace === namespace) out.push(q);
    }
    for (const c of [
      feature?.collectionsByNamespace.get(namespace),
      models.get(namespace),
    ]) {
      for (const q of c?.queries ?? []) out.push({ ...q, namespace });
    }
    return out;
  }, [feature, models, namespace]);
}

export type EffectiveFields = {
  /** model entries first, then the active feature's; later entries win */
  index: PathIndex<ResolvedField>;
  hasAny: boolean;
};

/**
 * Fields to decorate for a namespace: the data model's entries plus the
 * active feature's entries for the same collection.
 */
export function useEffectiveFields(namespace: string): EffectiveFields {
  const feature = useActiveFeature();
  const models = useModelCollections();
  return useMemo(() => {
    const index = new PathIndex<ResolvedField>();
    let hasAny = false;
    for (const source of [
      models.get(namespace),
      feature?.collectionsByNamespace.get(namespace),
    ]) {
      for (const field of source?.fields ?? []) {
        index.add(field.path, field);
        hasAny = true;
      }
    }
    return { index, hasAny };
  }, [models, feature, namespace]);
}

export type HighlighterListing = {
  mode: ListingMode;
  feature: ResolvedFeature | null;
  /** Tags selected in the sidebar filter; empty = no tag filtering */
  tagFilter: ReadonlySet<string>;
  isCollectionInterested(namespace: string): boolean;
  isDatabaseInterested(database: string): boolean;
  /** Tags on the collection or any of its fields, from the feature and the model file */
  collectionTags(namespace: string): string[];
  getCollectionDecoration(namespace: string): CollectionDecoration | undefined;
  getDatabaseDecoration(database: string): CollectionDecoration | undefined;
};

/**
 * Every tag that exists: declared under `tags:` plus any used on a collection
 * or field in a feature or model file, resolved with a colour.
 */
export function useHighlighterTags(): ResolvedTag[] {
  const config = useHighlighterConfig();
  const models = useModelCollections();
  return useMemo(() => {
    if (!config) {
      return [];
    }
    const names = new Set<string>(Object.keys(config.tags ?? {}));
    const collect = (c: {
      tags?: string[];
      fields?: Array<{ tags?: string[] }>;
    }) => {
      for (const t of c.tags ?? []) names.add(t);
      for (const f of c.fields ?? [])
        for (const t of f.tags ?? []) names.add(t);
    };
    for (const feature of config.features) {
      for (const c of feature.collections ?? []) collect(c);
    }
    for (const model of models.values()) {
      collect({
        tags: model.tags.map((t) => t.name),
        fields: model.fields.map((f) => ({ tags: f.tags.map((t) => t.name) })),
      });
    }
    return resolveTags(config, [...names].sort());
  }, [config, models]);
}

export function useHighlighterListing(): HighlighterListing {
  const feature = useActiveFeature();
  const models = useModelCollections();
  const listingOverride = useHighlighterState((s) => s.listingOverride);
  const tagFilterList = useHighlighterState((s) => s.tagFilter);
  const tagFilter = useMemo(() => new Set(tagFilterList), [tagFilterList]);
  const mode: ListingMode = feature
    ? (listingOverride ?? feature.display.listing)
    : 'all';

  const collectionTags = useCallback(
    (namespace: string): string[] => {
      const names = new Set<string>();
      for (const c of [
        feature?.collectionsByNamespace.get(namespace),
        models.get(namespace),
      ]) {
        for (const t of c?.tags ?? []) names.add(t.name);
        for (const f of c?.fields ?? [])
          for (const t of f.tags) names.add(t.name);
      }
      return [...names];
    },
    [feature, models]
  );
  const matchesTagFilter = useCallback(
    (namespace: string) =>
      tagFilter.size === 0 ||
      collectionTags(namespace).some((t) => tagFilter.has(t)),
    [tagFilter, collectionTags]
  );
  const isCollectionInterested = useCallback(
    (namespace: string) =>
      (!feature || feature.collectionsByNamespace.has(namespace)) &&
      matchesTagFilter(namespace),
    [feature, matchesTagFilter]
  );
  const isDatabaseInterested = useCallback(
    (database: string) => !feature || feature.databases.has(database),
    [feature]
  );
  const getCollectionDecoration = useCallback(
    (namespace: string): CollectionDecoration | undefined => {
      if (!feature) {
        return undefined;
      }
      const collection = feature.collectionsByNamespace.get(namespace);
      if (!collection) {
        return mode === 'dim-others'
          ? { label: '', tags: [], dimmed: true }
          : undefined;
      }
      if (!feature.display.showBadges) {
        return {
          label: collection.alias ?? '',
          tags: collection.tags,
          dimmed: false,
        };
      }
      return {
        color: collection.style.color,
        background: collection.style.background,
        icon: collection.style.icon,
        label: collection.alias ?? collection.role ?? collection.style.name,
        tags: collection.tags,
        dimmed: false,
      };
    },
    [feature, mode]
  );
  const getDatabaseDecoration = useCallback(
    (database: string): CollectionDecoration | undefined => {
      if (!feature || feature.databases.has(database)) {
        return undefined;
      }
      return mode === 'dim-others'
        ? { label: '', tags: [], dimmed: true }
        : undefined;
    },
    [feature, mode]
  );

  return useMemo(
    () => ({
      mode,
      feature,
      tagFilter,
      isCollectionInterested,
      isDatabaseInterested,
      collectionTags,
      getCollectionDecoration,
      getDatabaseDecoration,
    }),
    [
      mode,
      feature,
      tagFilter,
      isCollectionInterested,
      isDatabaseInterested,
      collectionTags,
      getCollectionDecoration,
      getDatabaseDecoration,
    ]
  );
}

type AnyCollection = { name: string };
type AnyDatabase = { name: string; collections: AnyCollection[] };
type AnyConnection = { connectionStatus: string; databases?: AnyDatabase[] };

/**
 * Applies the sidebar tag filter and, in `only-interested` mode, the active
 * feature's collection list to the connection tree. Without either the input
 * is returned untouched so the sidebar keeps its own memoisation.
 */
export function filterConnectionsForHighlighter<C extends AnyConnection>(
  connections: C[],
  listing: HighlighterListing
): C[] {
  const byFeature = listing.mode === 'only-interested' && !!listing.feature;
  const byTags = listing.tagFilter.size > 0;
  if (!byFeature && !byTags) {
    return connections;
  }
  return connections.map((connection) => {
    if (connection.connectionStatus !== 'connected' || !connection.databases) {
      return connection;
    }
    const databases = connection.databases
      .filter((db) => !byFeature || listing.isDatabaseInterested(db.name))
      .map((db) => ({
        ...db,
        collections: db.collections.filter((coll) => {
          const namespace = `${db.name}.${coll.name}`;
          if (
            byFeature &&
            !listing.feature?.collectionsByNamespace.has(namespace)
          ) {
            return false;
          }
          return (
            !byTags ||
            listing
              .collectionTags(namespace)
              .some((t) => listing.tagFilter.has(t))
          );
        }),
      }))
      // a tag filter hides databases that end up empty
      .filter((db) => !byTags || db.collections.length > 0);
    return { ...connection, databases };
  });
}
