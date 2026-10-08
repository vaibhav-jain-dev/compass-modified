import { useCallback, useMemo } from 'react';
import type { HighlighterState } from './stores/reducer';
import { useHighlighterSelectorUnsafe } from './stores/context';
import { resolveFeature, resolveModels } from './config/resolve';
import type {
  ResolvedCollection,
  ResolvedFeature,
  ResolvedField,
  ResolvedTag,
} from './config/resolve';
import { PathIndex } from './config/paths';
import type { ListingMode } from './config/schema';
import { indexMappings } from './config/mappings';
import type { MappingTarget } from './config/mappings';
import { namespaceToDatabase } from './config/paths';

const NO_STATE: HighlighterState = {
  configPath: '',
  status: 'disabled',
  error: null,
  config: null,
  listingOverride: null,
  mappings: { byDatabase: {}, errors: {} },
  models: { byDatabase: {}, errors: {} },
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
  isCollectionInterested(namespace: string): boolean;
  isDatabaseInterested(database: string): boolean;
  getCollectionDecoration(namespace: string): CollectionDecoration | undefined;
  getDatabaseDecoration(database: string): CollectionDecoration | undefined;
};

export function useHighlighterListing(): HighlighterListing {
  const feature = useActiveFeature();
  const listingOverride = useHighlighterState((s) => s.listingOverride);
  const mode: ListingMode = feature
    ? (listingOverride ?? feature.display.listing)
    : 'all';

  const isCollectionInterested = useCallback(
    (namespace: string) =>
      !feature || feature.collectionsByNamespace.has(namespace),
    [feature]
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
      isCollectionInterested,
      isDatabaseInterested,
      getCollectionDecoration,
      getDatabaseDecoration,
    }),
    [
      mode,
      feature,
      isCollectionInterested,
      isDatabaseInterested,
      getCollectionDecoration,
      getDatabaseDecoration,
    ]
  );
}

type AnyCollection = { name: string };
type AnyDatabase = { name: string; collections: AnyCollection[] };
type AnyConnection = { connectionStatus: string; databases?: AnyDatabase[] };

/**
 * Applies `only-interested` listing to the sidebar connection tree. Other
 * modes return the input untouched so the sidebar keeps its own memoisation.
 */
export function filterConnectionsForHighlighter<C extends AnyConnection>(
  connections: C[],
  listing: HighlighterListing
): C[] {
  if (listing.mode !== 'only-interested' || !listing.feature) {
    return connections;
  }
  return connections.map((connection) => {
    if (connection.connectionStatus !== 'connected' || !connection.databases) {
      return connection;
    }
    const databases = connection.databases
      .filter((db) => listing.isDatabaseInterested(db.name))
      .map((db) => ({
        ...db,
        collections: db.collections.filter((coll) =>
          listing.isCollectionInterested(`${db.name}.${coll.name}`)
        ),
      }));
    return { ...connection, databases };
  });
}
